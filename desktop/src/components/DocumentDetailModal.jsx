import {
  AlertCircle,
  Brain,
  Calendar,
  Check,
  Copy,
  FileSpreadsheet,
  FileText,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ExtractionView } from './ExtractionView.jsx';
import { PrivacyConsentDialog } from './PrivacyConsentDialog.jsx';
import { Badge, Button, Dialog, Spinner } from './ui.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DocumentDetailModal({
  doc,
  open,
  onClose,
  onDeleted,
  initialTab = 'text',
}) {
  const [activeTab, setActiveTab] = useState(null);
  const tab = activeTab || initialTab || 'text';
  const [copied, setCopied] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI Summary State
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState(null);
  const [summaryLength, setSummaryLength] = useState('medium');
  const [summaryFocus, setSummaryFocus] = useState('');
  const [showConsent, setShowConsent] = useState(false);

  const metadata = doc?.metadata;
  const extractedText = doc?.extracted_text || '';

  // Load cached summary on document load
  useEffect(() => {
    if (!doc?.metadata?.id) return;
    let ignore = false;
    window.transformo?.ai
      ?.getSummary(doc.metadata.id)
      .then((res) => {
        if (!ignore) {
          setSummary(res.ok ? res.data : null);
          setLoadingSummary(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          setSummary(null);
          setLoadingSummary(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [doc?.metadata?.id]);

  const filteredText = useMemo(() => {
    if (!filterText.trim()) return extractedText;
    const lines = extractedText.split('\n');
    const q = filterText.toLowerCase();
    const matched = lines.filter((l) => l.toLowerCase().includes(q));
    return matched.join('\n');
  }, [extractedText, filterText]);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopySummary = async () => {
    if (!summary) return;
    const textToCopy = `SUMMARY (${summary.model})\n\n${summary.overview}\n\nKEY POINTS:\n${summary.key_points.map((p) => `• ${p}`).join('\n')}\n\nKEY DATES & FIGURES:\n${summary.key_dates_and_figures.map((d) => `• ${d}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleStartGenerate = (force = false) => {
    const consented = localStorage.getItem('transformo_ai_consent');
    if (!consented) {
      setShowConsent(true);
      return;
    }
    void doGenerateSummary(force);
  };

  const doGenerateSummary = async (force = false) => {
    if (!metadata?.id) return;
    setGenerating(true);
    setSummaryError(null);
    try {
      const res = await window.transformo.ai.generateSummary({
        docId: metadata.id,
        options: {
          length: summaryLength,
          focus: summaryFocus.trim() || undefined,
        },
        force,
      });
      if (res.ok) {
        setSummary(res.data);
      } else {
        setSummaryError(res.error);
      }
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!metadata?.id) return;
    setDeleting(true);
    try {
      const res = await window.transformo.documents.delete(metadata.id);
      if (res.ok) {
        setConfirmDelete(false);
        onClose();
        if (onDeleted) onDeleted(metadata.id);
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!doc) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={metadata?.original_filename || 'Document Details'}
        className="!max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          {/* Scanned PDF warning if applicable */}
          {metadata?.is_scanned && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3.5 text-xs text-warning">
              <TriangleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="font-semibold text-ink">Scanned document detected</p>
                <p className="mt-0.5 text-muted">
                  This document contains scanned pages or images with no extractable text. OCR text
                  extraction will be available in a future update.
                </p>
              </div>
            </div>
          )}

          {/* Metadata summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-sunken px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-muted">Format:</span>
                <Badge tone="accent">{(metadata?.extension || '').replace('.', '').toUpperCase()}</Badge>
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="text-muted">Pages: </span>
                <span className="font-medium text-ink">{metadata?.page_count ?? 1}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div>
                <span className="text-muted">Size: </span>
                <span className="font-medium text-ink">{formatBytes(metadata?.file_size_bytes)}</span>
              </div>
              <div className="h-3 w-px bg-border" />
              <div className="min-w-0">
                <span className="text-muted">Hash: </span>
                <span className="font-mono text-[11px] text-muted truncate">{metadata?.content_hash?.slice(0, 16)}…</span>
              </div>
            </div>

            <Button
              variant="danger"
              onClick={() => setConfirmDelete(true)}
              icon={<Trash2 size={13} />}
              className="!h-7 !px-2.5 !text-xs !bg-transparent hover:!bg-danger-soft !text-danger border border-danger/30"
            >
              Delete
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === 'text'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <FileText size={14} />
              Extracted Text ({extractedText.length.toLocaleString()} chars)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === 'summary'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Sparkles size={14} />
              AI Summary {summary && <span className="size-1.5 rounded-full bg-accent" />}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('extraction')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                tab === 'extraction'
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <FileSpreadsheet size={14} />
              Structured Data
            </button>
          </div>

          {/* TAB 1: Extracted Text */}
          {tab === 'text' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">Plain-text representation</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
                    <input
                      type="text"
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      placeholder="Filter lines…"
                      className="h-7 w-36 rounded-md border border-border bg-surface pl-8 pr-2 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                    />
                  </div>
                  <Button
                    onClick={handleCopyText}
                    disabled={!extractedText}
                    icon={copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    className="!h-7 !px-2.5 !text-xs"
                  >
                    {copied ? 'Copied' : 'Copy text'}
                  </Button>
                </div>
              </div>

              <div className="relative">
                {extractedText ? (
                  <pre className="selectable max-h-96 min-h-[160px] overflow-auto rounded-lg border border-border bg-surface p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
                    {filteredText || (
                      <span className="text-muted italic">No lines match &quot;{filterText}&quot;</span>
                    )}
                  </pre>
                ) : (
                  <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-sunken text-center text-xs text-muted">
                    <FileText size={24} className="text-subtle mb-2" />
                    No text could be extracted from this document.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI Summary */}
          {tab === 'summary' && (
            <div className="flex flex-col gap-4">
              {summaryError && (
                <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{summaryError}</span>
                </div>
              )}

              {loadingSummary ? (
                <div className="flex h-48 items-center justify-center gap-2 text-xs text-muted">
                  <Spinner label="Checking summaries" /> Loading summary status…
                </div>
              ) : generating ? (
                <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-sunken p-6 text-center">
                  <div className="relative">
                    <div className="size-10 rounded-full bg-accent/20 animate-ping absolute inset-0" />
                    <div className="relative size-10 rounded-full bg-accent flex items-center justify-center text-on-accent">
                      <Sparkles size={20} />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-ink">Analyzing document with Groq…</p>
                  <p className="text-xs text-muted max-w-sm">
                    Synthesizing concise overview, key takeaways, and dates/metrics using model openai/gpt-oss-120b.
                  </p>
                </div>
              ) : summary ? (
                <div className="flex flex-col gap-4">
                  {/* Summary Header & Info Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Badge tone="accent">Groq • {summary.model}</Badge>
                      <Badge tone="neutral">{summary.length}</Badge>
                      <span className="text-[11px] text-muted">
                        {new Date(summary.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleCopySummary}
                        icon={copiedSummary ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        className="!h-7 !px-2.5 !text-xs"
                      >
                        {copiedSummary ? 'Copied' : 'Copy summary'}
                      </Button>
                      <Button
                        onClick={() => handleStartGenerate(true)}
                        icon={<RotateCw size={14} />}
                        className="!h-7 !px-2.5 !text-xs"
                      >
                        Regenerate
                      </Button>
                    </div>
                  </div>

                  {/* Multi-part synthesis warning if long document */}
                  {summary.warnings && summary.warnings.length > 0 && (
                    <div className="rounded-md border border-accent/30 bg-accent-soft/30 px-3 py-2 text-xs text-ink leading-relaxed">
                      {summary.warnings.join(' ')}
                    </div>
                  )}

                  {/* Executive Overview */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                      Executive Overview
                    </h4>
                    <div className="rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-ink whitespace-pre-wrap selectable">
                      {summary.overview}
                    </div>
                  </div>

                  {/* Key Takeaways */}
                  {summary.key_points && summary.key_points.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                        Key Points
                      </h4>
                      <ul className="grid grid-cols-1 gap-2">
                        {summary.key_points.map((point, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2.5 rounded-md border border-border/80 bg-sunken/40 px-3 py-2 text-xs text-ink leading-relaxed"
                          >
                            <span className="mt-1 size-1.5 rounded-full bg-accent shrink-0" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Dates & Figures */}
                  {summary.key_dates_and_figures && summary.key_dates_and_figures.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted mb-1.5 flex items-center gap-1.5">
                        <Calendar size={13} className="text-subtle" />
                        Important Dates &amp; Figures
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {summary.key_dates_and_figures.map((item, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-md bg-sunken px-2.5 py-1 text-xs font-medium text-ink border border-border"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* No Summary Yet: Generator Form */
                <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border bg-sunken/40 p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-accent-soft p-2.5 text-accent">
                      <Brain size={22} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-ink">Generate AI Summary</h4>
                      <p className="text-xs text-muted">
                        Produce an accurate overview, key takeaways, and quantitative findings using Groq.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Summary Detail Level
                      </label>
                      <select
                        value={summaryLength}
                        onChange={(e) => setSummaryLength(e.target.value)}
                        className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
                      >
                        <option value="short">Short (Quick takeaways)</option>
                        <option value="medium">Medium (Balanced overview)</option>
                        <option value="detailed">Detailed (Comprehensive in-depth)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-ink mb-1">
                        Analytical Focus (Optional)
                      </label>
                      <input
                        type="text"
                        value={summaryFocus}
                        onChange={(e) => setSummaryFocus(e.target.value)}
                        placeholder="e.g. Financial metrics, Action items"
                        className="w-full h-8 rounded-md border border-border bg-surface px-2.5 text-xs text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2">
                    <Button
                      variant="primary"
                      onClick={() => handleStartGenerate(false)}
                      icon={<Sparkles size={14} />}
                      disabled={!extractedText || metadata?.is_scanned}
                    >
                      Generate summary
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Structured Data Extraction */}
          {tab === 'extraction' && (
            <ExtractionView doc={doc} />
          )}
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete Document"
        className="!max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink leading-relaxed">
            Are you sure you want to delete <strong className="font-semibold">{metadata?.original_filename}</strong>?
            This will permanently remove the document, its extracted contents, and its managed local file.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              busy={deleting}
            >
              Delete document
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Privacy Consent Dialog */}
      <PrivacyConsentDialog
        open={showConsent}
        onClose={() => setShowConsent(false)}
        onConsent={() => {
          setShowConsent(false);
          void doGenerateSummary(false);
        }}
      />
    </>
  );
}
