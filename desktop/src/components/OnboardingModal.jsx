import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Save,
  Sparkles,
  Zap,
  FileText,
  Brain,
  Shield,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui.jsx';

const GROQ_KEY_PREFIX = 'gsk_';

/**
 * High-visibility onboarding modal that appears on launch to guide users
 * on how to configure their Groq API key to unlock the document analyzing features.
 */
export function OnboardingModal({ open, onClose, onNavigateSettings }) {
  const [step, setStep] = useState(0); // 0 = welcome & features, 1 = enter key
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // null | { ok, msg }

  const keyLooksValid = apiKey.trim().startsWith(GROQ_KEY_PREFIX) && apiKey.trim().length > 20;

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSaveKey(e) {
    e.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await window.transformo.ai.updateSettings({
        api_key: trimmedKey,
        model: 'openai/gpt-oss-120b',
      });
      if (res?.ok) {
        setSaveResult({ ok: true, msg: 'API key saved successfully! AI features are now active.' });
        setTimeout(() => onClose(), 1500);
      } else {
        setSaveResult({ ok: false, msg: res?.error || 'Failed to save. Please try again.' });
      }
    } catch (err) {
      setSaveResult({ ok: false, msg: String(err) });
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    onClose();
  }

  function handleGoToSettings() {
    onClose();
    onNavigateSettings();
  }

  const features = [
    {
      icon: Brain,
      title: 'AI Document Summarization',
      desc: 'Generate executive, technical, or bullet-point summaries of long documents.',
      requiresKey: true,
    },
    {
      icon: Zap,
      title: 'Smart Structured Extraction',
      desc: 'Extract key fields, invoice totals, resume data, and schemas automatically.',
      requiresKey: true,
    },
    {
      icon: FileText,
      title: 'High-Throughput Ingestion',
      desc: 'PDF, DOCX, and TXT parsing with offline SQLite FTS5 search.',
      requiresKey: false,
    },
    {
      icon: Shield,
      title: 'Privacy & Local Storage',
      desc: 'Your files stay local. AI inference runs securely via Groq LPU.',
      requiresKey: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={handleSkip}
      />

      {/* Modal Dialog */}
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface text-ink shadow-2xl transition-all"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--color-border)',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleSkip}
          className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* ── Step 0: Welcome & How to use Analyzing Features ── */}
        {step === 0 && (
          <div className="flex flex-col">
            {/* Header banner */}
            <div
              className="relative overflow-hidden px-7 pb-6 pt-7 border-b border-border"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-soft) 0%, var(--color-surface) 100%)',
              }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex size-13 items-center justify-center rounded-2xl shadow-md shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  <Sparkles size={26} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent border border-accent/20 mb-1">
                    <Sparkles size={11} /> First-Time Setup
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-ink">
                    Welcome to Transformo Docs
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    Unlock document intelligence, summarization & smart extractions
                  </p>
                </div>
              </div>
            </div>

            {/* Explainer Callout */}
            <div className="px-7 pt-5 pb-1">
              <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm"
                    style={{
                      background: 'var(--color-accent)',
                      color: 'var(--color-on-accent)',
                    }}
                  >
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink">
                      Groq API Key Required for Document Analyzing
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      Transformo uses Groq's high-speed LPU engine for AI summarization and structured data extraction.
                      To start analyzing documents, simply provide a free Groq API key.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Features List */}
            <div className="px-7 pt-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2.5">
                Application Features
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {features.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-border p-3 flex flex-col gap-1.5"
                    style={{
                      background: f.requiresKey ? 'var(--color-sunken)' : 'var(--color-surface)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <f.icon
                        size={15}
                        className={f.requiresKey ? 'text-accent' : 'text-success'}
                      />
                      <span className="text-xs font-semibold text-ink leading-tight">{f.title}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted">{f.desc}</p>
                    {f.requiresKey && (
                      <span className="text-[10px] font-medium text-warning flex items-center gap-1 mt-auto pt-1">
                        <KeyRound size={10} /> Requires API Key
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-7 py-4 mt-3 bg-sunken/30">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-muted hover:text-ink transition-colors underline underline-offset-2"
              >
                Skip for now
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={handleGoToSettings}
                  className="!text-xs"
                >
                  Configure in Settings
                </Button>
                <Button
                  variant="primary"
                  icon={<ArrowRight size={14} />}
                  onClick={() => setStep(1)}
                  className="!text-xs"
                >
                  Enter Key Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Enter Key Inline ── */}
        {step === 1 && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-7 py-4 bg-sunken/40">
              <div
                className="flex size-10 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-hover))',
                  color: 'var(--color-on-accent)',
                }}
              >
                <KeyRound size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-ink">Enter Your Groq API Key</h2>
                <p className="text-xs text-muted">Stored securely on your Mac — never shared</p>
              </div>
            </div>

            <form onSubmit={handleSaveKey} className="px-7 py-5 flex flex-col gap-4">
              {/* How to get key */}
              <div className="rounded-xl border border-border bg-sunken/60 p-3.5 text-xs text-muted leading-relaxed">
                <p className="font-semibold text-ink mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-accent" />
                  How to get your free key (takes ~30 seconds):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px]">
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent font-medium underline underline-offset-2 inline-flex items-center gap-0.5"
                    >
                      console.groq.com/keys <ExternalLink size={10} />
                    </a>
                  </li>
                  <li>Sign in or sign up with Google / GitHub</li>
                  <li>Click <strong>"Create API Key"</strong></li>
                  <li>Paste the key below and click Save</li>
                </ol>
              </div>

              {/* Key input */}
              <div>
                <label htmlFor="onboarding-api-key" className="text-xs font-medium text-ink block mb-1.5">
                  Groq API Key
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="onboarding-api-key"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setSaveResult(null);
                    }}
                    placeholder="gsk_••••••••••••••••••••••••••••••••"
                    autoComplete="off"
                    autoFocus
                    spellCheck={false}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      padding: '0.65rem 2.6rem 0.65rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: `2px solid ${
                        apiKey
                          ? keyLooksValid
                            ? 'var(--color-success)'
                            : 'var(--color-warning)'
                          : 'var(--color-border)'
                      }`,
                      background: 'var(--color-sunken)',
                      color: 'var(--color-ink)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-muted)',
                      padding: '0.2rem',
                    }}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {apiKey && !keyLooksValid && (
                  <p className="mt-1.5 text-xs text-warning flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Groq API keys start with <code className="font-mono">gsk_</code>
                  </p>
                )}
              </div>

              {/* Result banner */}
              {saveResult && (
                <div
                  className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-medium"
                  style={{
                    background: saveResult.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                    color: saveResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
                    border: `1px solid ${saveResult.ok ? 'var(--color-success)' : 'var(--color-danger)'}`,
                  }}
                >
                  {saveResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {saveResult.msg}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(0);
                    setSaveResult(null);
                  }}
                  className="text-xs text-muted hover:text-ink transition-colors"
                >
                  ← Back to overview
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-xs text-muted hover:text-ink transition-colors underline underline-offset-2"
                  >
                    Skip
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={<Save size={14} />}
                    busy={saving}
                    disabled={!keyLooksValid || saving}
                    className="!text-xs !h-9 !px-5"
                  >
                    Save & Activate
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
