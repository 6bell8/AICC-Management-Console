import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getOrganizationSeal } from '@/app/lib/db/erp';
import { getPersonalDashboard } from '@/app/lib/db/personalDashboard';
import { getEmployeeProfileDetails } from '@/app/lib/db/profileDetails';
import CertificatePrintButton from './CertificatePrintButton';

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

export default async function EmploymentCertificatePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mypage/certificate');

  const [data, profile, documentSeal] = await Promise.all([getPersonalDashboard(user), getEmployeeProfileDetails(user.id), getOrganizationSeal()]);
  const displayName = data.user.name;
  const residentNumber = profile.residentNumberMasked || '******-*******';
  const certificatePurpose = profile.certificatePurpose || '회사 제출';
  const issuedDate = new Date();
  const issuedAt = formatKoreanDate(issuedDate);
  const hireDate = data.profile.hireDate ?? '';
  const employmentPeriod = hireDate ? `${formatDotDate(hireDate)} ~ 현재 (${getTenureLabel(hireDate, issuedDate)})` : '-';
  const issueNo = `${issuedDate.getFullYear()}-${String(issuedDate.getMonth() + 1).padStart(2, '0')}${String(issuedDate.getDate()).padStart(2, '0')}-${user.id.slice(0, 5).toUpperCase()}`;
  const duty = data.profile.teamHeadName === data.user.name ? '팀장' : '-';

  return (
    <div className="mx-auto max-w-[760px] space-y-4 print:max-w-none print:space-y-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">재직증명서</h1>
          <p className="mt-1 text-sm text-slate-500">프로필 상세 정보와 조직/인사 정보를 기준으로 출력합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/mypage" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            돌아가기
          </Link>
          <CertificatePrintButton />
        </div>
      </div>

      <section className="bg-white px-8 py-8 shadow-sm ring-1 ring-slate-200 print:px-0 print:py-0 print:shadow-none print:ring-0">
        <h2 className="text-center text-3xl font-semibold tracking-[0.55em] text-black underline decoration-2 underline-offset-[12px]">재직증명서</h2>

        <table className="mt-20 w-full border-collapse border border-black text-[15px] text-black">
          <tbody>
            <tr>
              <Th>성명</Th>
              <Td>{displayName}</Td>
              <Th>주민등록번호</Th>
              <Td>{residentNumber}</Td>
            </tr>
            <tr>
              <Th>주소</Th>
              <Td colSpan={3}>{profile.address || '-'}</Td>
            </tr>
            <tr>
              <Th>소속</Th>
              <Td colSpan={3}>{buildDepartment(data.profile.teamName)}</Td>
            </tr>
            <tr>
              <Th>계약형태</Th>
              <Td colSpan={3}>{EMPLOYMENT_LABEL[data.profile.employmentType] ?? data.profile.employmentType}</Td>
            </tr>
            <tr>
              <Th>직위</Th>
              <Td>{POSITION_LABEL[data.profile.position] ?? data.profile.position}</Td>
              <Th>직책</Th>
              <Td>{duty}</Td>
            </tr>
            <tr>
              <Th>재직기간</Th>
              <Td colSpan={3}>{employmentPeriod}</Td>
            </tr>
            <tr>
              <Th>용도</Th>
              <Td colSpan={3}>{certificatePurpose}</Td>
            </tr>
          </tbody>
        </table>

        <div className="border-x border-b border-black px-8 py-10 text-center text-2xl font-semibold text-black">상기 사실을 증명함</div>

        <div className="border-x border-b border-black px-8 py-12 text-center text-black">
          <div className="text-base">{issuedAt}</div>
          <div className="relative mt-8 inline-flex items-center justify-center">
            <span className="text-3xl font-semibold tracking-[0.1em]">(주)케이티씨에스 대표이사</span>
            <ElectronicSeal imageUrl={documentSeal.sealImageUrl} />
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-6 text-xs text-black">
          <div className="space-y-1">
            <div>* 증명서 정상발급 여부 확인</div>
            <div>- 회사 인사/총무 담당 부서에서 발급번호로 확인 가능합니다.</div>
            <div>- 주민등록번호는 개인정보 보호를 위해 마스킹 처리합니다.</div>
          </div>
          <div className="text-right">발행번호 : {issueNo}</div>
        </div>
      </section>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="w-[20%] border border-black bg-slate-50 px-4 py-4 text-center font-medium tracking-[0.25em]">{children}</th>;
}

function Td({ children, colSpan }: { children: ReactNode; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className="border border-black px-4 py-4 leading-6">
      {children}
    </td>
  );
}

function ElectronicSeal({ imageUrl }: { imageUrl: string }) {
  if (imageUrl) {
    return (
      <span className="absolute -right-16 -top-4 flex h-20 w-20 rotate-[-4deg] items-center justify-center">
        <img src={imageUrl} alt="전자직인" className="max-h-20 max-w-20 object-contain" />
      </span>
    );
  }

  return (
    <span className="absolute -right-16 -top-4 flex h-20 w-20 rotate-[-4deg] items-center justify-center border-2 border-rose-500 text-rose-500">
      <span className="grid h-14 w-14 place-items-center border border-rose-400 text-center text-[11px] font-black leading-4 tracking-[0.12em]">
        KTCS
        <br />
        직인
      </span>
    </span>
  );
}

function buildDepartment(teamName: string) {
  if (!teamName || teamName === '팀 미지정') return 'AICC사업본부';
  return `AICC사업본부 AICC컨설팅단 ${teamName}`;
}

function formatKoreanDate(value: Date) {
  return `${value.getFullYear()}년 ${String(value.getMonth() + 1).padStart(2, '0')}월 ${String(value.getDate()).padStart(2, '0')}일`;
}

function formatDotDate(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function getTenureLabel(hireDate: string, now: Date) {
  const start = new Date(`${hireDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '재직중';
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  months = Math.max(0, months);
  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  if (years === 0) return `${restMonths}개월`;
  return `${years}년 ${String(restMonths).padStart(2, '0')}개월`;
}
