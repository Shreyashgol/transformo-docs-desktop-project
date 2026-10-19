import { CheckCircle2, Info, KeyRound, Palette, Shield, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, DefinitionList } from '../components/ui.jsx';

export function SettingsPage() {
  const [info, setInfo] = useState(null);
  const [aiConfig, setAiConfig] = useState(null);

  useEffect(() => {
    void window.transformo.app.getInfo().then(setInfo);
    void window.transformo.ai?.getSettings().then((res) => {
      if (res?.ok) setAiConfig(res.data);
    });
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Application configuration, AI provider settings, and system information.
        </p>
      </header>

      {/* AI Provider Section */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <KeyRound size={14} className="text-muted" aria-hidden />
            AI Provider
          </span>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent-soft p-2 text-accent">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Groq API</p>
                <p className="text-xs text-muted">Fast inference platform for open models</p>
              </div>
            </div>

            {aiConfig?.configured ? (
              <Badge tone="success">
                <CheckCircle2 size={12} className="mr-1 text-success" />
                Connected
              </Badge>
            ) : (
              <Badge tone="warning">Not Configured</Badge>
            )}
          </div>

          <DefinitionList
            items={[
              ['Provider', 'Groq (Official SDK)'],
              ['Active Model', aiConfig?.model || 'openai/gpt-oss-120b'],
              [
                'API Key',
                aiConfig?.configured ? (
                  <span className="font-mono text-xs text-ink bg-sunken px-2 py-0.5 rounded">
                    {aiConfig?.masked_key || 'Configured via .env'}
                  </span>
                ) : (
                  <span className="text-xs text-warning">Set GROQ_API_KEY in .env</span>
                ),
              ],
              [
                'Credential Storage',
                <span key="cs" className="text-xs text-muted">
                  Loaded from private local <code>.env</code> file. Never sent to frontend or written to database.
                </span>,
              ],
            ]}
          />

          <div className="flex items-start gap-2.5 rounded-lg border border-border bg-sunken p-3 text-xs text-muted">
            <Info size={15} className="mt-0.5 shrink-0 text-accent" />
            <p className="leading-relaxed">
              To change your Groq API key or model, update <code>GROQ_API_KEY</code> and <code>GROQ_MODEL</code> in <code>backend/.env</code>.
            </p>
          </div>
        </div>
      </Card>

      {/* Appearance Section */}
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

      {/* Privacy Section */}
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
            All original documents, SQLite databases, and full-text search indexes remain strictly on your Mac. Document text is only transmitted to Groq over HTTPS when you explicitly trigger an AI summary.
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

      {/* About Section */}
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
