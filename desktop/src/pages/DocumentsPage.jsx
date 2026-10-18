import { FileText, Search, Upload } from 'lucide-react';
import { Button, Card } from '../components/ui.jsx';

export function DocumentsPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your imported documents, search contents, and view extracted data.
          </p>
        </div>
        <Button variant="primary" icon={<Upload size={14} />} disabled>
          Import
        </Button>
      </header>

      {/* Search bar (functional search comes in Phase 03) */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Search documents…"
          disabled
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-4 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-accent-soft p-4 text-accent">
            <FileText size={28} aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium">No documents yet</p>
          <p className="mt-1.5 max-w-md text-xs text-muted">
            Import your first document to start extracting text, generating AI summaries, and
            performing structured field extraction. Supported formats: PDF, DOCX, and TXT.
          </p>
          <Button className="mt-5" variant="primary" icon={<Upload size={14} />} disabled>
            Import your first document
          </Button>
        </div>
      </Card>
    </div>
  );
}
