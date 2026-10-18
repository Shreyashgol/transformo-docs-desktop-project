import { RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BackendStatusBadge } from '../components/BackendStatusBadge.jsx';
import { Badge, Button, Card, DefinitionList, Spinner } from '../components/ui.jsx';

export function OverviewPage({
  status,
  onRestart,
}) {
  const [info, setInfo] = useState(null);
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    void window.transformo.app.getInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (status?.state !== 'ready') return;
    let active = true;
    void window.transformo.backend.health().then((res) => {
      if (!active) return;
      if (res.ok) {
        setHealth(res.data);
        setHealthError(null);
      } else {
        setHealth(null);
        setHealthError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, [status?.state, status?.since]);

  const restart = async () => {
    setRestarting(true);
    try {
      await onRestart();
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted">
          Status of the local document engine and where Transformo Docs keeps your data.
        </p>
      </header>

      <Card
        title="Document engine"
        actions={
          <Button
            onClick={restart}
            busy={restarting}
            disabled={status?.state === 'starting'}
            icon={<RotateCw size={14} />}
          >
            Restart engine
          </Button>
        }
      >
        {status?.state === 'ready' && health ? (
          <DefinitionList
            items={[
              ['Status', <BackendStatusBadge key="s" state={status.state} />],
              ['Engine version', health.version],
              ['API version', String(health.api_version)],
              [
                'Storage',
                health.data_dir_writable ? (
                  <Badge key="w" tone="success">
                    Writable
                  </Badge>
                ) : (
                  <Badge key="w" tone="danger">
                    Not writable
                  </Badge>
                ),
              ],
            ]}
          />
        ) : status?.state === 'ready' && healthError ? (
          <p className="text-sm text-danger" role="alert">
            Health check failed: {healthError}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner label="Loading engine status" /> Checking engine status…
          </div>
        )}
      </Card>

      <Card title="Application">
        {info ? (
          <DefinitionList
            items={[
              ['Name', info.name],
              ['Version', info.version],
              ['Build', info.isPackaged ? 'Production' : 'Development'],
              ['Platform', `${info.platform} (${info.arch})`],
              ['Data location', <code key="d" className="font-mono text-xs">{info.userDataDir}</code>],
            ]}
          />
        ) : (
          <Spinner label="Loading application info" />
        )}
      </Card>
    </div>
  );
}
