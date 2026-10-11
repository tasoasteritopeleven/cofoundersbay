import { Suspense, ReactNode } from 'react';

export default function VerifyEmailLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
