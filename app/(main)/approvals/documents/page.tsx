import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listApprovalDocuments } from '@/app/lib/db/erp';
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, type RequestStatus, type RequestType } from '@/app/lib/types/hr';

export const dynamic = 'force-dynamic';

function statusClass(status: string) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default async function ApprovalDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/approvals/documents');

  const documents = await listApprovalDocuments(user);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">전자결재 문서함</h1>
        <p className="mt-1 text-sm text-slate-500">내 신청 문서와 결재 관련 문서를 최신순으로 확인합니다.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="전체 문서" value={documents.length} />
        <Metric label="결재 대기" value={documents.filter((doc) => doc.status === 'PENDING').length} />
        <Metric label="승인" value={documents.filter((doc) => doc.status === 'APPROVED').length} />
        <Metric label="반려" value={documents.filter((doc) => doc.status === 'REJECTED').length} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">문서 유형</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">신청자</th>
                <th className="px-4 py-3 font-medium">팀</th>
                <th className="px-4 py-3 font-medium">기간</th>
                <th className="px-4 py-3 font-medium">결재 진행</th>
                <th className="px-4 py-3 font-medium">신청일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{REQUEST_TYPE_LABEL[doc.requestType as RequestType] ?? doc.requestType}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(doc.status)}`}>
                      {REQUEST_STATUS_LABEL[doc.status as RequestStatus] ?? doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{doc.requesterName}</td>
                  <td className="px-4 py-3">{doc.teamName}</td>
                  <td className="px-4 py-3">{doc.startDate === doc.endDate ? doc.startDate : `${doc.startDate} ~ ${doc.endDate}`}</td>
                  <td className="px-4 py-3">{doc.approvedSteps}/{doc.stepCount}</td>
                  <td className="px-4 py-3 text-slate-500">{new Date(doc.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
              {documents.length === 0 ? (
                <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={7}>표시할 결재 문서가 없습니다.</td></tr>
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
