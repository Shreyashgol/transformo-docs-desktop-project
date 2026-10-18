import { Info, KeyRound, Palette, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card, DefinitionList } from '../components/ui.jsx';

export function SettingsPage() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    void window.transformo.app.getInfo().then(setInfo);
  }, []);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Application configuration, AI provider settings, and system information.
        </p>
      </header>

      <Card
        title={
          <span className="flex items-center gap-2">
            <KeyRound size={14} className="text-muted" aria-hidden />
            AI Provider
          </span>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-sunken p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="text-xs leading-relaxed text-muted">
            <p className="font-medium text-ink">AI provider configuration is not yet available.</p>
            <p className="mt-1">
              This will be added in Phase 04 (AI Summaries). You will be able to configure a Gemini
              API key or another supported provider here.
            </p>
          </div>
        </div>
      </Card>

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

      <Card
        title={
          <span className="flex items-center gap-2">
            <Shield size={14} className="text-muted" aria-hidden />
            Privacy &amp; Data
          </span>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            All documents and extracted data are stored locally on your Mac. Document text is only
            sent to an external AI provider when you explicitly start an AI action and have accepted
            the privacy notice.
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
