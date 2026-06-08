import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listOrganizationSnapshot } from '@/app/lib/db/erp';
import { EMPLOYEE_POSITION_LABEL, EMPLOYMENT_TYPE_LABEL, type EmployeePosition, type EmploymentType } from '@/app/lib/types/hr';

export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/org');
  if (user.role !== 'HEAD' && user.role !== 'ADMIN') redirect('/dashboard');

  const data = await listOrganizationSnapshot();
  const memberCount = data.teams.reduce((sum, team) => sum + team.members.length, 0) + data.unassigned.length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">조직도 / 팀 현황</h1>
        <p className="mt-1 text-sm text-slate-500">팀, 팀장, 구성원, 고용 형태를 한 번에 확인합니다.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="팀" value={data.teams.length} />
        <Metric label="구성원" value={memberCount} />
        <Metric label="팀 미지정" value={data.unassigned.length} />
      </div>

      <div className="grid gap-3">
        {data.teams.map((team) => (
          <section key={team.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">{team.name}</h2>
                <p className="text-sm text-slate-500">팀장: {team.headName}</p>
              </div>
              <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                {team.members.length}명
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {team.members.map((member) => <MemberCard key={String(member.id)} member={member} />)}
              {team.members.length === 0 ? <div className="text-sm text-slate-500">소속 구성원이 없습니다.</div> : null}
            </div>
          </section>
        ))}
      </div>

      {data.unassigned.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h2 className="text-base font-semibold text-slate-950">팀 미지정 계정</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.unassigned.map((member) => <MemberCard key={member.id} member={member} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MemberCard({ member }: { member: Record<string, unknown> }) {
  const position = member.position as EmployeePosition;
  const employmentType = member.employmentType as EmploymentType;
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">{String(member.name)}</div>
          <div className="truncate text-xs text-slate-500">{String(member.email)}</div>
        </div>
        <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{String(member.role)}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{EMPLOYEE_POSITION_LABEL[position] ?? String(position)}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{EMPLOYMENT_TYPE_LABEL[employmentType] ?? String(employmentType)}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">근속 {Number(member.yearsOfService ?? 0)}년</span>
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
