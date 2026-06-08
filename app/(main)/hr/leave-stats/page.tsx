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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">근태 / 연차 통계</h1>
        <p className="mt-1 text-sm text-slate-500">올해 신청 현황과 팀별 사용량을 실제 신청 데이터 기준으로 집계합니다.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="전체 신청" value={stats.summary.totalRequests} />
        <Metric label="승인" value={stats.summary.approvedRequests} />
        <Metric label="대기" value={stats.summary.pendingRequests} />
        <Metric label="반려" value={stats.summary.rejectedRequests} />
        <Metric label="사용 연차" value={`${stats.summary.usedLeaveDays}일`} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">팀별 연차 사용</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">팀</th>
                <th className="px-3 py-2 font-medium">신청</th>
                <th className="px-3 py-2 font-medium">승인</th>
                <th className="px-3 py-2 font-medium">사용 연차</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.teams.map((team) => (
                <tr key={team.teamName}>
                  <td className="px-3 py-2 font-medium text-slate-900">{team.teamName}</td>
                  <td className="px-3 py-2">{team.requestCount}</td>
                  <td className="px-3 py-2">{team.approvedCount}</td>
                  <td className="px-3 py-2">{team.usedLeaveDays}일</td>
                </tr>
              ))}
              {stats.teams.length === 0 ? (
                <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={4}>집계할 신청 데이터가 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">최근 신청</h2>
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
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
