import type { ReactNode } from 'react';

export function Centered({ children }: { children: ReactNode }) {
  return <main className="centered">{children}</main>;
}
