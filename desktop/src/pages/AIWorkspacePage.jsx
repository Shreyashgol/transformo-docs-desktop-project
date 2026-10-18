import { Brain, FileSearch, Sparkles } from 'lucide-react';
import { Card } from '../components/ui.jsx';

export function AIWorkspacePage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">AI Workspace</h1>
        <p className="mt-1 text-sm text-muted">
          Generate AI-powered summaries and extract structured data from your documents.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FeatureCard
          icon={Brain}
          title="AI Summaries"
          description="Generate concise, intelligent summaries of your documents using a configurable AI provider."
          status="Coming in Phase 04"
        />
        <FeatureCard
          icon={FileSearch}
          title="Structured Extraction"
          description="Extract validated fields into structured JSON — invoices, resumes, or custom schemas."
          status="Coming in Phase 05"
        />
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-accent-soft p-4 text-accent">
            <Sparkles size={28} aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium">AI features are not yet configured</p>
          <p className="mt-1.5 max-w-md text-xs text-muted">
            AI document summaries and structured extraction will be available once an AI provider is
            configured in Settings. Documents must be imported first.
          </p>
        </div>
      </Card>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  status,
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-accent-soft p-2 text-accent">
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
          <span className="mt-3 inline-block rounded-full bg-sunken px-2.5 py-0.5 text-xs font-medium text-subtle">
            {status}
          </span>
        </div>
      </div>
    </Card>
  );
}
