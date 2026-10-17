import { RotateCw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { BackendStatus } from '../../shared/api';
import { Button } from './ui';

/** Full-pane error state shown when the document engine fails to start or crashes. */
export function BackendFailure({
  status,
  onRetry,
}: {
  status: BackendStatus;
  onRetry: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try {
      await onRetry();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 py-16" role="alert">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-danger-soft p-2.5 text-danger">
          <TriangleAlert size={22} aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">The document engine isn’t running</h1>
          <p className="selectable mt-1 text-sm break-words text-muted">
            {status.error ?? 'An unknown error occurred.'}
          </p>
        </div>
      </div>
      <div>
        <Button variant="primary" busy={busy} onClick={retry} icon={<RotateCw size={14} />}>
          Try again
        </Button>
      </div>
      {status.logTail && status.logTail.length > 0 && (
        <details className="rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-muted">
            Technical details
          </summary>
          <pre className="selectable max-h-72 overflow-auto border-t border-border bg-sunken px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted">
            {status.logTail.join('\n')}
          </pre>
        </details>
      )}
    </div>
  );
}
