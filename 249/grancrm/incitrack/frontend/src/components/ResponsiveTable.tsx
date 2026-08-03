import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

/** Wraps a wide table in overflow-x:auto so it scrolls on narrow viewports. */
export function ResponsiveTable({ children }: Props) {
  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      {children}
    </div>
  );
}
