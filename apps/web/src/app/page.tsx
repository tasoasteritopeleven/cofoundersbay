export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LandingHome } from './LandingHome';

export default async function Home() {
  const cookieStore = await cookies();
  if (cookieStore.has('cfb_session')) {
    redirect('/dashboard');
  }
  return <LandingHome />;
}
