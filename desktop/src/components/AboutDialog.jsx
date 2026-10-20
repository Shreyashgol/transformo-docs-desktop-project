import {
  Brain,
  CheckCircle2,
  Cpu,
  Database,
  FileStack,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Dialog } from './ui.jsx';

export function AboutDialog({ open, onClose, info }) {
  return (
    <Dialog open={open} onClose={onClose} title="About Transformo Docs" className="!max-w-xl">
      <div className="space-y-6 pt-1">
        {/* Brand Header */}
        <div className="flex items-center gap-4 border-b border-border pb-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-md">
            <FileStack size={28} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-bold tracking-tight text-ink">Transformo Docs</h3>
              <Badge tone="accent" className="font-mono text-[10px]">
                v{info?.version || '0.1.0'}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Empowering Machine-Readable Document Management System
            </p>
          </div>
        </div>

        {/* Academic Project Synopsis */}
        <div className="rounded-xl border border-accent/20 bg-accent-soft/20 p-3.5 text-xs text-ink space-y-1.5 leading-relaxed">
          <div className="font-semibold text-accent flex items-center gap-1.5">
            <Sparkles size={13} />
            Problem Statement #95 — Academic Demonstration
          </div>
          <p className="text-muted text-[11px] leading-relaxed">
            A secure macOS desktop application built for high-throughput ingestion of PDF, DOCX, and TXT documents.
            Provides instant SQLite FTS5 search, LLM-powered multi-stage summaries, and Pydantic-validated structured
            data extraction (General, Invoice, and Resume profiles) with RFC 4180 CSV / JSON exports.
          </p>
        </div>

        {/* Architecture Grid */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Engine Architecture
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-sunken/40 p-2.5 flex items-start gap-2.5">
              <Cpu size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-ink">Desktop Shell</div>
                <div className="text-[11px] text-muted">Electron • React 19 • JavaScript (ESM)</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-sunken/40 p-2.5 flex items-start gap-2.5">
              <FileText size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-ink">Ingestion Core</div>
                <div className="text-[11px] text-muted">Python 3.12 • FastAPI • PyMuPDF</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-sunken/40 p-2.5 flex items-start gap-2.5">
              <Database size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-ink">Storage & Search</div>
                <div className="text-[11px] text-muted">SQLite (WAL) • FTS5 Unicode Porter</div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-sunken/40 p-2.5 flex items-start gap-2.5">
              <Brain size={16} className="text-accent shrink-0 mt-0.5" />
              <div>
                <div className="font-medium text-ink">AI Intelligence</div>
                <div className="text-[11px] text-muted">Groq API • Map-Reduce • Pydantic</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Privacy Guarantees */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Security & Privacy
          </h4>
          <div className="space-y-1.5 text-xs text-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>Zero-knowledge frontend: IPC token & credentials never cross renderer boundary.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>Ephemeral local port selection and per-session authentication tokens.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
              <span>Document content is transmitted to AI only with explicit user consent.</span>
            </div>
          </div>
        </div>

        {/* Runtime info */}
        {info && (
          <div className="rounded-lg border border-border bg-sunken px-3 py-2 text-[11px] text-muted flex items-center justify-between font-mono">
            <span>{info.platform} ({info.arch})</span>
            <span>{info.isPackaged ? 'Production DMG' : 'Development Build'}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="primary" onClick={onClose} className="!h-8 !px-4 !text-xs">
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
