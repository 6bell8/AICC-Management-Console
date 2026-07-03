'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Link2,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Unlink,
  UserCheck,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { RichSelect } from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
import type { AuthUser } from '@/app/lib/db/users';

type ApprovedUser = AuthUser;
type LinkStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type FilterStatus = 'UNLINKED' | 'APPROVED' | 'ALL';

type KakaoLink = {
  id: string;
  kakaoUserKey: string;
  channelId: string;
  status: LinkStatus;
  verifiedAt: string | null;
  requestedAt: string | null;
  decidedAt: string | null;
  rejectedReason: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  } | null;
};

type RecentKakaoUser = {
  kakaoUserKey: string;
  channelId: string;
  lastSeenAt: string;
  messageCount: number;
  lastUtterance: string;
  linkStatus: LinkStatus | null;
};

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

type KakaoLinksData = {
  links: KakaoLink[];
  recentUsers: RecentKakaoUser[];
  users: ApprovedUser[];
  pagination: Pagination;
};

const emptyData: KakaoLinksData = {
  links: [],
  recentUsers: [],
  users: [],
  pagination: { page: 1, pageSize: 20, total: 0, pageCount: 1 },
};

const ROLE_LABEL: Record<string, string> = {
  HEAD: '총괄 관리자',
  ADMIN: '관리자',
  OPERATOR: '운영 담당자',
  VIEWER: '조회 사용자',
};

const FILTERS: Array<{ key: FilterStatus; label: string }> = [
  { key: 'UNLINKED', label: '미연동 요청' },
  { key: 'APPROVED', label: '연결 완료' },
  { key: 'ALL', label: '전체 로그' },
];

export default function KakaoLinksClient({ currentUser }: { currentUser: AuthUser }) {
  const [data, setData] = useState<KakaoLinksData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [expandedEmergency, setExpandedEmergency] = useState<Record<string, boolean>>({});
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('UNLINKED');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const linkedCount = data.links.filter((link) => link.status === 'APPROVED').length;
  const unlinkedCount = data.recentUsers.filter((item) => item.linkStatus !== 'APPROVED').length;
  const recentRequestCount = data.recentUsers.reduce((sum, item) => sum + item.messageCount, 0);
  const isEmergencyOperator = currentUser.role === 'HEAD' || currentUser.role === 'ADMIN';
  const rangeLabel = useMemo(() => {
    if (data.pagination.total === 0) return '0-0';
    const start = (data.pagination.page - 1) * data.pagination.pageSize + 1;
    const end = Math.min(data.pagination.total, data.pagination.page * data.pagination.pageSize);
    return `${start}-${end}`;
  }, [data.pagination]);

  async function loadData(next?: { page?: number; pageSize?: number; status?: FilterStatus; search?: string }) {
    setLoading(true);
    setMessage(null);
    const targetPage = next?.page ?? page;
    const targetPageSize = next?.pageSize ?? pageSize;
    const targetStatus = next?.status ?? status;
    const targetSearch = next?.search ?? search;
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(targetPageSize),
        status: targetStatus,
        search: targetSearch,
      });
      const res = await fetch(`/api/admin/kakao-links?${params.toString()}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '카카오 채널 정보를 불러오지 못했습니다.');
      setData({
        links: body.links ?? [],
        recentUsers: body.recentUsers ?? [],
        users: body.users ?? [],
        pagination: body.pagination ?? emptyData.pagination,
      });
      setPage(body.pagination?.page ?? targetPage);
      setPageSize(body.pagination?.pageSize ?? targetPageSize);
      setStatus(targetStatus);
      setSearch(targetSearch);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '카카오 채널 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function emergencyConnect(item: RecentKakaoUser) {
    const userId = selectedUsers[item.kakaoUserKey];
    if (!userId) {
      setMessage('긴급 연결할 AICC 계정을 선택해 주세요.');
      return;
    }

    setPendingKey(item.kakaoUserKey);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/kakao-links?page=${page}&pageSize=${pageSize}&status=${status}&search=${encodeURIComponent(search)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kakaoUserKey: item.kakaoUserKey,
          channelId: item.channelId || null,
          userId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '긴급 계정 연결을 완료하지 못했습니다.');
      setData({
        links: body.links ?? [],
        recentUsers: body.recentUsers ?? [],
        users: body.users ?? data.users,
        pagination: body.pagination ?? data.pagination,
      });
      setSelectedUsers((current) => {
        const next = { ...current };
        delete next[item.kakaoUserKey];
        return next;
      });
      setExpandedEmergency((current) => ({ ...current, [item.kakaoUserKey]: false }));
      setMessage('관리자 긴급 제어로 카카오 계정을 연결했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '긴급 계정 연결을 완료하지 못했습니다.');
    } finally {
      setPendingKey(null);
    }
  }

  async function disconnectUser(kakaoUserKey: string) {
    setPendingKey(kakaoUserKey);
    setMessage(null);
    try {
      const params = new URLSearchParams({ kakaoUserKey, page: String(page), pageSize: String(pageSize), status, search });
      const res = await fetch(`/api/admin/kakao-links?${params.toString()}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '카카오 계정 연결을 해제하지 못했습니다.');
      setData({
        links: body.links ?? [],
        recentUsers: body.recentUsers ?? [],
        users: body.users ?? data.users,
        pagination: body.pagination ?? data.pagination,
      });
      setMessage('카카오 계정 연결을 해제했습니다.');
      setDisconnectTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '카카오 계정 연결을 해제하지 못했습니다.');
    } finally {
      setPendingKey(null);
    }
  }

  const onSearch = () => void loadData({ page: 1, search });
  const onStatus = (nextStatus: FilterStatus) => void loadData({ page: 1, status: nextStatus });
  const onPageSize = (value: number) => void loadData({ page: 1, pageSize: value });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-800">
            <MessageCircle className="h-3.5 w-3.5" />
            Kakao Channel Ops
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">카카오 채널 관리</h1>
          <p className="mt-1 text-sm text-slate-500">본인인증 기반 자동 연동 상태를 모니터링하고, 장애 상황에서만 관리자 긴급 제어를 수행합니다.</p>
        </div>

      </div>

      {message ? <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">{message}</div> : null}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Metric icon={<Link2 className="h-4 w-4" />} label="연동 완료" value={`${linkedCount}명`} tone="emerald" />
        <Metric icon={<KeyRound className="h-4 w-4" />} label="미연동 요청" value={`${unlinkedCount}건`} tone="kakao" />
        <Metric icon={<MessageCircle className="h-4 w-4" />} label="표시된 요청" value={`${recentRequestCount}건`} tone="amber" />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="승인 계정" value={`${data.users.length}명`} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="soft-panel overflow-hidden p-0">
          <div className="border-b border-yellow-100 bg-gradient-to-r from-yellow-50 via-white to-white px-3 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FEE500] text-slate-950 shadow-sm">
                <MessageCircle className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">카카오 요청 모니터링</h2>
                <p className="mt-0.5 text-xs text-slate-500">최근 채널 요청, 연동 상태, 마지막 발화를 확인합니다. 수동 연결은 장애 대응용으로만 사용합니다.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-3">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onStatus(item.key)}
                    className={[
                      'soft-interactive rounded-full border px-3 py-1 text-xs font-semibold',
                      status === item.key ? 'border-yellow-200 bg-yellow-50 text-yellow-900' : 'border-slate-200 bg-white text-slate-500',
                    ].join(' ')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSearch();
                    }}
                    placeholder="user key, 발화 검색"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-yellow-200 focus:border-yellow-300 focus:ring-2 focus:ring-yellow-100"
                  />
                </div>
                <button type="button" onClick={onSearch} className="soft-interactive rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-yellow-50">
                  검색
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-100">
              {loading ? (
                <KakaoRequestListSkeleton />
              ) : data.recentUsers.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {data.recentUsers.map((item, index) => {
                    const isLinked = item.linkStatus === 'APPROVED';
                    const isExpanded = expandedEmergency[item.kakaoUserKey] ?? false;
                    return (
                      <div key={`${item.kakaoUserKey}-${index}`} className="bg-white px-3 py-3 transition hover:bg-slate-50/70">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px] lg:items-center">
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3 lg:justify-start">
                              <span className="min-w-0 max-w-[170px] truncate font-mono text-xs font-semibold text-slate-800 sm:max-w-[320px]" title={item.kakaoUserKey}>
                                {maskKey(item.kakaoUserKey)}
                              </span>
                              <span className="shrink-0">
                                <StatusPill linked={isLinked} />
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              마지막 발화: <span className="text-slate-700">{item.lastUtterance || '-'}</span>
                            </div>
                            <div className="mt-1 text-[11px] text-slate-400">
                              {item.channelId || 'channel 없음'} · {item.messageCount}건
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 lg:text-right">최근 요청 {formatKst(item.lastSeenAt)}</div>
                          <div className="flex justify-start gap-2 max-[480px]:pt-1 lg:justify-end">
                            {isLinked ? (
                              <button
                                type="button"
                                onClick={() => setDisconnectTarget(item.kakaoUserKey)}
                                disabled={pendingKey === item.kakaoUserKey}
                                className="soft-interactive inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-45"
                              >
                                <Unlink className="h-3.5 w-3.5" />
                                연결 해제
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedEmergency((current) => ({ ...current, [item.kakaoUserKey]: !isExpanded }))}
                                className="soft-interactive inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                긴급 제어
                              </button>
                            )}
                          </div>
                        </div>

                        {!isLinked && isExpanded ? (
                          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                            <div className="flex items-start gap-2 text-xs text-amber-900">
                              <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
                              <p>본인인증이 원칙입니다. 카카오 장애, 인증번호 미수신, 사용자 지원 요청 등 예외 상황에서만 수동 연결하세요.</p>
                            </div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                              <RichSelect
                                value={selectedUsers[item.kakaoUserKey] ?? ''}
                                onChange={(value) => setSelectedUsers((current) => ({ ...current, [item.kakaoUserKey]: value }))}
                                options={[
                                  { value: '', label: 'AICC 계정 선택' },
                                  ...data.users.map((user) => ({ value: user.id, label: user.name, description: user.email })),
                                ]}
                                className="min-w-0 flex-1"
                                buttonClassName="min-h-10 rounded-md border-slate-200 px-2 text-sm text-slate-700 focus:border-yellow-300 focus:ring-yellow-100"
                                disabled={!isEmergencyOperator}
                              />
                              <button
                                type="button"
                                onClick={() => void emergencyConnect(item)}
                                disabled={!isEmergencyOperator || pendingKey === item.kakaoUserKey}
                                className="soft-interactive inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-yellow-200 bg-[#FEE500] px-3 text-sm font-semibold text-slate-950 hover:bg-yellow-300 disabled:pointer-events-none disabled:opacity-45"
                              >
                                <Link2 className="h-4 w-4" />
                                긴급 연결
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-10 text-center text-sm text-slate-500">조건에 맞는 카카오 요청이 없습니다.</div>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {rangeLabel} / 총 {data.pagination.total}건
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
                <RichSelect
                  value={String(pageSize)}
                  onChange={(value) => onPageSize(Number(value))}
                  options={[10, 20, 50].map((value) => ({ value: String(value), label: `${value}개` }))}
                  buttonClassName="sm:min-h-8 sm:rounded-md sm:px-2 sm:text-xs"
                />
                <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => void loadData({ page: Math.max(1, page - 1) })}
                    disabled={page <= 1 || loading}
                    className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-0 text-center text-xs font-semibold text-sky-700 sm:min-w-16">
                    {page} / {data.pagination.pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadData({ page: Math.min(data.pagination.pageCount, page + 1) })}
                    disabled={page >= data.pagination.pageCount || loading}
                    className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="soft-panel overflow-hidden p-0">
            <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-yellow-200 bg-yellow-50 text-yellow-800">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-950">연결된 계정</h2>
                  <p className="mt-0.5 text-xs text-slate-500">카카오 기능은 연결된 AICC 계정 권한으로 실행됩니다.</p>
                </div>
              </div>
            </div>
            <div className="max-h-[580px] space-y-2 overflow-y-auto p-3">
              {data.links.length > 0 ? (
                data.links.map((link) => (
                  <div key={link.kakaoUserKey} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">{link.user?.name ?? '계정 없음'}</div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">{link.user?.email ?? '-'}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                            {ROLE_LABEL[link.user?.role ?? ''] ?? link.user?.role ?? '-'}
                          </span>
                          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">연결됨</span>
                          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">Kakao</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDisconnectTarget(link.kakaoUserKey)}
                        disabled={pendingKey === link.kakaoUserKey}
                        className="soft-interactive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-45"
                        aria-label="연결 해제"
                        title="연결 해제"
                      >
                        <Unlink className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 rounded-md border border-slate-100 bg-white px-2.5 py-2">
                      <div className="truncate font-mono text-[11px] text-slate-500" title={link.kakaoUserKey}>
                        {maskKey(link.kakaoUserKey)}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">검증일 {link.verifiedAt ? formatKst(link.verifiedAt) : '-'}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-10 text-center text-sm text-slate-500">아직 연결된 카카오 계정이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs leading-5 text-yellow-900">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              운영 원칙
            </div>
            본인인증 자동 연동을 기본으로 사용하고, 관리자 긴급 연결은 장애 대응이나 고객지원 상황에서만 사용합니다. 연결/해제 기록은 감사 로그에 남습니다.
          </div>
        </aside>
      </section>

      <AlertDialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent className="border-slate-200 p-0">
          <div className="border-b border-rose-100 bg-rose-50/70 px-5 py-4">
            <AlertDialogHeader>
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-rose-100 bg-white text-rose-600">
                <Unlink className="h-4 w-4" />
              </div>
              <AlertDialogTitle className="text-base text-slate-950">카카오 계정 연결을 해제할까요?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-slate-600">
                연결 해제 후 사용자는 카카오 채널에서 다시 본인인증을 진행해야 공간예약과 같은 기능을 사용할 수 있습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-xs font-semibold text-slate-500">해제 대상</div>
              <div className="mt-1 truncate font-mono text-xs text-slate-700">{disconnectTarget ? maskKey(disconnectTarget) : '-'}</div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(pendingKey)} className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={!disconnectTarget || Boolean(pendingKey)}
                onClick={() => {
                  if (disconnectTarget) void disconnectUser(disconnectTarget);
                }}
                className="border border-rose-200 bg-rose-50 text-rose-700 shadow-sm hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-50"
              >
                연결 해제
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: 'kakao' | 'emerald' | 'amber' | 'slate' }) {
  const toneClass = {
    kakao: 'border-yellow-200 bg-yellow-50 text-yellow-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone];

  return (
    <div className={['soft-interactive rounded-lg border p-3 max-[480px]:min-h-[92px]', toneClass].join(' ')}>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span>{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StatusPill({ linked }: { linked: boolean }) {
  return linked ? (
    <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">연결 완료</span>
  ) : (
    <span className="inline-flex rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">본인인증 필요</span>
  );
}

function KakaoRequestListSkeleton() {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="bg-white px-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_170px_140px] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-4 w-56" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
            <Skeleton className="h-4 w-24 lg:ml-auto" />
            <Skeleton className="h-9 w-24 lg:ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

function maskKey(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatKst(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
