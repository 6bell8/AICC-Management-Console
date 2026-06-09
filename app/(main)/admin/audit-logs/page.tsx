import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listSecurityAuditLogs } from '@/app/lib/db/erp';

const ACTION_LABEL: Record<string, string> = {
  PASSWORD_RESET: '비밀번호 초기화',
  PASSWORD_CHANGED: '비밀번호 변경',
  TRIP_EXPENSE_APPROVED: '출장여비 결재 승인',
  TRIP_EXPENSE_REJECTED: '출장여비 결재 반려',
  TRIP_EXPENSE_SETTLED: '출장여비 정산 완료',
};

function formatKst(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function parseDetails(details: string) {
  try {
    return JSON.parse(details) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function formatDetails(action: string, details: string) {
  const parsed = parseDetails(details);
  if (action === 'TRIP_EXPENSE_APPROVED') {
    return parsed.finalApproval
      ? `최종 승인 · ${parsed.stepOrder ?? '-'}차 결재`
      : `${parsed.stepOrder ?? '-'}차 승인 · 다음 결재 요청`;
  }
  if (action === 'TRIP_EXPENSE_REJECTED') {
    return `반려 · ${parsed.stepOrder ?? '-'}차 결재${parsed.comment ? ` · ${parsed.comment}` : ''}`;
  }
  if (action === 'TRIP_EXPENSE_SETTLED') {
    return [
      `지급일 ${parsed.paymentDate ?? '-'}`,
      parsed.totalAmount ? `${Number(parsed.totalAmount).toLocaleString()}원` : '',
      parsed.paymentAccount ? `계좌 ${parsed.paymentAccount}` : '',
      parsed.settlementMemo ? `메모 ${parsed.settlementMemo}` : '',
    ].filter(Boolean).join(' · ');
  }
  if (action === 'PASSWORD_RESET') return '임시 비밀번호 발급 및 변경 강제';
  if (action === 'PASSWORD_CHANGED') return parsed.forced ? '임시 비밀번호 변경 완료' : '비밀번호 변경 완료';
  return details;
}

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/audit-logs');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  const logs = await listSecurityAuditLogs();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">감사 로그</h1>
        <p className="mt-1 text-sm text-slate-500">계정 보안, 권한성 작업 이력을 최신순으로 확인합니다.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="전체 로그" value={logs.length} />
        <Metric label="비밀번호 초기화" value={logs.filter((log) => log.action === 'PASSWORD_RESET').length} />
        <Metric label="출장여비 결재" value={logs.filter((log) => log.action === 'TRIP_EXPENSE_APPROVED' || log.action === 'TRIP_EXPENSE_REJECTED').length} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">시간</th>
                <th className="px-4 py-3 font-medium">작업</th>
                <th className="px-4 py-3 font-medium">수행자</th>
                <th className="px-4 py-3 font-medium">대상 계정</th>
                <th className="px-4 py-3 font-medium">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-slate-600">{formatKst(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{log.actorName}</div>
                    <div className="text-xs text-slate-500">{log.actorEmail ?? '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{log.targetName}</div>
                    <div className="text-xs text-slate-500">{log.targetEmail ?? '-'}</div>
                  </td>
                  <td className="max-w-[320px] truncate px-4 py-3 text-slate-500" title={log.details}>{formatDetails(log.action, log.details)}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>표시할 감사 로그가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
