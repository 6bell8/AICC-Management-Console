'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LayoutDashboard, Megaphone, Briefcase, Target, LogOut } from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { authStorage } from '../../lib/auth/storage';

type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

type NavNode =
  | { type: 'link'; label: string; href: string; icon?: React.ReactNode }
  | { type: 'group'; label: string; icon?: React.ReactNode; items: NavItem[] };

const NAV: NavNode[] = [
  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
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
      { label: '저작가이드', href: '/board/author-guide' },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (href === '/') return pathname === '/';
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const onLogout = () => {
    try {
      authStorage?.clear?.();
    } catch {
      // ignore
    }

    router.replace('/login');
    router.refresh();
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-64 flex-col border-r bg-slate-900 text-slate-100">
      {/* 헤더 */}
      <div className="px-4 py-4">
        <div className="text-sm font-semibold tracking-wide">AICC 운영관리 포털</div>
        <div className="text-xs text-slate-300">Admin UI (Portfolio)</div>
      </div>

      {/* 메뉴 (스크롤) */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-2">
          {NAV.map((node) => {
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

      {/* 로그아웃 (하단 고정) */}
      <div className="border-t border-slate-800 p-3">
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
