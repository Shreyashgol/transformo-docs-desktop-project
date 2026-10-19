from __future__ import annotations

import logging
from typing import Callable
from app.ai.models import SummaryLength, SummaryResponse

logger = logging.getLogger("transformo.ai.chunking")

MAX_SINGLE_PASS_WORDS = 6000
CHUNK_TARGET_WORDS = 4000


def split_text_into_chunks(text: str, target_words: int = CHUNK_TARGET_WORDS) -> list[str]:
    """Split text along paragraph or line boundaries into chunks of target_words."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_word_count = 0

    for p in paragraphs:
        p_words = len(p.split())
        if current_word_count + p_words > target_words and current_chunk:
            chunks.append("\n\n".join(current_chunk).strip())
            current_chunk = [p]
            current_word_count = p_words
        else:
            current_chunk.append(p)
            current_word_count += p_words

    if current_chunk:
        chunks.append("\n\n".join(current_chunk).strip())

    return [c for c in chunks if c.strip()]


def summarize_long_document(
    text: str,
    summarize_func: Callable[[str, SummaryLength, str | None], SummaryResponse],
    length: SummaryLength = "medium",
    focus: str | None = None,
) -> SummaryResponse:
    """
    Applies map-reduce strategy for documents exceeding single-pass token capacity.
    Sections are individually summarized (map) and then synthesized into a final summary (reduce).
    """
    chunks = split_text_into_chunks(text, target_words=CHUNK_TARGET_WORDS)
    if len(chunks) <= 1:
        return summarize_func(text, length, focus)

    logger.info("Applying map-reduce summarization across %d chunks", len(chunks))
    section_summaries: list[str] = []
    accumulated_points: list[str] = []
    accumulated_dates_figures: list[str] = []

    for idx, chunk in enumerate(chunks, 1):
        section_focus = f"Section {idx} of {len(chunks)}" + (f" (Focus: {focus})" if focus else "")
        sub_resp = summarize_func(chunk, "short", section_focus)
        section_summaries.append(f"### Section {idx}\n{sub_resp.overview}")
        accumulated_points.extend(sub_resp.key_points)
        accumulated_dates_figures.extend(sub_resp.key_dates_and_figures)

    # Reduce pass: synthesize the combined section summaries
    combined_intermediate = "\n\n".join(section_summaries)
    reduce_prompt = (
        f"Synthesize the following section summaries from a {len(chunks)}-part document into a cohesive "
        f"overall summary." + (f" Maintain specific focus on: {focus}." if focus else "")
    )

    final_resp = summarize_func(combined_intermediate, length, reduce_prompt)

    # Merge unique points and dates/figures, and record chunking warning
    all_points = list(dict.fromkeys(final_resp.key_points + accumulated_points[:6]))
    all_dates = list(dict.fromkeys(final_resp.key_dates_and_figures + accumulated_dates_figures[:6]))

    warnings = list(final_resp.warnings)
    warnings.append(
        f"Document was synthesized across {len(chunks)} sections using multi-stage analysis due to its extensive length."
    )

    return SummaryResponse(
        overview=final_resp.overview,
        key_points=all_points[:8],
        key_dates_and_figures=all_dates[:8],
        provider=final_resp.provider,
        model=final_resp.model,
        length=length,
        created_at=final_resp.created_at,
        warnings=warnings,
    )
