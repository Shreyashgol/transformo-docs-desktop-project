import {
  AlertCircle,
  FileText,
  FileUp,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let ignore = false;
    window.transformo.documents.list().then((res) => {
      if (!ignore) {
        if (res.ok) setDocuments(res.data);
        else setError(res.error);
        setLoading(false);
      }
    }).catch((err) => {
      if (!ignore) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
    };
  }, []);

  const refreshDocuments = async () => {
    try {
      const res = await window.transformo.documents.list();
      if (res.ok) setDocuments(res.data);
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSelectFiles = async () => {
    setError(null);
    setImporting(true);
    try {
      const res = await window.transformo.documents.selectAndImport();
      if (res.ok) {
        if (res.data.errors && res.data.errors.length > 0) {
          const firstErr = res.data.errors[0];
          setError(`${firstErr.filename}: ${firstErr.error}`);
        }
        await refreshDocuments();
        if (res.data.imported && res.data.imported.length > 0) {
          // Open preview of the first imported document
          setSelectedDoc(res.data.imported[0]);
          setIsModalOpen(true);
        }
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setImporting(true);
    try {
      let lastImported = null;
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const res = await window.transformo.documents.uploadBuffer({
          name: file.name,
          buffer,
        });
        if (res.ok) {
          lastImported = res.data;
        } else {
          setError(`${file.name}: ${res.error}`);
          break;
        }
      }
      await refreshDocuments();
      if (lastImported) {
        setSelectedDoc(lastImported);
        setIsModalOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  const handleViewDetail = async (docId) => {
    try {
      const res = await window.transformo.documents.get(docId);
      if (res.ok) {
        setSelectedDoc(res.data);
        setIsModalOpen(true);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const filteredDocs = documents.filter((doc) =>
    doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your document library, extract text, and view document details.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Upload size={14} />}
          onClick={handleSelectFiles}
          busy={importing}
        >
          Import documents
        </Button>
      </header>

      {/* Error alert if any */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <div className="flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-danger hover:opacity-75"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Drag & Drop Import Banner */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
          isDragging
            ? 'border-accent bg-accent-soft/40 scale-[1.01]'
            : 'border-border bg-surface hover:border-accent/50'
        }`}
      >
        <div className="rounded-full bg-accent-soft p-3 text-accent mb-2">
          <FileUp size={20} aria-hidden />
        </div>
        <p className="text-sm font-medium text-ink">
          Drag &amp; drop PDF, DOCX, or TXT files here, or{' '}
          <button
            type="button"
            onClick={handleSelectFiles}
            className="text-accent underline font-semibold hover:opacity-80"
          >
            browse your Mac
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">
          Supported formats: <strong className="font-medium text-ink">PDF, DOCX, TXT</strong> • Maximum file size: <strong className="font-medium text-ink">50 MB</strong> per file
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter documents by name…"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-4 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Documents List */}
      <Card title={`Library (${documents.length})`} className="!p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
            <Spinner label="Loading documents" /> Loading library…
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents imported yet"
            description="Import your first PDF, DOCX, or TXT document to begin extracting text and viewing machine-readable data."
            action={
              <Button
                variant="primary"
                icon={<Upload size={14} />}
                onClick={handleSelectFiles}
                busy={importing}
              >
                Import your first document
              </Button>
            }
          />
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No documents matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-sunken/50"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="rounded-lg bg-accent-soft p-2 text-accent">
                    <FileText size={18} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{doc.original_filename}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span>{formatBytes(doc.file_size_bytes)}</span>
                      <span>•</span>
                      <span>{doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                      <span>•</span>
                      <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {doc.is_scanned ? (
                    <Badge tone="warning">Scanned / No text</Badge>
                  ) : (
                    <Badge tone="success">Ready</Badge>
                  )}
                  <Badge tone="neutral">{(doc.extension || '').replace('.', '').toUpperCase()}</Badge>
                  <Button
                    onClick={() => handleViewDetail(doc.id)}
                    className="!h-7 !px-2.5 !text-xs"
                  >
                    View text
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Document Detail Modal */}
      <DocumentDetailModal
        doc={selectedDoc}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
