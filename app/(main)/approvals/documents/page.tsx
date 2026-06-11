import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listApprovalDocuments } from '@/app/lib/db/erp';
import { formatKstDate } from '@/app/lib/format/kst';

export const dynamic = 'force-dynamic';

const PAGE_SIZE_OPTIONS = [20, 40, 60] as const;

const REQUEST_TYPE_LABEL: Record<string, string> = {
  ANNUAL: '연차',
  AM_HALF: '오전 반차',
  PM_HALF: '오후 반차',
  SICK: '병가',
  OFFICIAL: '공가',
  COMP: '대체휴무',
  BUSINESS_TRIP: '출장',
  TRIP_EXPENSE: '출장 여비',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '임시저장',
  PENDING: '결재 대기',
  APPROVED: '승인',
  REJECTED: '반려',
  CANCELLED: '취소',
  REVOKED: '승인 취소',
};

function statusClass(status: string) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'CANCELLED' || status === 'REVOKED') return 'border-slate-200 bg-slate-50 text-slate-500';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

function numberParam(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const next = Number(raw);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

function pageHref(page: number, pageSize: number) {
  return `/approvals/documents?page=${page}&pageSize=${pageSize}`;
}

export default async function ApprovalDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/approvals/documents');

  const params = (await searchParams) ?? {};
  const requestedPageSize = numberParam(params.pageSize, 20);
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number]) ? requestedPageSize : 20;
  const documents = await listApprovalDocuments(user);
  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const page = Math.min(numberParam(params.page, 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  const pageDocuments = documents.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold">전자결재 문서함</h1>
          <p className="mt-1 text-sm text-slate-500">내 신청 문서와 결재 관련 문서를 최신순으로 확인합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAGE_SIZE_OPTIONS.map((size) => (
            <Link
              key={size}
              href={pageHref(1, size)}
              className={[
                'rounded-md border px-3 py-2 text-sm font-medium transition',
                pageSize === size ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              {size}개
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="전체 문서" value={documents.length} />
        <Metric label="결재 대기" value={documents.filter((doc) => doc.status === 'PENDING').length} />
        <Metric label="승인" value={documents.filter((doc) => doc.status === 'APPROVED').length} />
        <Metric label="반려" value={documents.filter((doc) => doc.status === 'REJECTED').length} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-sm text-slate-500">
          <span>총 {documents.length}건 중 {documents.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, documents.length)}건</span>
          <span>{page} / {totalPages} 페이지</span>
        </div>
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
              {pageDocuments.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/approvals/documents/${encodeURIComponent(doc.id)}`} className="hover:underline">
                      {REQUEST_TYPE_LABEL[doc.requestType] ?? doc.requestType}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${statusClass(doc.status)}`}>
                      {STATUS_LABEL[doc.status] ?? doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{doc.requesterName}</td>
                  <td className="px-4 py-3">{doc.teamName}</td>
                  <td className="px-4 py-3">{doc.startDate === doc.endDate ? doc.startDate : `${doc.startDate} ~ ${doc.endDate}`}</td>
                  <td className="px-4 py-3">{doc.approvedSteps}/{doc.stepCount}</td>
                  <td className="px-4 py-3 text-slate-500">{formatKstDate(doc.createdAt)}</td>
                </tr>
              ))}
              {pageDocuments.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>표시할 결재 문서가 없습니다.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageLink disabled={page <= 1} href={pageHref(1, pageSize)}>First</PageLink>
        <PageLink disabled={page <= 1} href={pageHref(page - 1, pageSize)}>이전</PageLink>
        {Array.from({ length: totalPages }).map((_, index) => {
          const pageNumber = index + 1;
          if (totalPages > 7 && Math.abs(pageNumber - page) > 2 && pageNumber !== 1 && pageNumber !== totalPages) return null;
          return (
            <PageLink key={pageNumber} active={pageNumber === page} href={pageHref(pageNumber, pageSize)}>
              {pageNumber}
            </PageLink>
          );
        })}
        <PageLink disabled={page >= totalPages} href={pageHref(page + 1, pageSize)}>다음</PageLink>
        <PageLink disabled={page >= totalPages} href={pageHref(totalPages, pageSize)}>Last</PageLink>
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

function PageLink({ href, children, active, disabled }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  if (disabled) {
    return <span className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-300">{children}</span>;
  }

  return (
    <Link
      href={href}
      className={[
        'rounded-md border px-3 py-2 text-sm font-medium transition',
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}
