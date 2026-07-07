import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowUpRight, Bell, Bot, BriefcaseBusiness, CalendarCheck, ClipboardCheck, FileText, Landmark, LineChart, ShieldCheck, Target, UserRound, WalletCards } from 'lucide-react';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listBusinessLines } from '@/app/lib/db/businessLines';
import { listCampaigns } from '@/app/lib/db/campaigns';
import { listContractDeals } from '@/app/lib/db/contracts';
import { getDashboardActivityHeatmap, getDashboardErpSummary } from '@/app/lib/db/erp';
import { getFamilyEventDashboardSummary } from '@/app/lib/db/familyEvents';
import { getLeaveVisibilityForUser } from '@/app/lib/db/hr';
import { getPersonalDashboard } from '@/app/lib/db/personalDashboard';
import { listNotices } from '@/app/lib/notice/store';
import type { ContractDeal } from '@/app/lib/types/contracts';
import DashboardActivityHeatmap from './DashboardActivityHeatmap';
import DashboardOperationsPreviewPanel from './DashboardOperationsPreviewPanel';

export const dynamic = 'force-dynamic';

const REQUEST_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  AM_HALF: '오전 반차',
  PM_HALF: '오후 반차',
  BUSINESS_TRIP: '출장',
  TRIP_EXPENSE: '출장여비',
  SICK: '병가',
  OFFICIAL: '공가',
  COMP: '대체휴무',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  DRAFT: '임시',
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-600',
  DRAFT: 'border-sky-200 bg-sky-50 text-sky-700',
};

const POSITION_LABEL: Record<string, string> = {
  STAFF: '사원',
  ASSISTANT_MANAGER: '대리',
  MANAGER: '과장',
  SENIOR_MANAGER: '차장',
  DIRECTOR: '부장 이상',
};

const ROLE_LABEL: Record<string, string> = {
  HEAD: '총괄 관리자',
  ADMIN: '관리자',
  OPERATOR: '운영 담당자',
  VIEWER: '조회 사용자',
};

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  RUNNING: '운영중',
  PAUSED: '일시중지',
  DRAFT: '초안',
  ARCHIVED: '보관',
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  LEAD: '리드',
  PROPOSAL: '제안',
  NEGOTIATION: '협상',
  CONTRACTED: '계약',
  DONE: '완료',
};

function statusBadge(status: string) {
  return (
    <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_CLASS[status] ?? STATUS_CLASS.DRAFT].join(' ')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function softBadge(label: string, tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate' = 'slate') {
  const toneClass = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  }[tone];
  return <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass].join(' ')}>{label}</span>;
}

function won(value: number) {
  return value.toLocaleString() + '원';
}

function calcDealTotal(deal: ContractDeal) {
  const subtotal = deal.items.reduce((acc, item) => acc + Math.max(0, Number(item.qty || 0)) * Math.max(0, Number(item.unitPrice || 0)), 0);
  const supply = Math.max(0, subtotal - Math.max(0, Number(deal.discount || 0)));
  return Math.round(supply * 1.1);
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  const isAdmin = user.role === 'HEAD' || user.role === 'ADMIN';
  const visibility = await getLeaveVisibilityForUser(user);
  const isTeamManager = visibility.scope === 'TEAM';
  const scopedTeamIds = isTeamManager ? visibility.teamIds : undefined;
  const [data, erpSummary, familyEventSummary, activityHeatmap, campaigns, contractDeals, businessLines, notices] = await Promise.all([
    getPersonalDashboard(user),
    getDashboardErpSummary(user, { teamIds: scopedTeamIds }),
    getFamilyEventDashboardSummary(user),
    getDashboardActivityHeatmap({ teamIds: scopedTeamIds }),
    listCampaigns({ page: 1, pageSize: 6 }),
    listContractDeals(),
    listBusinessLines({ page: 1, pageSize: 5 }),
    listNotices(),
  ]);
  const isManager = isAdmin || isTeamManager || data.counts.pendingMyApprovals > 0;
  const useManagerDashboard = isAdmin || isTeamManager;
  const isOperator = user.role === 'OPERATOR';
  const isViewer = user.role === 'VIEWER';
  const isSalesTeam = data.profile.teamName.includes('영업');
  const runningCampaigns = campaigns.items.filter((item) => item.status === 'RUNNING');
  const pausedCampaigns = campaigns.items.filter((item) => item.status === 'PAUSED');
  const myDeals = contractDeals.filter((deal) => deal.owner === data.user.name);
  const visibleDeals = (useManagerDashboard ? contractDeals : myDeals.length > 0 ? myDeals : contractDeals).slice(0, 5);
  const openDealAmount = (useManagerDashboard ? contractDeals : visibleDeals)
    .filter((deal) => deal.status !== 'DONE')
    .reduce((acc, deal) => acc + calcDealTotal(deal), 0);
  const recentNotices = notices.filter((notice) => notice.status === 'PUBLISHED').slice(0, 3);
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.user.name}님 오늘 확인할 운영, 영업, 개인 업무를 확인해 주세요.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeaderIconLink href="/mypage" label="마이페이지" icon={<UserRound className="h-4 w-4" />} />
          <HeaderIconLink href="/campaigns" label="캠페인" icon={<Target className="h-4 w-4" />} />
          {isManager ? <HeaderIconLink href="/approvals" label="결재함" icon={<ClipboardCheck className="h-4 w-4" />} tone="amber" /> : null}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Metric label="내 역할" value={ROLE_LABEL[data.user.role] ?? data.user.role} sub={`${data.profile.teamName} · ${POSITION_LABEL[data.profile.position] ?? data.profile.position}`} tone="slate" />
        <Metric label="오늘 처리할 결재" value={`${data.counts.pendingMyApprovals}건`} sub={isManager ? '결재함에서 처리' : '처리 권한 없음'} tone="amber" />
        <Metric label="운영 캠페인" value={`${runningCampaigns.length}건`} sub={`일시중지 ${pausedCampaigns.length}건`} tone="sky" />
        <Metric label="읽지 않은 알림" value={`${data.counts.unreadNotifications}건`} sub="알림함에서 확인" tone="emerald" />
      </section>

      {useManagerDashboard ? (
        <section className="grid gap-3 xl:grid-cols-3">
          <Panel title="관리자 운영 우선순위" href="/operations">
            <ActionRow label="전체 대기 결재" value={`${erpSummary.pendingApprovals}건`} href="/approvals" tone="amber" />
            <ActionRow label="출장여비 정산 대기" value={`${erpSummary.pendingSettlements}건 · ${won(erpSummary.pendingSettlementAmount)}`} href="/hr/trip-expenses" tone="emerald" />
                        <ActionRow label="최근 7일 감사 로그" value={`${erpSummary.recentAuditLogs}건`} href="/admin/audit-logs" tone="slate" />
          </Panel>
          <Panel title="영업 / 계약 요약" href="/sales/contracts">
            <ActionRow label="진행 계약 금액" value={won(openDealAmount)} href="/sales/activity-stats" tone="emerald" />
            {visibleDeals.slice(0, 2).map((deal) => (
              <ActionRow
                key={deal.id}
                label={deal.title}
                value={`${CONTRACT_STATUS_LABEL[deal.status] ?? deal.status} · ${won(calcDealTotal(deal))}`}
                href="/sales/contracts"
                tone={deal.status === 'DONE' ? 'slate' : 'sky'}
              />
            ))}
            {visibleDeals.length === 0 ? <Empty text="표시할 계약 현황이 없습니다." compact /> : null}
          </Panel>
          <Panel title="캠페인 / 회선 요약" href="/campaigns">
            {campaigns.items.slice(0, 2).map((item) => (
              <ActionRow
                key={item.id}
                label={item.name}
                value={CAMPAIGN_STATUS_LABEL[item.status] ?? item.status}
                href={`/campaigns/${encodeURIComponent(item.id)}`}
                tone={item.status === 'RUNNING' ? 'emerald' : item.status === 'PAUSED' ? 'amber' : item.status === 'ARCHIVED' ? 'slate' : 'sky'}
              />
            ))}
            {businessLines.items.slice(0, 1).map((line) => (
              <ActionRow
                key={line.id}
                label={line.botName || line.botCode || '봇 미지정'}
                value={`${line.regiStatus === 'DONE' ? '완료' : line.regiStatus === 'CANCELLED' ? '취소' : '대기'}`}
                href="/business-lines"
                tone={line.regiStatus === 'DONE' ? 'emerald' : line.regiStatus === 'CANCELLED' ? 'rose' : 'amber'}
              />
            ))}
            {campaigns.items.length === 0 && businessLines.items.length === 0 ? <Empty text="표시할 운영 현황이 없습니다." compact /> : null}
          </Panel>
        </section>
      ) : null}

      {useManagerDashboard ? (
        <DashboardOperationsPreviewPanel notices={recentNotices} familyEventSummary={familyEventSummary} />
      ) : null}

      {useManagerDashboard ? <DashboardActivityHeatmap items={activityHeatmap} /> : null}

      {isManager && !useManagerDashboard ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="팀장 업무" href="/approvals">
            <ActionRow label="내 결재 대기" value={`${data.counts.pendingMyApprovals}건`} href="/approvals" tone="amber" />
            <ActionRow label="팀 근태 현황" value="팀원 연차/출장 신청 확인" href="/hr/leave" tone="sky" />
            <ActionRow label="전자결재 문서함" value="팀 문서 흐름 확인" href="/approvals/documents" tone="slate" />
          </Panel>
          <Panel title="팀 운영 참고" href="/hr/leave-stats">
            <ActionRow label="소속 팀" value={data.profile.teamName} href="/admin/org" tone="slate" />
            <ActionRow label="팀장" value={data.profile.teamHeadName} href="/admin/org" tone="emerald" />
            <ActionRow label="연간 근태 신청" value={`${erpSummary.yearlyLeaveRequests}건`} href="/hr/leave-stats" tone="sky" />
          </Panel>
        </section>
      ) : null}

      {!useManagerDashboard && (isOperator || isSalesTeam) ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title={isAdmin ? '영업 / 계약 현황' : '내 영업 / 계약 현황'} href="/sales/contracts">
            <ActionRow label={isAdmin ? '진행 계약 금액' : '표시 계약 금액'} value={won(openDealAmount)} href="/sales/activity-stats" tone="emerald" />
            {visibleDeals.map((deal) => (
              <ActionRow
                key={deal.id}
                label={deal.title}
                value={`${CONTRACT_STATUS_LABEL[deal.status] ?? deal.status} · ${won(calcDealTotal(deal))}`}
                href="/sales/contracts"
                tone={deal.status === 'DONE' ? 'slate' : 'sky'}
              />
            ))}
            {visibleDeals.length === 0 ? <Empty text="표시할 계약 현황이 없습니다." /> : null}
          </Panel>

          <Panel title="봇 / 회선 운영" href="/business-lines">
            {businessLines.items.map((line) => (
              <ActionRow
                key={line.id}
                label={line.botName || line.botCode || '봇 미지정'}
                value={`${line.serviceType} · ${line.regiStatus === 'DONE' ? '완료' : line.regiStatus === 'CANCELLED' ? '취소' : '대기'}`}
                href="/business-lines"
                tone={line.regiStatus === 'DONE' ? 'emerald' : line.regiStatus === 'CANCELLED' ? 'rose' : 'amber'}
              />
            ))}
            {businessLines.items.length === 0 ? <Empty text="등록된 봇/회선 현황이 없습니다." /> : null}
          </Panel>
        </section>
      ) : null}

      {!useManagerDashboard ? (
        <>
          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel title="캠페인 운영 상태" href="/campaigns">
              {campaigns.items.map((item) => (
                <ActionRow
                  key={item.id}
                  label={item.name}
                  value={CAMPAIGN_STATUS_LABEL[item.status] ?? item.status}
                  href={`/campaigns/${encodeURIComponent(item.id)}`}
                  tone={item.status === 'RUNNING' ? 'emerald' : item.status === 'PAUSED' ? 'amber' : item.status === 'ARCHIVED' ? 'slate' : 'sky'}
                />
              ))}
              {campaigns.items.length === 0 ? <Empty text="등록된 캠페인이 없습니다." /> : null}
            </Panel>

            <Panel title={isViewer ? '내 개인 업무' : '개인 업무 요약'} href="/mypage">
              <ActionRow label="잔여 연차" value={`${data.balance.remainingDays}일`} href="/mypage" tone="emerald" />
              <ActionRow label="최근 근태 신청" value={`${data.recentLeaveRequests.length}건`} href="/hr/leave" tone="sky" />
              <ActionRow label="최근 출장여비 신청" value={`${data.recentTripExpenses.length}건`} href="/hr/trip-expenses" tone="slate" />
            </Panel>
          </section>

          <DashboardOperationsPreviewPanel notices={recentNotices} familyEventSummary={familyEventSummary} />

          <section className="grid gap-4 xl:grid-cols-2">
            <Panel title="내 근태 / 출장 최근 흐름" href="/hr/leave">
              {data.recentLeaveRequests.slice(0, 4).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{REQUEST_LABEL[item.requestType] ?? item.requestType}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.startDate}{item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ''}</div>
                  </div>
                  {statusBadge(item.status)}
                </div>
              ))}
              {data.recentLeaveRequests.length === 0 ? <Empty text="최근 근태 신청이 없습니다." /> : null}
            </Panel>

            <Panel title="최근 알림" href="/notifications">
              {data.recentNotifications.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-3 py-3 last:border-b-0">
                  <div className="flex items-center gap-2">
                    {!item.readAt ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : <span className="h-2 w-2 rounded-full bg-slate-200" />}
                    <div className="truncate text-sm font-medium text-slate-900">{item.title}</div>
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-slate-500">{item.message}</div>
                </div>
              ))}
              {data.recentNotifications.length === 0 ? <Empty text="최근 알림이 없습니다." /> : null}
            </Panel>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'emerald' | 'sky' | 'amber' | 'slate' }) {
  const toneClass = {
    emerald: 'border-emerald-100 bg-emerald-50/50 text-emerald-900',
    sky: 'border-sky-100 bg-sky-50/50 text-sky-900',
    amber: 'border-amber-100 bg-amber-50/50 text-amber-900',
    slate: 'border-slate-200 bg-white text-slate-950',
  }[tone];
  return (
    <div className={['soft-interactive rounded-lg border p-2.5', toneClass].join(' ')}>
      <div className="text-xs font-medium opacity-70">{label}</div>
      <div className="mt-0.5 truncate text-lg font-semibold">{value}</div>
      <div className="mt-0.5 truncate text-xs opacity-70">{sub}</div>
    </div>
  );
}

function ActionRow({
  label,
  value,
  href,
  tone,
  icon,
}: {
  label: string;
  value: string;
  href: string;
  tone: 'sky' | 'emerald' | 'amber' | 'rose' | 'slate';
  icon?: ReactNode;
}) {
  const rowIcon = icon ?? getActionIcon(href);
  return (
    <Link href={href} className="flex min-h-9 items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-1.5 transition hover:bg-slate-50/70 last:border-b-0">
      <span className="flex min-w-0 items-center gap-2">
        {rowIcon ? <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500">{rowIcon}</span> : null}
        <span className="min-w-0 truncate text-xs font-medium leading-5 text-slate-900">{label}</span>
      </span>
      <span className="shrink-0">{softBadge(value, tone)}</span>
    </Link>
  );
}

function getActionIcon(href: string) {
  if (href.includes('/approvals/documents')) return <FileText className="h-4 w-4" />;
  if (href.includes('/approvals')) return <ClipboardCheck className="h-4 w-4" />;
  if (href.includes('/hr/trip-expenses')) return <WalletCards className="h-4 w-4" />;
  if (href.includes('/hr/leave')) return <CalendarCheck className="h-4 w-4" />;
  if (href.includes('/mypage')) return <UserRound className="h-4 w-4" />;
  if (href.includes('/notifications')) return <Bell className="h-4 w-4" />;
  if (href.includes('/campaigns')) return <Target className="h-4 w-4" />;
  if (href.includes('/business-lines')) return <Bot className="h-4 w-4" />;
  if (href.includes('/sales/activity-stats')) return <LineChart className="h-4 w-4" />;
  if (href.includes('/sales/contracts')) return <BriefcaseBusiness className="h-4 w-4" />;
  if (href.includes('/admin/audit-logs')) return <ShieldCheck className="h-4 w-4" />;
  if (href.includes('/admin/org')) return <Landmark className="h-4 w-4" />;
  return <ArrowUpRight className="h-4 w-4" />;
}

function HeaderIconLink({ href, label, icon, tone = 'slate' }: { href: string; label: string; icon: ReactNode; tone?: 'slate' | 'amber' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-100 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900';
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={['inline-flex h-9 w-9 items-center justify-center rounded-md border transition', toneClass].join(' ')}
    >
      {icon}
    </Link>
  );
}

function MiniChart({ title, items }: { title: string; items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <span className="text-xs text-slate-400">현황</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="grid grid-cols-[72px_1fr_28px] items-center gap-2 text-xs">
            <span className="truncate text-slate-500">{item.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.max(6, (item.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-semibold text-slate-700">{item.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityHeatmap({ items }: { items: Array<{ date: string; count: number }> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDate = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0);
  const startOffset = firstDate.getDay();
  const totalDays = lastDate.getDate();
  const countByDate = new Map(items.map((item) => [item.date, item.count]));
  const max = Math.max(1, ...items.map((item) => item.count));
  const total = items.reduce((acc, item) => acc + item.count, 0);
  const peak = items.reduce((best, item) => (item.count > best.count ? item : best), { date: '', count: 0 });
  const cells = [
    ...Array.from({ length: startOffset }, (_, index) => ({ key: `empty-${index}`, day: null as number | null, date: '', count: 0 })),
    ...Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key: date, day, date, count: countByDate.get(date) ?? 0 };
    }),
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">월간 업무 밀도</h2>
          <p className="mt-1 text-xs text-slate-500">연차, 결재, 출장여비, 공간 예약이 몰린 날짜를 보여줍니다.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {softBadge(`이번 달 ${total}건`, 'sky')}
          {peak.date ? softBadge(`최다 ${peak.date.slice(5)} · ${peak.count}건`, 'emerald') : softBadge('데이터 없음', 'slate')}
        </div>
      </div>
      <div className="grid grid-cols-7 overflow-visible rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div key={day} className="border-b border-slate-100 bg-white px-2 py-2 text-center font-medium text-slate-500">
            {day}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={[
              'activity-heatmap-cell min-h-16 border-b border-r border-slate-100 p-2 last:border-r-0',
              cell.day ? heatmapTone(cell.count, max) : 'bg-slate-50/50',
              cell.count > 0 ? 'activity-heatmap-cell-active' : '',
            ].join(' ')}
            title={cell.day ? `${cell.date}: ${cell.count}건` : undefined}
          >
            {cell.day ? (
              <div className="relative z-10 flex h-full flex-col justify-between">
                <span className="text-xs font-semibold text-slate-700">{cell.day}</span>
                <span className="self-end rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                  {cell.count}건
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function heatmapTone(count: number, max: number) {
  if (count <= 0) return 'bg-white';
  const ratio = count / max;
  if (ratio >= 0.75) return 'bg-sky-200/90';
  if (ratio >= 0.5) return 'bg-sky-100';
  if (ratio >= 0.25) return 'bg-sky-50';
  return 'bg-slate-50';
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <div className="soft-panel p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <Link
          href={href}
          aria-label={`${title} 전체 보기`}
          title="전체 보기"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-100">{children}</div>
    </div>
  );
}

function Empty({ text, compact = false }: { text: string; compact?: boolean }) {
  return <div className={['px-3 text-center text-sm text-slate-500', compact ? 'py-4' : 'py-8'].join(' ')}>{text}</div>;
}
