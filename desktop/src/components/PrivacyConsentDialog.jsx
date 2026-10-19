import { Shield, Sparkles } from 'lucide-react';
import { Button, Dialog } from './ui.jsx';

export function PrivacyConsentDialog({
  open,
  onClose,
  onConsent,
  model = 'openai/gpt-oss-120b',
}) {
  const handleAccept = () => {
    localStorage.setItem('transformo_ai_consent', 'true');
    window.transformo?.ai?.setConsent(true);
    onConsent();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="AI Processing Privacy Notice"
      className="!max-w-md"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent-soft/40 p-3.5 text-xs text-ink">
          <Sparkles size={20} className="shrink-0 text-accent mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-semibold text-ink">Cloud-assisted AI Intelligence</p>
            <p className="mt-1 text-muted">
              Document summarization uses the configured <strong className="font-medium text-ink">Groq API</strong> with model <code className="font-mono text-ink bg-sunken px-1 py-0.5 rounded">{model}</code>.
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-muted">
          <div className="flex items-start gap-2">
            <Shield size={14} className="shrink-0 text-accent mt-0.5" />
            <p>
              Only the extracted text of the document you explicitly choose to analyze is transmitted over encrypted HTTPS to Groq.
            </p>
          </div>
          <p>
            Your original files, SQLite database, and search indexes remain entirely on your local Mac under your Application Support directory.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAccept}>
            Accept &amp; Continue
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
