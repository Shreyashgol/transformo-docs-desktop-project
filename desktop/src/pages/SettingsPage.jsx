import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, DefinitionList } from '../components/ui.jsx';

/* ─────────────────────────────────────────────────────────
   Inline styles for the input + status indicator
──────────────────────────────────────────────────────────── */
const inputStyle = {
  width: '100%',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  padding: '0.45rem 2.4rem 0.45rem 0.65rem',
  borderRadius: '0.4rem',
  border: '1px solid var(--color-border)',
  background: 'var(--color-sunken)',
  color: 'var(--color-ink)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const GROQ_KEY_PREFIX = 'gsk_';
const MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

export function SettingsPage() {
  const [info, setInfo] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);

  /* form state */
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [showKey, setShowKey] = useState(false);

  /* async status */
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saveResult, setSaveResult] = useState(null); // null | { ok, msg }
  const [validateResult, setValidateResult] = useState(null); // null | { valid, error?, model? }

  const saveTimerRef = useRef(null);

  /* ── initial load ── */
  useEffect(() => {
    void window.transformo.app.getInfo().then(setInfo);
    void window.transformo.ai?.getSettings().then((res) => {
      if (res?.ok) {
        setAiConfig(res.data);
        setModel(res.data.model || 'openai/gpt-oss-120b');
      }
    });
  }, []);

  /* clear transient messages automatically */
  function flashSave(ok, msg) {
    setSaveResult({ ok, msg });
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveResult(null), 4000);
  }

  /* ── Save API Key & Model ── */
  async function handleSave(e) {
    e.preventDefault();
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) return;
    setSaving(true);
    setValidateResult(null);
    try {
      const res = await window.transformo.ai.updateSettings({
        api_key: trimmedKey,
        model: model || undefined,
      });
      if (res?.ok) {
        setAiConfig(res.data);
        setApiKey(''); // clear input after save (key is stored in backend)
        flashSave(true, 'API key saved and active.');
      } else {
        flashSave(false, res?.error || 'Save failed.');
      }
    } catch (err) {
      flashSave(false, String(err));
    } finally {
      setSaving(false);
    }
  }

  /* ── Test connection to Groq ── */
  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await window.transformo.ai.validate();
      setValidateResult(res?.data ?? { valid: false, error: res?.error ?? 'Unknown error' });
    } catch (err) {
      setValidateResult({ valid: false, error: String(err) });
    } finally {
      setValidating(false);
    }
  }

  /* ── Model change (saves immediately, no key change needed) ── */
  async function handleModelChange(newModel) {
    setModel(newModel);
    setValidateResult(null);
    if (aiConfig?.configured) {
      try {
        const res = await window.transformo.ai.updateSettings({ model: newModel });
        if (res?.ok) setAiConfig(res.data);
      } catch (_) { /* ignore */ }
    }
  }

  const keyLooksValid = apiKey.trim().startsWith(GROQ_KEY_PREFIX) && apiKey.trim().length > 20;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Application configuration, AI provider settings, and system information.
        </p>
      </header>

      {/* ── AI Provider Card ── */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <KeyRound size={14} className="text-muted" aria-hidden />
            AI Provider
          </span>
        }
      >
        <div className="flex flex-col gap-5">
          {/* header row */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft p-2 text-accent">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Groq API</p>
                <p className="text-xs text-muted">Fast inference for open models</p>
              </div>
            </div>
            {aiConfig?.configured ? (
              <Badge tone="success">
                <CheckCircle2 size={12} className="mr-1 text-success" />
                Configured
              </Badge>
            ) : (
              <Badge tone="warning">
                <AlertTriangle size={12} className="mr-1" />
                Not configured
              </Badge>
            )}
          </div>

          {/* current key info */}
          {aiConfig?.configured && (
            <DefinitionList
              items={[
                [
                  'Active key',
                  <span key="ak" className="font-mono text-xs bg-sunken px-2 py-0.5 rounded text-ink">
                    {aiConfig.masked_key || '••••••••'}
                  </span>,
                ],
                ['Active model', aiConfig.model || '—'],
              ]}
            />
          )}

          {/* ── NEW USER SETUP / KEY CHANGE FORM ── */}
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <p className="text-xs font-medium text-ink">
              {aiConfig?.configured ? 'Update Groq API key' : 'Enter your Groq API key to enable AI features'}
            </p>

            {/* key input */}
            <div style={{ position: 'relative' }}>
              <input
                id="settings-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setValidateResult(null); setSaveResult(null); }}
                placeholder="gsk_••••••••••••••••••••••••••••••••••••••••••••••••••••"
                autoComplete="off"
                spellCheck={false}
                style={{
                  ...inputStyle,
                  borderColor: apiKey
                    ? keyLooksValid ? 'var(--color-success)' : 'var(--color-warning)'
                    : 'var(--color-border)',
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted)',
                  padding: '0.1rem',
                }}
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {/* validation hint */}
            {apiKey && !keyLooksValid && (
              <p className="text-xs text-warning flex items-center gap-1">
                <AlertTriangle size={12} />
                Groq keys usually start with <code>gsk_</code>
              </p>
            )}

            {/* model selector */}
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-model" className="text-xs font-medium text-ink">Model</label>
              <select
                id="settings-model"
                value={model}
                onChange={(e) => handleModelChange(e.target.value)}
                style={{
                  ...inputStyle,
                  padding: '0.45rem 0.65rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* action row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="submit"
                variant="primary"
                icon={<Save size={13} />}
                busy={saving}
                disabled={!keyLooksValid || saving}
                id="settings-save-btn"
              >
                Save key
              </Button>

              {aiConfig?.configured && (
                <Button
                  type="button"
                  variant="secondary"
                  icon={validating ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                  busy={validating}
                  disabled={validating}
                  onClick={handleValidate}
                  id="settings-test-btn"
                >
                  Test connection
                </Button>
              )}
            </div>

            {/* save result banner */}
            {saveResult && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: saveResult.ok ? 'var(--color-success-soft, #d1fae5)' : 'var(--color-danger-soft, #fee2e2)',
                  color: saveResult.ok ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${saveResult.ok ? 'var(--color-success)' : 'var(--color-danger)'}`,
                }}
              >
                {saveResult.ok
                  ? <CheckCircle2 size={13} />
                  : <AlertTriangle size={13} />
                }
                {saveResult.msg}
              </div>
            )}

            {/* validate result banner */}
            {validateResult && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: validateResult.valid ? 'var(--color-success-soft, #d1fae5)' : 'var(--color-danger-soft, #fee2e2)',
                  color: validateResult.valid ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${validateResult.valid ? 'var(--color-success)' : 'var(--color-danger)'}`,
                }}
              >
                {validateResult.valid
                  ? <><Wifi size={13} /> Connected — model <strong>{validateResult.model}</strong> is responding.</>
                  : <><WifiOff size={13} /> {validateResult.error}</>
                }
              </div>
            )}
          </form>

          {/* info tip */}
          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-sunken p-3 text-xs text-muted">
            <Info size={15} className="mt-0.5 shrink-0 text-accent" />
            <p className="leading-relaxed">
              Get a free key at{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-2"
              >
                console.groq.com/keys
              </a>
              . Your key is stored only in your local app data — never uploaded.
            </p>
          </div>
        </div>
      </Card>

      {/* ── Appearance Card ── */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Palette size={14} className="text-muted" aria-hidden />
            Appearance
          </span>
        }
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="mt-0.5 text-xs text-muted">
              Follows your system preference automatically.
            </p>
          </div>
          <Badge tone="accent">System</Badge>
        </div>
      </Card>

      {/* ── Privacy Card ── */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Shield size={14} className="text-muted" aria-hidden />
            Privacy &amp; Data
          </span>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted text-xs leading-relaxed">
            All original documents, SQLite databases, and full-text search indexes remain strictly on your Mac.
            Document text is only transmitted to Groq over HTTPS when you explicitly trigger an AI summary.
          </p>
          {info && (
            <DefinitionList
              items={[
                [
                  'Data location',
                  <code key="d" className="font-mono text-xs">
                    {info.userDataDir}
                  </code>,
                ],
              ]}
            />
          )}
        </div>
      </Card>

      {/* ── About Card ── */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Info size={14} className="text-muted" aria-hidden />
            About
          </span>
        }
      >
        {info ? (
          <DefinitionList
            items={[
              ['Application', info.name],
              ['Version', info.version],
              ['Build', info.isPackaged ? 'Production' : 'Development'],
              ['Platform', `${info.platform} (${info.arch})`],
            ]}
          />
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>
    </div>
  );
}
