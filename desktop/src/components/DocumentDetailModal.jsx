import { Check, Copy, FileText, Search, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Dialog } from './ui.jsx';

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
}) {
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');

  const metadata = doc?.metadata;
  const extractedText = doc?.extracted_text || '';

  const filteredText = useMemo(() => {
    if (!filterText.trim()) return extractedText;
    const lines = extractedText.split('\n');
    const q = filterText.toLowerCase();
    const matched = lines.filter((l) => l.toLowerCase().includes(q));
    return matched.join('\n');
  }, [extractedText, filterText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!doc) return null;

  return (
    <Dialog open={open} onClose={onClose} title={metadata?.original_filename || 'Document Details'} className="!max-w-3xl">
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
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-sunken px-4 py-2.5 text-xs">
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

        {/* Extracted Text Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Extracted Text</h3>
            <span className="text-xs text-muted">
              ({extractedText.length.toLocaleString()} characters)
            </span>
          </div>
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
              onClick={handleCopy}
              disabled={!extractedText}
              icon={copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              className="!h-7 !px-2.5 !text-xs"
            >
              {copied ? 'Copied' : 'Copy text'}
            </Button>
          </div>
        </div>

        {/* Text viewer area */}
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
    </Dialog>
  );
}
