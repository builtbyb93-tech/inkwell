import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p>{children}</p>
    </div>
  );
}
