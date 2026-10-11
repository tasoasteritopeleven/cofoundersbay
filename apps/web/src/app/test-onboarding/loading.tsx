import { PageLoading } from '@/components/common/PageLoading';

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageLoading label="Loading onboarding preview" />
    </div>
  );
}
