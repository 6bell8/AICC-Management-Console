import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getPersonalDashboard } from '@/app/lib/db/personalDashboard';
import { getEmployeeProfileDetails } from '@/app/lib/db/profileDetails';
import ProfileDetailsForm from './ProfileDetailsForm';

export const dynamic = 'force-dynamic';

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

const ROLE_LABEL: Record<string, string> = {
  HEAD: '총괄 관리자',
  ADMIN: '관리자',
  OPERATOR: '운영 담당자',
  VIEWER: '조회 사용자',
};

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

const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  CANCELLED: 'border-slate-200 bg-slate-50 text-slate-500',
  REVOKED: 'border-slate-200 bg-slate-50 text-slate-500',
};

const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: '정산 대기',
  PAID: '정산 완료',
};

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mypage');
  const [data, profileDetails] = await Promise.all([getPersonalDashboard(user), getEmployeeProfileDetails(user.id)]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">마이페이지</h1>
          <p className="mt-1 text-sm text-slate-500">내 계정, 조직, 연차 기준 정보를 확인합니다.</p>
        </div>
        <Link href="/change-password" className="w-fit rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          비밀번호 변경
        </Link>
      </div>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-950">계정 정보</h2>
            <p className="mt-1 text-sm text-slate-500">로그인과 권한 기준 정보입니다.</p>
          </div>
          <dl className="space-y-2">
            <Info label="이름" value={data.user.name} />
            <Info label="이메일" value={data.user.email} />
            <Info label="역할" value={ROLE_LABEL[data.user.role] ?? data.user.role} />
            <Info label="계정 상태" value={<StatusBadge status={data.user.status} />} />
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-950">조직 / 인사 정보</h2>
            <p className="mt-1 text-sm text-slate-500">계정 승인 관리에서 지정된 HR 프로필입니다.</p>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2">
            <Info label="팀" value={data.profile.teamName} />
            <Info label="팀장" value={data.profile.teamHeadName} />
            <Info label="직급" value={POSITION_LABEL[data.profile.position] ?? data.profile.position} />
            <Info label="고용형태" value={EMPLOYMENT_LABEL[data.profile.employmentType] ?? data.profile.employmentType} />
            <Info label="입사일" value={data.profile.hireDate ?? '미지정'} />
            <Info label="근속연수" value={`${data.profile.yearsOfService}년`} />
          </dl>
        </div>
      </section>

      <section className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-emerald-950">내 연차 기준</h2>
            <p className="mt-1 text-sm text-emerald-800/80">정규직은 근속 기준, 계약직은 입사 후 만근 개월 기준으로 산정합니다.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniMetric label="부여" value={`${data.balance.grantedDays}일`} />
            <MiniMetric label="사용" value={`${data.balance.usedDays}일`} />
            <MiniMetric label="잔여" value={`${data.balance.remainingDays}일`} />
          </div>
        </div>
      </section>

      <ProfileDetailsForm profile={profileDetails} fallbackName={data.user.name} />

      <section className="grid gap-4 xl:grid-cols-2">
        <History title="최근 근태/출장 신청">
          {data.recentLeaveRequests.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-slate-100 px-3 py-3 last:border-b-0">
              <div>
                <div className="text-sm font-medium text-slate-900">{REQUEST_TYPE_LABEL[item.requestType] ?? item.requestType}</div>
                <div className="text-xs text-slate-500">{item.startDate}{item.startDate !== item.endDate ? ` ~ ${item.endDate}` : ''}</div>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
          {data.recentLeaveRequests.length === 0 ? <Empty text="최근 신청 이력이 없습니다." /> : null}
        </History>
        <History title="최근 출장여비 신청">
          {data.recentTripExpenses.map((item) => (
            <div key={item.id} className="flex items-center justify-between border-b border-slate-100 px-3 py-3 last:border-b-0">
              <div>
                <div className="text-sm font-medium text-slate-900">{item.origin || '-'} - {item.destination || '-'}</div>
                <div className="text-xs text-slate-500">{item.totalAmount.toLocaleString()}원 · {settlementStatusLabel(item.settlementStatus)}</div>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
          {data.recentTripExpenses.length === 0 ? <Empty text="최근 출장여비 이력이 없습니다." /> : null}
        </History>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-20 rounded-md border border-emerald-100 bg-white/80 px-3 py-2">
      <div className="text-xs text-emerald-700/80">{label}</div>
      <div className="mt-1 text-base font-semibold text-emerald-950">{value}</div>
    </div>
  );
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-950">{title}</h2>
      <div className="overflow-hidden rounded-md border border-slate-100">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function settlementStatusLabel(status: string) {
  const key = status.toUpperCase();
  return SETTLEMENT_STATUS_LABEL[key] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
        STATUS_BADGE_CLASS[status] ?? 'border-slate-200 bg-slate-50 text-slate-600',
      ].join(' ')}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
