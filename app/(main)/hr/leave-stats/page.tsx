import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listLeaveStats } from '@/app/lib/db/erp';
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, type RequestStatus, type RequestType } from '@/app/lib/types/hr';

export const dynamic = 'force-dynamic';

export default async function LeaveStatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/hr/leave-stats');
  if (user.role === 'VIEWER') redirect('/dashboard');

  const stats = await listLeaveStats();
  const approvalRate = stats.summary.totalRequests === 0 ? 0 : Math.round((stats.summary.approvedRequests / stats.summary.totalRequests) * 100);
  const maxUsedDays = Math.max(1, ...stats.teams.map((team) => team.usedLeaveDays));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">근태 / 연차 통계</h1>
          <p className="mt-1 text-sm text-slate-500">올해 신청 현황과 조직별 사용량을 실제 신청 데이터 기준으로 집계합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill active>올해</FilterPill>
          <FilterPill>이번 분기</FilterPill>
          <FilterPill>이번 달</FilterPill>
          <FilterPill active>팀 기준</FilterPill>
          <FilterPill>본부/단 확장 예정</FilterPill>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_2fr]">
        <section className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-4">
          <div className="text-sm font-medium text-amber-900">승인 대기</div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="text-4xl font-semibold text-slate-950">{stats.summary.pendingRequests}건</div>
            <div className="rounded-full border border-amber-200 bg-white/70 px-2.5 py-1 text-xs font-medium text-amber-900">
              처리 필요
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white">
            <div className="h-2 rounded-full bg-amber-300" style={{ width: `${Math.min(100, Math.max(4, stats.summary.pendingRequests * 18))}%` }} />
          </div>
          <p className="mt-3 text-xs text-amber-900/80">팀장/관리자 결재 대기 건을 우선 확인합니다.</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CompactMetric label="전체 신청" value={`${stats.summary.totalRequests}건`} helper="올해 누적" />
          <CompactMetric label="승인율" value={`${approvalRate}%`} helper={`${stats.summary.approvedRequests}/${stats.summary.totalRequests}건 승인`} />
          <CompactMetric label="반려" value={`${stats.summary.rejectedRequests}건`} helper="재검토 필요" />
          <CompactMetric label="사용 연차" value={`${stats.summary.usedLeaveDays}일`} helper="승인 기준" />
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">팀별 연차 사용</h2>
            <p className="mt-1 text-sm text-slate-500">사용량이 많은 조직부터 정렬합니다. 본부/단 확장 시에도 같은 막대 구조를 재사용합니다.</p>
          </div>
          <div className="text-xs text-slate-500">승인된 연차/반차 기준</div>
        </div>
        <div className="mt-4 space-y-3">
          {stats.teams.map((team) => {
            const width = Math.max(4, Math.round((team.usedLeaveDays / maxUsedDays) * 100));
            return (
              <div key={team.teamName} className="rounded-md border border-slate-100 bg-slate-50/50 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{team.teamName}</div>
                    <div className="text-xs text-slate-500">신청 {team.requestCount}건 · 승인 {team.approvedCount}건</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-slate-900">{team.usedLeaveDays}일</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                  <div className="h-full rounded-full bg-sky-300" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
          {stats.teams.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-8 text-center text-sm text-slate-500">집계할 신청 데이터가 없습니다.</div> : null}
        </div>
      </section>

      <details className="group rounded-lg border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">최근 신청</h2>
            <p className="mt-1 text-sm text-slate-500">최근 신청 내역을 확인합니다.</p>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 group-open:hidden">펼치기</span>
          <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 group-open:inline-flex">접기</span>
        </summary>
        <div className="mt-3 grid gap-2">
          {stats.recent.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">{item.requesterName} · {REQUEST_TYPE_LABEL[item.requestType as RequestType] ?? item.requestType}</div>
                <div className="text-xs text-slate-500">{item.teamName} / {item.startDate === item.endDate ? item.startDate : `${item.startDate} ~ ${item.endDate}`}</div>
              </div>
              <span className="w-fit rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                {REQUEST_STATUS_LABEL[item.status as RequestStatus] ?? item.status}
              </span>
            </div>
          ))}
          {stats.recent.length === 0 ? <div className="text-sm text-slate-500">최근 신청이 없습니다.</div> : null}
        </div>
      </details>
    </div>
  );
}

function CompactMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function FilterPill({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium',
        active ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
