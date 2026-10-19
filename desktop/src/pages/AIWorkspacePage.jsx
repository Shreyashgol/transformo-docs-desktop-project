import {
  Brain,
  FileSearch,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { DocumentDetailModal } from '../components/DocumentDetailModal.jsx';
import { Badge, Button, Card, EmptyState, Spinner } from '../components/ui.jsx';

export function AIWorkspacePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState(null);

  const refreshData = async () => {
    try {
      const [docsRes, configRes] = await Promise.all([
        window.transformo.documents.list({ page: 1, page_size: 50 }),
        window.transformo.ai.getSettings(),
      ]);
      if (docsRes.ok) setDocuments(docsRes.data.items.map((i) => i.metadata));
      if (configRes.ok) setAiConfig(configRes.data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let ignore = false;
    Promise.all([
      window.transformo.documents.list({ page: 1, page_size: 50 }),
      window.transformo.ai.getSettings(),
    ]).then(([docsRes, configRes]) => {
      if (!ignore) {
        if (docsRes.ok) setDocuments(docsRes.data.items.map((i) => i.metadata));
        if (configRes.ok) setAiConfig(configRes.data);
        setLoading(false);
      }
    }).catch(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const handleOpenSummary = async (docId) => {
    const res = await window.transformo.documents.get(docId);
    if (res.ok) {
      setSelectedDoc(res.data);
      setIsModalOpen(true);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Workspace</h1>
          <p className="mt-1 text-sm text-muted">
            Generate intelligent summaries and extract machine-readable insights using Groq.
          </p>
        </div>
        {aiConfig?.configured && (
          <Badge tone="accent">
            <span className="size-1.5 rounded-full bg-accent mr-1" />
            Groq Active ({aiConfig.model})
          </Badge>
        )}
      </header>

      {/* Feature capabilities */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="!p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-accent-soft p-2.5 text-accent">
              <Brain size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">AI Summaries</h3>
                <Badge tone="success">Active</Badge>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Concise executive overviews, key takeaways, and dates/figures powered by Groq.
              </p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-start gap-3 opacity-70">
            <div className="rounded-lg bg-sunken p-2.5 text-muted">
              <FileSearch size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Structured Extraction</h3>
                <Badge tone="neutral">Phase 05</Badge>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Extract structured fields into JSON/CSV for invoices, receipts, and resumes.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Documents ready for AI */}
      <Card title={`Documents available for AI analysis (${documents.length})`} className="!p-0">
        {loading ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted">
            <Spinner label="Loading documents" /> Loading library…
          </div>
        ) : documents.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No documents to analyze"
            description="Import PDF, DOCX, or TXT documents from the Documents page to generate AI summaries."
          />
        ) : (
          <div className="divide-y divide-border">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-sunken/40"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="rounded-lg bg-accent-soft p-2 text-accent">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{doc.original_filename}</p>
                    <p className="text-xs text-muted">
                      {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} • {(doc.extension || '').replace('.', '').toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={() => handleOpenSummary(doc.id)}
                    icon={<Sparkles size={13} />}
                    className="!h-7 !px-2.5 !text-xs"
                    disabled={doc.is_scanned}
                  >
                    AI Summary
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Document Detail Modal with initialTab='summary' */}
      <DocumentDetailModal
        doc={selectedDoc}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialTab="summary"
        onDeleted={() => {
          void refreshData();
        }}
      />
    </div>
  );
}
