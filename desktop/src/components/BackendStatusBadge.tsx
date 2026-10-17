import type { BackendState } from '../../shared/api';
import { Badge } from './ui';

const LABELS: Record<BackendState, { text: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  ready: { text: 'Engine ready', tone: 'success' },
  starting: { text: 'Starting engine…', tone: 'warning' },
  failed: { text: 'Engine unavailable', tone: 'danger' },
  stopped: { text: 'Engine stopped', tone: 'neutral' },
};

export function BackendStatusBadge({ state }: { state: BackendState | undefined }) {
  const label = LABELS[state ?? 'starting'];
  return (
    <span role="status" aria-live="polite">
      <Badge tone={label.tone}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {label.text}
      </Badge>
    </span>
  );
}
