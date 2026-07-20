import { Sidebar } from '../components/layout/sidebar';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '../lib/auth/session';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  if (user.forcePasswordChange) redirect('/change-password');

  return (
    <div className="min-h-screen">
      <Sidebar initialUser={user} />
      <main className="min-h-screen pt-14 lg:pl-64 lg:pt-0 print:min-h-0 print:pl-0 print:pt-0">
        <div className="main-content-shell mx-auto w-full max-w-6xl px-3 py-4 sm:px-5 lg:px-6 lg:py-6 print:max-w-none print:px-0 print:py-0">{children}</div>
      </main>
    </div>
  );
}
