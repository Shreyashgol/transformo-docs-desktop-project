import {
  Brain,
  FileStack,
  FileText,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { BackendState } from '../../shared/api';
import { BackendStatusBadge } from './BackendStatusBadge';
import { cx } from './ui';

export type PageId = 'dashboard' | 'documents' | 'ai-workspace' | 'settings' | 'overview';

const NAV: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'ai-workspace', label: 'AI Workspace', icon: Brain },
];

const BOTTOM_NAV: Array<{ id: PageId; label: string; icon: LucideIcon }> = [
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({
  page,
  onNavigate,
  backendState,
}: {
  page: PageId;
  onNavigate: (page: PageId) => void;
  backendState: BackendState | undefined;
}) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Space for the macOS traffic lights; also the window drag handle. */}
      <div className="titlebar-drag h-12 shrink-0" />
      <div className="flex items-center gap-2.5 px-5 pb-5">
        <div className="rounded-lg bg-accent p-1.5 text-on-accent">
          <FileStack size={18} aria-hidden />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Transformo Docs</span>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV.map(({ id, label, icon: Icon }) => (
          <NavButton
            key={id}
            active={page === id}
            onClick={() => onNavigate(id)}
            icon={Icon}
            label={label}
          />
        ))}

        <div className="mt-auto flex flex-col gap-0.5">
          {BOTTOM_NAV.map(({ id, label, icon: Icon }) => (
            <NavButton
              key={id}
              active={page === id}
              onClick={() => onNavigate(id)}
              icon={Icon}
              label={label}
            />
          ))}
        </div>
      </nav>
      <div className="border-t border-border px-5 py-3">
        <BackendStatusBadge state={backendState} />
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex h-9 items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium transition-colors',
        active
          ? 'bg-surface text-ink shadow-sm'
          : 'text-muted hover:bg-surface/60 hover:text-ink',
      )}
    >
      <Icon size={16} aria-hidden />
      {label}
    </button>
  );
}
