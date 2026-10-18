import { FileText, Brain, Clock, BarChart3 } from 'lucide-react';
import { Card } from '../components/ui.jsx';

const stats = [
  { label: 'Total Documents', value: '0', icon: FileText, color: 'text-accent' },
  { label: 'AI Processed', value: '0', icon: Brain, color: 'text-success' },
  { label: 'Recent Imports', value: '0', icon: Clock, color: 'text-warning' },
  { label: 'Extractions', value: '0', icon: BarChart3, color: 'text-muted' },
];

export function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          A high-level overview of your document library and AI processing.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
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

      <Card title="Recent activity">
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="rounded-full bg-sunken p-3 text-subtle">
            <FileText size={24} aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium">No activity yet</p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            Import your first document to get started. Supported formats: PDF, DOCX, and TXT.
          </p>
        </div>
      </Card>

      <Card title="Quick actions">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <QuickAction
            icon={FileText}
            title="Import document"
            description="Upload a PDF, DOCX, or TXT file"
            disabled
          />
          <QuickAction
            icon={Brain}
            title="AI summary"
            description="Generate an AI-powered summary"
            disabled
          />
          <QuickAction
            icon={BarChart3}
            title="Extract fields"
            description="Extract structured data from documents"
            disabled
          />
        </div>
      </Card>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  disabled,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="rounded-md bg-accent-soft p-1.5 text-accent">
        <Icon size={16} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </button>
  );
}
