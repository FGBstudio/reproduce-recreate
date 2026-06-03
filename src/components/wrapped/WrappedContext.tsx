import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';

export type WrappedScope =
  | { kind: 'site'; siteId: string; siteName: string; areaM2?: number | null }
  | { kind: 'aggregate'; label: string; sites: { id: string; name: string; region?: string | null; brandName?: string | null; areaM2?: number | null }[] }
  | { kind: 'admin-global'; label: string; sites: { id: string; name: string; region?: string | null; brandName?: string | null; areaM2?: number | null }[] };

interface Ctx {
  scope: WrappedScope | null;
  open: (scope: WrappedScope) => void;
  close: () => void;
}

const WrappedContext = createContext<Ctx | null>(null);

export const WrappedProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScope] = useState<WrappedScope | null>(null);
  const open = useCallback((s: WrappedScope) => setScope(s), []);
  const close = useCallback(() => setScope(null), []);
  const value = useMemo(() => ({ scope, open, close }), [scope, open, close]);
  return <WrappedContext.Provider value={value}>{children}</WrappedContext.Provider>;
};

export function useWrapped(): Ctx {
  const c = useContext(WrappedContext);
  if (!c) throw new Error('useWrapped must be used within WrappedProvider');
  return c;
}