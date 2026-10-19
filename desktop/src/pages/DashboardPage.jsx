import { BarChart3, Brain, Clock, FileText, Upload } from 'lucide-react';
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

export function DashboardPage() {
  const [stats, setStats] = useState({ total_documents: 0, scanned_documents: 0, ready_documents: 0 });
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshData = async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        window.transformo.documents.stats(),
        window.transformo.documents.list({ page: 1, page_size: 5, sort_by: 'created_at', sort_order: 'desc' }),
      ]);
      if (statsRes.ok) setStats(statsRes.data);
      if (listRes.ok) setRecentDocs(listRes.data.items.map((i) => i.metadata));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([
      window.transformo.documents.stats(),
      window.transformo.documents.list({ page: 1, page_size: 5, sort_by: 'created_at', sort_order: 'desc' }),
    ]).then(([statsRes, listRes]) => {
      if (!ignore) {
        if (statsRes.ok) setStats(statsRes.data);
        if (listRes.ok) setRecentDocs(listRes.data.items.map((i) => i.metadata));
        setLoading(false);
      }
    }).catch(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await window.transformo.documents.selectAndImport();
      if (res.ok && res.data.imported && res.data.imported.length > 0) {
        await refreshData();
        setSelectedDoc(res.data.imported[0]);
        setIsModalOpen(true);
      }
    } finally {
      setImporting(false);
    }
  };

  const handleViewDoc = async (id) => {
    const res = await window.transformo.documents.get(id);
    if (res.ok) {
      setSelectedDoc(res.data);
      setIsModalOpen(true);
    }
  };

  const statCards = [
    { label: 'Total Documents', value: String(stats.total_documents), icon: FileText, color: 'text-accent' },
    { label: 'AI Processed', value: '0', icon: Brain, color: 'text-success' },
    { label: 'Scanned / Notice', value: String(stats.scanned_documents), icon: Clock, color: 'text-warning' },
    { label: 'Extractions', value: '0', icon: BarChart3, color: 'text-muted' },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            A high-level overview of your persistent document library and machine-readable data.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Upload size={14} />}
          onClick={handleImport}
          busy={importing}
        >
          Import document
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="!py-0">
            <div className="flex items-center gap-3 py-4">
              <div className={`rounded-lg bg-sunken p-2 ${color}`}>
                <Icon size={18} aria-hidden />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Recent activity" className="!p-0">
        {loading ? (
          <div className="flex h-36 items-center justify-center gap-2 text-sm text-muted">
            <Spinner label="Loading activity" /> Loading activity…
          </div>
        ) : recentDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No activity yet"
            description="Import your first document to get started. Supported formats: PDF, DOCX, and TXT."
            action={
              <Button
                variant="primary"
                icon={<Upload size={14} />}
                onClick={handleImport}
                busy={importing}
              >
                Import document
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {recentDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-sunken/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-accent-soft p-1.5 text-accent">
                    <FileText size={16} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{doc.original_filename}</p>
                    <p className="text-xs text-muted">
                      {formatBytes(doc.file_size_bytes)} • {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={doc.is_scanned ? 'warning' : 'success'}>
                    {doc.is_scanned ? 'Scanned' : 'Ready'}
                  </Badge>
                  <Button
                    onClick={() => handleViewDoc(doc.id)}
                    className="!h-7 !px-2.5 !text-xs"
                  >
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Quick actions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleImport}
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-sunken cursor-pointer"
          >
            <div className="rounded-md bg-accent-soft p-1.5 text-accent">
              <FileText size={16} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Import document</p>
              <p className="mt-0.5 text-xs text-muted">Select PDF, DOCX, or TXT file</p>
            </div>
          </button>
          <div className="flex items-start gap-3 rounded-lg border border-border p-4 text-left opacity-60">
            <div className="rounded-md bg-sunken p-1.5 text-muted">
              <Brain size={16} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">AI summary</p>
              <p className="mt-0.5 text-xs text-muted">Available in Phase 04</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border p-4 text-left opacity-60">
            <div className="rounded-md bg-sunken p-1.5 text-muted">
              <BarChart3 size={16} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Extract fields</p>
              <p className="mt-0.5 text-xs text-muted">Available in Phase 05</p>
            </div>
          </div>
        </div>
      </Card>

      <DocumentDetailModal
        doc={selectedDoc}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onDeleted={() => {
          void refreshData();
        }}
      />
    </div>
  );
}
