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
      <main className="min-h-screen pl-64 print:min-h-0 print:pl-0">
        <div className="mx-auto w-full max-w-6xl px-6 py-6 print:max-w-none print:px-0 print:py-0">{children}</div>
      </main>
    </div>
  );
}
