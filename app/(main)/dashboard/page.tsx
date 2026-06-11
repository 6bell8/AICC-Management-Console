import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getPersonalDashboard } from '@/app/lib/db/personalDashboard';

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

const EMPLOYMENT_LABEL: Record<string, string> = {
  P: '정규직',
  E: '계약직',
};

function statusBadge(status: string) {
  return (
    <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', STATUS_CLASS[status] ?? STATUS_CLASS.DRAFT].join(' ')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function won(value: number) {
  return value.toLocaleString() + '원';
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');
  const data = await getPersonalDashboard(user);
  const isManager = user.role === 'HEAD' || user.role === 'ADMIN' || data.counts.pendingMyApprovals > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">내 업무 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">{data.user.name}님 기준으로 오늘 확인할 업무를 모았습니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/hr/leave" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">근태 신청</Link>
          <Link href="/hr/trip-expenses" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">출장여비</Link>
          {isManager ? <Link href="/approvals" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100">결재함</Link> : null}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Metric label="잔여 연차" value={`${data.balance.remainingDays}일`} sub={`부여 ${data.balance.grantedDays} / 사용 ${data.balance.usedDays}`} tone="emerald" />
        <Metric label="읽지 않은 알림" value={`${data.counts.unreadNotifications}건`} sub="알림함에서 확인" tone="sky" />
        <Metric label="내 결재 대기" value={`${data.counts.pendingMyApprovals}건`} sub={isManager ? '처리할 결재' : '해당 없음'} tone="amber" />
        <Metric label="소속 팀" value={data.profile.teamName} sub={`팀장 ${data.profile.teamHeadName}`} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">내 근태/연차 신청</h2>
              <p className="mt-1 text-sm text-slate-500">최근 신청한 연차, 반차, 출장 상태입니다.</p>
            </div>
            <Link href="/hr/leave" className="text-sm font-medium text-slate-600 hover:text-slate-950">전체 보기</Link>
          </div>
          <div className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {data.recentLeaveRequests.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{REQUEST_LABEL[item.requestType] ?? item.requestType}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.startDate}{item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ''}</div>
                </div>
                {statusBadge(item.status)}
              </div>
            ))}
            {data.recentLeaveRequests.length === 0 ? <Empty text="최근 근태 신청이 없습니다." /> : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">내 프로필</h2>
              <p className="mt-1 text-sm text-slate-500">조직과 연차 산정 기준입니다.</p>
            </div>
            <Link href="/mypage" className="text-sm font-medium text-slate-600 hover:text-slate-950">마이페이지</Link>
          </div>
          <dl className="grid gap-2 text-sm">
            <Info label="이메일" value={data.user.email} />
            <Info label="역할" value={data.user.role} />
            <Info label="직급" value={POSITION_LABEL[data.profile.position] ?? data.profile.position} />
            <Info label="고용형태" value={EMPLOYMENT_LABEL[data.profile.employmentType] ?? data.profile.employmentType} />
            <Info label="입사일" value={data.profile.hireDate ?? '미지정'} />
            <Info label="근속" value={`${data.profile.yearsOfService}년`} />
          </dl>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="출장여비 신청 내역" href="/hr/trip-expenses">
          {data.recentTripExpenses.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{item.origin || '-'} - {item.destination || '-'}</div>
                <div className="mt-1 text-xs text-slate-500">{won(item.totalAmount)} · {item.settlementStatus === 'PAID' ? '정산 완료' : '정산 대기'}</div>
              </div>
              {statusBadge(item.status)}
            </div>
          ))}
          {data.recentTripExpenses.length === 0 ? <Empty text="최근 출장여비 신청이 없습니다." /> : null}
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
    <div className={['rounded-lg border p-4', toneClass].join(' ')}>
      <div className="text-sm font-medium opacity-70">{label}</div>
      <div className="mt-2 truncate text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs opacity-70">{sub}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Panel({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
        <Link href={href} className="text-sm font-medium text-slate-600 hover:text-slate-950">전체 보기</Link>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-100">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-8 text-center text-sm text-slate-500">{text}</div>;
}
