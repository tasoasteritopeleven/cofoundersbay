import { AppShell } from '@/components/layout/AppShell';
import { PageLoading } from '@/components/common/PageLoading';

export default function Loading() {
  return (
    <AppShell>
      <PageLoading label="Loading pricing" />
    </AppShell>
  );
}
