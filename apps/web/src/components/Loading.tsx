import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <div className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  illustration = true,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  /** Show Harbor empty-dock illustration (default on). */
  illustration?: boolean;
}) {
  return (
    <div className="empty-state">
      {illustration ? (
        <img
          className="empty-illustration"
          src="/brand/harbor-empty.png"
          alt=""
          width={280}
          height={210}
          decoding="async"
          draggable={false}
        />
      ) : null}
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}
