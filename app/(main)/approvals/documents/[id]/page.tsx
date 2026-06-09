import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getApprovalDocumentDetail } from '@/app/lib/db/erp';
import { REQUEST_STATUS_LABEL, REQUEST_TYPE_LABEL, type RequestStatus, type RequestType } from '@/app/lib/types/hr';

export const dynamic = 'force-dynamic';

function statusClass(status: string) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default async function ApprovalDocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/approvals/documents/${encodeURIComponent(id)}`);

  const doc = await getApprovalDocumentDetail(user, id);
  if (!doc) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">전자결재 문서 상세</h1>
          <p className="mt-1 text-sm text-slate-500">신청 정보와 결재선 처리 이력을 확인합니다.</p>
        </div>
        <Link href="/approvals/documents" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          문서함으로
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="문서 유형" value={REQUEST_TYPE_LABEL[doc.requestType as RequestType] ?? doc.requestType} />
          <Detail label="상태" value={REQUEST_STATUS_LABEL[doc.status as RequestStatus] ?? doc.status} badgeClass={statusClass(doc.status)} />
          <Detail label="신청자" value={`${doc.requesterName} (${doc.requesterEmail})`} />
          <Detail label="팀" value={doc.teamName} />
          <Detail label="기간" value={doc.startDate === doc.endDate ? String(doc.startDate) : `${doc.startDate} ~ ${doc.endDate}`} />
          <Detail label="신청일" value={new Date(doc.createdAt).toLocaleString('ko-KR')} />
          <Detail label="수정일" value={new Date(doc.updatedAt).toLocaleString('ko-KR')} />
        </div>
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium text-slate-700">신청 내용</div>
          <div className="min-h-[96px] whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50/60 p-3 text-sm text-slate-700">{doc.reason}</div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold">결재선</h2>
        <div className="mt-3 grid gap-2">
          {doc.steps.map((step) => (
            <div key={step.id} className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">{step.order}차 결재 · {step.approverName}</div>
                <div className="text-xs text-slate-500">{step.approverEmail}</div>
                {step.comment ? <div className="mt-1 text-xs text-rose-600">반려/처리 메모: {step.comment}</div> : null}
              </div>
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(step.status)}`}>{step.status}</span>
                <span className="text-xs text-slate-500">{step.decidedAt ? new Date(step.decidedAt).toLocaleString('ko-KR') : '미처리'}</span>
              </div>
            </div>
          ))}
          {doc.steps.length === 0 ? <div className="text-sm text-slate-500">등록된 결재선이 없습니다.</div> : null}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value, badgeClass }: { label: string; value: string; badgeClass?: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      {badgeClass ? (
        <span className={`mt-1 inline-flex rounded-full border px-2 py-1 text-xs font-medium ${badgeClass}`}>{value}</span>
      ) : (
        <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
      )}
    </div>
  );
}
