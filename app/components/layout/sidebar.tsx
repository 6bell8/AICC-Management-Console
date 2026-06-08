'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronDown, ClipboardCheck, LayoutDashboard, Megaphone, Briefcase, Target, LogOut, ShieldCheck, Building2 } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { authStorage } from '../../lib/auth/storage';
import type { AuthUser } from '../../lib/db/users';

type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type NavNode =
  | { type: 'link'; label: string; href: string; icon?: React.ReactNode; badgeKey?: 'pendingApprovals' | 'unreadNotifications' }
  | { type: 'group'; label: string; icon?: React.ReactNode; items: NavItem[] };

const NAV: NavNode[] = [
  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { type: 'link', label: '결재함', href: '/approvals', icon: <ClipboardCheck className="h-4 w-4" />, badgeKey: 'pendingApprovals' },
  { type: 'link', label: '전자결재 문서함', href: '/approvals/documents', icon: <ClipboardCheck className="h-4 w-4" /> },
  { type: 'link', label: '알림', href: '/notifications', icon: <Bell className="h-4 w-4" />, badgeKey: 'unreadNotifications' },
  {
    type: 'group',
    label: '캠페인',
    icon: <Target className="h-4 w-4" />,
    items: [
      { label: '캠페인 목록', href: '/campaigns', exact: true },
      { label: '캠페인 모니터링', href: '/campaigns/monitoring' },
    ],
  },
  {
    type: 'link',
    label: '사업 회선 관리',
    href: '/business-lines',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    type: 'group',
    label: '인사관리',
    icon: <CalendarDays className="h-4 w-4" />,
    items: [
      { label: '근태신청 관리 현황', href: '/hr/leave' },
      { label: '근태/연차 통계', href: '/hr/leave-stats' },
      { label: '출장여비 신청', href: '/hr/trip-expenses' },
    ],
  },
  {
    type: 'group',
    label: '영업관리',
    icon: <Briefcase className="h-4 w-4" />,
    items: [
      { label: '영업현황관리', href: '/sales/contracts' },
      { label: '계약현황통계', href: '/sales/activity-stats' },
    ],
  },
  {
    type: 'group',
    label: '게시판',
    icon: <Megaphone className="h-4 w-4" />,
    items: [
      { label: '공지사항', href: '/board/notice' },
      { label: '동적노드 가이드', href: '/board/dynnode' },
      { label: '저작 가이드', href: '/board/author-guide' },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (href === '/') return pathname === '/';
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}
export function Sidebar({ initialUser }: { initialUser: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const countsQuery = useQuery<{ unreadNotifications: number; pendingApprovals: number }>({
    queryKey: ['notifications', 'counts'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?mode=counts', { cache: 'no-store' });
      if (!res.ok) return { unreadNotifications: 0, pendingApprovals: 0 };
      return res.json();
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const counts = countsQuery.data ?? { unreadNotifications: 0, pendingApprovals: 0 };
  const nav: NavNode[] = initialUser.role === 'HEAD' || initialUser.role === 'ADMIN'
    ? [
        ...NAV,
        { type: 'link' as const, label: '계정 승인 관리', href: '/admin/users', icon: <ShieldCheck className="h-4 w-4" /> },
        { type: 'link' as const, label: '조직도 / 팀 현황', href: '/admin/org', icon: <Building2 className="h-4 w-4" /> },
        { type: 'link' as const, label: '감사 로그', href: '/admin/audit-logs', icon: <ShieldCheck className="h-4 w-4" /> },
      ]
    : NAV;

  const onLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      authStorage?.clear?.();
    } catch {
      // ignore
    }

    router.replace('/login');
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 flex-col border-r bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="px-4 py-4">
        <Link
          href="/dashboard"
          className="block rounded-md px-2 py-1 transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          aria-label="Go to dashboard home"
        >
          <div className="text-sm font-semibold tracking-wide">AICC 운영관리 포털</div>
          <div className="text-xs text-slate-300">Admin UI (Portfolio)</div>
        </Link>
      </div>

      {/* Menu */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-2">
          {nav.map((node) => {
            if (node.type === 'link') {
              const active = isActive(pathname, node.href);

              return (
                <Link
                  key={node.href}
                  href={node.href}
                  className={[
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                    active ? 'bg-slate-800 text-white' : 'text-slate-200 hover:bg-slate-800/70 hover:text-white',
                  ].join(' ')}
                >
                  {node.icon ? <span className="opacity-90">{node.icon}</span> : null}
                  <span>{node.label}</span>
                  {node.badgeKey && counts[node.badgeKey] > 0 ? (
                    <span className="ml-auto rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white">{counts[node.badgeKey]}</span>
                  ) : null}
                </Link>
              );
            }

            const anyChildActive = node.items.some((it) => isActive(pathname, it.href, it.exact));

            return (
              <Collapsible key={node.label} defaultOpen={anyChildActive}>
                <CollapsibleTrigger
                  className={[
                    'group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm',
                    'text-slate-200 hover:bg-slate-800/70 hover:text-white',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2">
                    {node.icon ? <span className="opacity-90">{node.icon}</span> : null}
                    <span>{node.label}</span>
                  </span>

                  <ChevronDown className="h-4 w-4 opacity-70 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-1">
                  <div className="space-y-1 pl-2">
                    {node.items.map((it) => {
                      const active = isActive(pathname, it.href, it.exact);

                      return (
                        <Link
                          key={it.href}
                          href={it.href}
                          className={[
                            'block rounded-md px-3 py-2 text-sm',
                            active ? 'bg-slate-50 text-slate-900' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white',
                          ].join(' ')}
                        >
                          {it.label}
                        </Link>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 rounded-md bg-slate-800/70 px-3 py-2">
          <div className="truncate text-xs font-medium text-white">{initialUser.name}</div>
          <div className="text-[11px] text-slate-300">{initialUser.role}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full cursor-pointer items-center justify-end gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/70 hover:text-white"
        >
          <LogOut className="h-4 w-4 opacity-90" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
