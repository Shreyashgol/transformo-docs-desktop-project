import {
  ArrowRight,
  Brain,
  Clock,
  Database,
  FileSpreadsheet,
  FileText,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui.jsx';

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState({
    total_documents: 0,
    scanned_documents: 0,
    ready_documents: 0,
    summaries_generated: 0,
    extractions_generated: 0,
    total_storage_bytes: 0,
    pdf_count: 0,
    docx_count: 0,
    txt_count: 0,
  });
  const [recentDocs, setRecentDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [statsRes, listRes] = await Promise.all([
        window.transformo.documents.stats(),
        window.transformo.documents.list({ page: 1, page_size: 6, sort_by: 'created_at', sort_order: 'desc' }),
      ]);
      if (statsRes.ok) setStats(statsRes.data);
      if (listRes.ok) setRecentDocs(listRes.data.items.map((i) => i.metadata));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      window.transformo.documents.stats(),
      window.transformo.documents.list({ page: 1, page_size: 6, sort_by: 'created_at', sort_order: 'desc' }),
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
    {
      label: 'Library Documents',
      value: String(stats.total_documents),
      sublabel: `${formatBytes(stats.total_storage_bytes)} managed`,
      icon: FileText,
      color: 'text-accent',
      bg: 'bg-accent-soft',
    },
    {
      label: 'AI Summaries',
      value: String(stats.summaries_generated || 0),
      sublabel: 'Executive overviews',
      icon: Brain,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Structured Extractions',
      value: String(stats.extractions_generated || 0),
      sublabel: 'JSON / CSV exportable',
      icon: FileSpreadsheet,
      color: 'text-sky-500',
      bg: 'bg-sky-500/10',
    },
    {
      label: 'Managed Storage',
      value: formatBytes(stats.total_storage_bytes),
      sublabel: 'Local SQLite WAL',
      icon: Database,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Top Welcome & Ingestion Action */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            High-level overview of your local document library, search index, and AI intelligence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => onNavigate?.('documents')}
            icon={<Search size={14} />}
          >
            Search Library
          </Button>
          <Button
            variant="primary"
            icon={<Upload size={14} />}
            onClick={handleImport}
            busy={importing}
          >
            Import Document
          </Button>
        </div>
      </header>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, value, sublabel, icon: Icon, color, bg }) => (
          <Card key={label} className="!py-0">
            <div className="flex items-center gap-3.5 py-4">
              <div className={`rounded-xl p-2.5 ${bg} ${color}`}>
                <Icon size={20} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-ink">{value}</p>
                <p className="text-xs font-semibold text-ink/80 truncate">{label}</p>
                <p className="text-[11px] text-muted truncate">{sublabel}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Format Breakdown & Library Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-sunken/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge tone="accent">PDF</Badge>
            <span className="text-xs text-muted">Documents</span>
          </div>
          <span className="font-bold text-sm text-ink tabular-nums">{stats.pdf_count || 0}</span>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">DOCX</Badge>
            <span className="text-xs text-muted">Word Files</span>
          </div>
          <span className="font-bold text-sm text-ink tabular-nums">{stats.docx_count || 0}</span>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge tone="neutral">TXT</Badge>
            <span className="text-xs text-muted">Plain Text</span>
          </div>
          <span className="font-bold text-sm text-ink tabular-nums">{stats.txt_count || 0}</span>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={13} className="text-amber-500" />
            <span className="text-xs text-muted">Scanned Notices</span>
          </div>
          <span className="font-bold text-sm text-ink tabular-nums">{stats.scanned_documents || 0}</span>
        </div>
      </div>

      {/* Quick Action Cards */}
      <Card title="Quick Actions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={handleImport}
            className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:bg-sunken hover:border-border-strong cursor-pointer group"
          >
            <div className="rounded-lg bg-accent-soft p-2 text-accent group-hover:scale-105 transition-transform">
              <Upload size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Import Documents</p>
                <ArrowRight size={13} className="text-muted group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="mt-0.5 text-xs text-muted">Ingest PDF, DOCX, or TXT into local library</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('documents')}
            className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:bg-sunken hover:border-border-strong cursor-pointer group"
          >
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500 group-hover:scale-105 transition-transform">
              <Search size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Full-Text Search</p>
                <ArrowRight size={13} className="text-muted group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="mt-0.5 text-xs text-muted">FTS5 SQLite search with snippet highlighting</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('ai-workspace')}
            className="flex items-start gap-3 rounded-xl border border-border p-4 text-left transition-all hover:bg-sunken hover:border-border-strong cursor-pointer group"
          >
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-500 group-hover:scale-105 transition-transform">
              <Sparkles size={18} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">AI Document Intelligence</p>
                <ArrowRight size={13} className="text-muted group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="mt-0.5 text-xs text-muted">Executive summaries & structured extractions</p>
            </div>
          </button>
        </div>
      </Card>

      {/* Recent Activity List */}
      <Card title="Recent Documents" className="!p-0">
        {loading ? (
          <div className="flex h-36 items-center justify-center gap-2 text-sm text-muted">
            <Spinner label="Loading activity" /> Loading activity…
          </div>
        ) : recentDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents in library yet"
            description="Import your first PDF, DOCX, or TXT file to start searching and analyzing."
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
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-sunken/40"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="rounded-lg bg-accent-soft p-2 text-accent">
                    <FileText size={16} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink" title={doc.original_filename}>
                      {doc.original_filename}
                    </p>
                    <p className="text-xs text-muted">
                      {formatBytes(doc.file_size_bytes)} • {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} • {(doc.extension || '').replace('.', '').toUpperCase()}
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

      {/* Document Detail Modal */}
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
