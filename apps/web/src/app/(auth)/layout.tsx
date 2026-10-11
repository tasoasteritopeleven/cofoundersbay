import { Suspense } from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <div style={{ paddingTop: 'calc(var(--banner-network, 0px) + var(--banner-demo, 0px))' }}>
        {children}
      </div>
    </Suspense>
  );
}
