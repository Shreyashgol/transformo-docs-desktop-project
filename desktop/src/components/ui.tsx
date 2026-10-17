import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-border hover:bg-sunken',
  ghost: 'text-muted hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({
  variant = 'secondary',
  busy = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cx(
        'inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
    >
      {busy ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <LoaderCircle
      size={size}
      className="animate-spin"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'status' : undefined}
    />
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-xl border border-border bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-6 gap-y-2.5 text-sm">
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted">{term}</dt>
          <dd className="selectable min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Dialog built on the native <dialog> element for proper focus trapping
 * and backdrop behaviour. Uses `showModal()` so ESC closes it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className={cx(
        'w-full max-w-md rounded-xl border border-border bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}

/** Consistent empty state for list or content areas. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof LoaderCircle;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-sunken p-4 text-subtle">
        <Icon size={28} aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-md text-xs text-muted">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

