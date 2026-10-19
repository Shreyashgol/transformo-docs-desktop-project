import {
  AlertCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  FileUp,
  Filter,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';
import { Badge, Button, Card, Dialog, EmptyState, Spinner } from '../components/ui.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DocumentsPage() {
  const [data, setData] = useState({ items: [], total_count: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Single item delete confirmation
  const [docToDelete, setDocToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const res = await window.transformo.documents.list({
        q: params.q !== undefined ? params.q : searchQuery,
        ext: params.ext !== undefined ? params.ext : selectedFormat,
        status: params.status !== undefined ? params.status : selectedStatus,
        sort_by: params.sort_by !== undefined ? params.sort_by : sortBy,
        sort_order: params.sort_order !== undefined ? params.sort_order : sortOrder,
        page: params.page !== undefined ? params.page : page,
        page_size: pageSize,
      });
      if (res.ok) {
        setData(res.data);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedFormat, selectedStatus, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDocuments();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleSelectFiles = async () => {
    setError(null);
    setImporting(true);
    try {
      const res = await window.transformo.documents.selectAndImport();
      if (res.ok) {
        if (res.data.errors && res.data.errors.length > 0) {
          const firstErr = res.data.errors[0];
          setError(`${firstErr.filename}: ${firstErr.error}`);
        } else if (res.data.imported && res.data.imported.length > 0) {
          setSuccessMsg(`Successfully imported ${res.data.imported.length} document(s).`);
          setTimeout(() => setSuccessMsg(null), 3000);
        }
        await fetchDocuments();
        if (res.data.imported && res.data.imported.length > 0) {
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
      let count = 0;
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const res = await window.transformo.documents.uploadBuffer({
          name: file.name,
          buffer,
        });
        if (res.ok) {
          lastImported = res.data;
          count += 1;
        } else {
          setError(`${file.name}: ${res.error}`);
          break;
        }
      }
      if (count > 0) {
        setSuccessMsg(`Successfully imported ${count} document(s).`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      await fetchDocuments();
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

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;
    setDeleting(true);
    try {
      const res = await window.transformo.documents.delete(docToDelete.id);
      if (res.ok) {
        setDocToDelete(null);
        await fetchDocuments();
        setSuccessMsg('Document deleted successfully.');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setError(res.error);
      }
    } finally {
      setDeleting(false);
    }
  };

  const startIdx = data.total_count === 0 ? 0 : (data.page - 1) * pageSize + 1;
  const endIdx = Math.min(data.page * pageSize, data.total_count);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted">
            Manage your document library, run full-text search, and extract machine-readable data.
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

      {/* Success Notification */}
      {successMsg && (
        <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="hover:opacity-75">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Error alert */}
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
            className="text-accent underline font-semibold hover:opacity-80 cursor-pointer"
          >
            browse your Mac
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">
          Supported formats: <strong className="font-medium text-ink">PDF, DOCX, TXT</strong> • Maximum file size: <strong className="font-medium text-ink">50 MB</strong> per file
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar with clear */}
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Full-text search document contents or filenames…"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Format Filter */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <Filter size={13} className="text-subtle" />
            <select
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="">All Formats</option>
              <option value=".pdf">PDF</option>
              <option value=".docx">DOCX</option>
              <option value=".txt">TXT</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="completed">Ready</option>
            <option value="scanned">Scanned / Notice</option>
          </select>

          {/* Sort Control */}
          <div className="flex items-center gap-1 text-xs text-muted">
            <ArrowUpDown size={13} className="text-subtle" />
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="h-9 rounded-md border border-border bg-surface px-2.5 text-xs text-ink focus:border-accent focus:outline-none"
            >
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="filename:asc">Name (A–Z)</option>
              <option value="filename:desc">Name (Z–A)</option>
              <option value="size:desc">Size (largest)</option>
              <option value="size:asc">Size (smallest)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Document Library Table */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>Library</span>
            <span className="text-xs font-normal text-muted">({data.total_count} total)</span>
          </div>
        }
        className="!p-0"
      >
        {loading ? (
          <div className="flex h-44 items-center justify-center gap-2 text-sm text-muted">
            <Spinner label="Loading documents" /> Searching document library…
          </div>
        ) : data.total_count === 0 ? (
          searchQuery || selectedFormat || selectedStatus ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-sunken p-4 text-subtle">
                <Search size={24} aria-hidden />
              </div>
              <p className="mt-4 text-sm font-medium">No matching documents found</p>
              <p className="mt-1 text-xs text-muted">
                Try searching with different keywords or clearing your filters.
              </p>
              <Button
                className="mt-4"
                variant="secondary"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedFormat('');
                  setSelectedStatus('');
                  setPage(1);
                }}
              >
                Clear all filters
              </Button>
            </div>
          ) : (
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
          )
        ) : (
          <div className="divide-y divide-border">
            {data.items.map(({ metadata: doc, snippet }) => (
              <div
                key={doc.id}
                className="flex flex-col gap-2.5 px-5 py-4 transition-colors hover:bg-sunken/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="rounded-lg bg-accent-soft p-2 text-accent shrink-0">
                      <FileText size={18} aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{doc.original_filename}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{formatBytes(doc.file_size_bytes)}</span>
                        <span>•</span>
                        <span>{doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {doc.is_scanned ? (
                      <Badge tone="warning">Scanned / Notice</Badge>
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
                    <button
                      type="button"
                      onClick={() => setDocToDelete(doc)}
                      className="rounded-md p-1.5 text-subtle hover:bg-danger-soft hover:text-danger transition-colors cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Full-Text Search Snippet Highlight */}
                {snippet && (
                  <div className="ml-11 rounded-md bg-sunken px-3 py-1.5 font-mono text-xs text-muted border border-border/60">
                    <span className="text-[11px] font-semibold text-subtle uppercase mr-1.5">Match:</span>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: snippet.replace(
                          /<mark>/g,
                          '<mark class="bg-accent-soft text-accent font-semibold px-0.5 rounded">',
                        ),
                      }}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Pagination footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs text-muted bg-surface/50">
              <div>
                Showing <strong className="font-medium text-ink">{startIdx}</strong> to{' '}
                <strong className="font-medium text-ink">{endIdx}</strong> of{' '}
                <strong className="font-medium text-ink">{data.total_count}</strong> documents
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={data.page <= 1}
                  className="!h-7 !px-2 !text-xs"
                  icon={<ChevronLeft size={14} />}
                >
                  Previous
                </Button>
                <span className="font-medium text-ink px-1">
                  Page {data.page} of {data.total_pages}
                </span>
                <Button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={data.page >= data.total_pages}
                  className="!h-7 !px-2 !text-xs"
                  icon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Document Detail Modal */}
      <DocumentDetailModal
        doc={selectedDoc}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDeleted={() => {
          void fetchDocuments();
          setSuccessMsg('Document deleted successfully.');
          setTimeout(() => setSuccessMsg(null), 3000);
        }}
      />

      {/* Row Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        title="Delete Document"
        className="!max-w-md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink leading-relaxed">
            Are you sure you want to delete <strong className="font-semibold">{docToDelete?.original_filename}</strong>?
            This will permanently remove the document, its extracted contents, and its managed local file.
          </p>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              variant="secondary"
              onClick={() => setDocToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              busy={deleting}
            >
              Delete document
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
