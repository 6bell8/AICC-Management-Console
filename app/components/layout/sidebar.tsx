'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Settings,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { authStorage } from '../../lib/auth/storage';
import type { AuthUser } from '../../lib/db/users';

type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type NavNode =
  | { type: 'link'; label: string; href: string; icon?: ReactNode; badgeKey?: 'pendingApprovals' | 'unreadNotifications' }
  | { type: 'group'; label: string; icon?: ReactNode; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = {
  HEAD: '총괄 관리자',
  ADMIN: '관리자',
  OPERATOR: '운영 담당자',
  VIEWER: '조회 사용자',
};

const NAV: NavNode[] = [
  { type: 'link', label: '대시보드', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { type: 'link', label: '마이페이지', href: '/mypage', icon: <UserRound className="h-4 w-4" /> },
  { type: 'link', label: '결재함', href: '/approvals', icon: <ClipboardCheck className="h-4 w-4" />, badgeKey: 'pendingApprovals' },
  { type: 'link', label: '전자결재 문서함', href: '/approvals/documents', icon: <FileText className="h-4 w-4" /> },
  { type: 'link', label: '조직도 / 팀 현황', href: '/admin/org', icon: <Building2 className="h-4 w-4" /> },
  { type: 'link', label: '공간 예약', href: '/reservations', icon: <CalendarClock className="h-4 w-4" /> },
  { type: 'link', label: '캘린더', href: '/calendar', icon: <CalendarDays className="h-4 w-4" /> },
  {
    type: 'group',
    label: '운영 자산 관리',
    icon: <HardDrive className="h-4 w-4" />,
    items: [
      { label: '사업 회선 관리', href: '/business-lines' },
      { label: '라이선스 파일', href: '/assets/licenses' },
      { label: '법규 / 규정 문서', href: '/assets/compliance' },
    ],
  },
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
    type: 'group',
    label: '인사관리',
    icon: <CalendarDays className="h-4 w-4" />,
    items: [
      { label: '근태관리', href: '/hr/leave' },
      { label: '출장여비 신청', href: '/hr/trip-expenses' },
      { label: '경조사 관리', href: '/hr/family-events' },
      { label: '권한 위임 관리', href: '/hr/permission-delegations' },
      { label: '근태/연차 통계', href: '/hr/leave-stats' },
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

const ADMIN_NAV: NavNode[] = [
  {
    type: 'group',
    label: '시스템 관리',
    icon: <Settings className="h-4 w-4" />,
    items: [
      { label: '설정 센터', href: '/admin/settings' },
      { label: '계정 승인 관리', href: '/admin/users' },
      { label: '카카오 채널 관리', href: '/admin/kakao-links' },
      { label: '감사 로그', href: '/admin/audit-logs' },
    ],
  },
  { type: 'link', label: '운영 현황', href: '/operations', icon: <Activity className="h-4 w-4" /> },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (href === '/') return pathname === '/';
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({ initialUser }: { initialUser: AuthUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileClosing, setMobileClosing] = useState(false);
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
  const nav: NavNode[] = initialUser.role === 'HEAD' || initialUser.role === 'ADMIN' ? [...NAV, ...ADMIN_NAV] : NAV;

  const openMobileMenu = () => {
    setMobileClosing(false);
    setMobileOpen(true);
  };

  const closeMobileMenu = () => {
    if (!mobileOpen || mobileClosing) return;
    setMobileClosing(true);
    window.setTimeout(() => {
      setMobileOpen(false);
      setMobileClosing(false);
    }, 460);
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMobileMenu();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOpen]);

  useEffect(() => {
    if (mobileOpen) closeMobileMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  const sidebarContent = (
    <>
      <div className="px-4 py-4 max-lg:hidden">
        <div className="flex items-start gap-2">
          <Link
            href="/dashboard"
            className="min-w-0 flex-1 rounded-md px-2 py-1 transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="대시보드로 이동"
          >
            <div className="truncate text-sm font-semibold tracking-wide">AICC 운영관리 포털</div>
            <div className="truncate text-xs text-slate-300">Admin Page (Portfolio)</div>
          </Link>
          <Link
            href="/notifications"
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700/80 bg-slate-800/70 text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label={`알림함으로 이동${counts.unreadNotifications > 0 ? `, 읽지 않은 알림 ${counts.unreadNotifications}건` : ''}`}
            title="알림"
          >
            <Bell className="h-4 w-4" />
            {counts.unreadNotifications > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-sky-500 px-1 text-center text-[10px] font-semibold leading-4 text-white ring-2 ring-slate-900">
                {counts.unreadNotifications > 99 ? '99+' : counts.unreadNotifications}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
                  <span className="min-w-0 truncate">{node.label}</span>
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
                  <span className="flex min-w-0 items-center gap-2">
                    {node.icon ? <span className="opacity-90">{node.icon}</span> : null}
                    <span className="min-w-0 truncate">{node.label}</span>
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

      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 rounded-md bg-slate-800/70 px-3 py-2">
          <div className="truncate text-xs font-medium text-white">{initialUser.name}</div>
          <div className="text-[11px] text-slate-300">{ROLE_LABEL[initialUser.role] ?? initialUser.role}</div>
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
    </>
  );

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-3 shadow-sm backdrop-blur print:hidden lg:hidden">
        <Link
          href="/notifications"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
          aria-label="알림으로 이동"
          title="알림"
        >
          <Bell className="h-4 w-4" />
          {counts.unreadNotifications > 0 ? (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-sky-500 ring-2 ring-white" aria-label="읽지 않은 알림 있음" />
          ) : null}
        </Link>
        <Link href="/dashboard" className="min-w-0 px-2 text-center" aria-label="대시보드로 이동">
          <div className="truncate text-sm font-semibold text-slate-950 sm:text-base">AICC 운영관리 포털</div>
          {/*<div className="truncate text-[11px] text-slate-500">Admin UI</div>*/}
        </Link>
        <button
          type="button"
          onClick={openMobileMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm shadow-slate-200/70 transition duration-300 ease-out hover:bg-sky-50 hover:text-sky-700 hover:shadow-sky-100"
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <aside className="fixed inset-y-0 left-0 z-50 hidden h-[100dvh] w-64 flex-col border-r bg-slate-900 text-slate-100 print:hidden lg:flex">
        {sidebarContent}
      </aside>

      {mobileOpen ? (
        <div
          className={[
            'fixed inset-0 z-[80] bg-slate-950/55 print:hidden lg:hidden',
            mobileClosing
              ? 'animate-[mobileMenuFadeOut_420ms_cubic-bezier(0.16,1,0.3,1)_both]'
              : 'animate-[mobileMenuFade_420ms_cubic-bezier(0.16,1,0.3,1)_both]',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          onClick={closeMobileMenu}
          aria-label="모바일 메뉴"
        >
          <aside
            className={[
              'flex h-[100dvh] w-[min(20rem,calc(100vw-1.5rem))] flex-col bg-slate-900 text-slate-100 shadow-2xl',
              mobileClosing
                ? 'animate-[mobileMenuSlideOut_460ms_cubic-bezier(0.16,1,0.3,1)_both]'
                : 'animate-[mobileMenuSlide_560ms_cubic-bezier(0.16,1,0.3,1)_both]',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-wide text-white">AICC 운영관리 포털</div>
                <div className="truncate text-xs text-slate-300">전체 메뉴</div>
              </div>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700 hover:text-white"
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}
    </>
  );
}
