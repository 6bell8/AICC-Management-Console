'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { AuthUser } from '@/app/lib/db/users';
import { EMPLOYEE_POSITIONS, EMPLOYMENT_TYPES, type EmployeePosition, type EmploymentType } from '@/app/lib/types/hr';

type OrgMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  position: EmployeePosition;
  employmentType: EmploymentType;
  hireDate: string | null;
  yearsOfService: number;
};

type OrgTeam = {
  id: string;
  name: string;
  headUserId?: string | null;
  headName: string;
  members: OrgMember[];
};

type OrgData = {
  rootName?: string;
  teams: OrgTeam[];
  unassigned: OrgMember[];
};

type TeamDraft = {
  id?: string;
  name: string;
  headUserId: string;
};

type Props = {
  initialData: OrgData;
  currentUser: AuthUser;
};

const POSITION_LABEL: Record<EmployeePosition, string> = {
  STAFF: '사원',
  ASSISTANT_MANAGER: '대리',
  MANAGER: '과장',
  SENIOR_MANAGER: '차장',
  DIRECTOR: '부장 이상',
};

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  P: '정규직',
  E: '계약직',
};

function classifyTeam(teamName: string) {
  if (/개발|솔루션개발|dev/i.test(teamName)) return 'development';
  if (/인사|hr|지원|경영/i.test(teamName)) return 'support';
  return 'business';
}

function buildGroups(teams: OrgTeam[]) {
  return {
    business: teams.filter((team) => classifyTeam(team.name) === 'business'),
    development: teams.filter((team) => classifyTeam(team.name) === 'development'),
    support: teams.filter((team) => classifyTeam(team.name) === 'support'),
  };
}

function getDefaultProfile(member: OrgMember, teamId: string | null) {
  return {
    userId: member.id,
    teamId,
    position: member.position ?? 'STAFF',
    employmentType: member.employmentType ?? 'P',
    hireDate: member.hireDate,
    yearsOfService: Number(member.yearsOfService ?? 0),
  };
}

export default function OrgManagementClient({ initialData, currentUser }: Props) {
  const [data, setData] = useState(initialData);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [rootModalOpen, setRootModalOpen] = useState(false);
  const [teamDraft, setTeamDraft] = useState<TeamDraft>({ name: '', headUserId: '' });
  const [rootNameDraft, setRootNameDraft] = useState(initialData.rootName ?? 'AICC 본부');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = currentUser.role === 'HEAD';
  const rootName = data.rootName ?? 'AICC 본부';
  const groups = useMemo(() => buildGroups(data.teams), [data.teams]);
  const allMembers = useMemo(() => [...data.teams.flatMap((team) => team.members), ...data.unassigned], [data]);
  const memberCount = allMembers.length;

  async function reload() {
    setMessage(null);
    const res = await fetch('/api/admin/org', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.message || '조직 정보를 불러오지 못했습니다.');
      return;
    }
    setData(body);
    setRootNameDraft(body.rootName ?? 'AICC 본부');
  }

  function switchEditMode() {
    if (!canEdit) return;
    setMode('edit');
  }

  async function saveRootName() {
    if (!rootNameDraft.trim()) {
      setMessage('ROOT명을 입력해 주세요.');
      return;
    }
    setPendingId('root');
    setMessage(null);
    const res = await fetch('/api/admin/org', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootName: rootNameDraft.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || 'ROOT명을 저장하지 못했습니다.');
      return;
    }
    setRootModalOpen(false);
    await reload();
  }

  async function saveTeam() {
    if (!teamDraft.name.trim()) {
      setMessage('팀명을 입력해 주세요.');
      return;
    }
    setPendingId(teamDraft.id ?? 'team:new');
    setMessage(null);
    const res = await fetch('/api/admin/teams', {
      method: teamDraft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: teamDraft.id,
        name: teamDraft.name.trim(),
        headUserId: teamDraft.headUserId || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || '팀 정보를 저장하지 못했습니다.');
      return;
    }
    setTeamModalOpen(false);
    setTeamDraft({ name: '', headUserId: '' });
    await reload();
  }

  async function removeTeam(team: OrgTeam) {
    if (!confirm(`${team.name} 팀을 삭제할까요? 소속 구성원은 팀 미지정으로 이동됩니다.`)) return;
    setPendingId(`team:${team.id}`);
    setMessage(null);
    const res = await fetch(`/api/admin/teams?id=${encodeURIComponent(team.id)}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || '팀을 삭제하지 못했습니다.');
      return;
    }
    await reload();
  }

  async function updateMember(member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) {
    setPendingId(member.id);
    setMessage(null);
    const profile = { ...getDefaultProfile(member, teamId), ...patch };
    const res = await fetch('/api/admin/hr-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || '구성원 정보를 저장하지 못했습니다.');
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">조직도 / 팀 현황</h1>
          <p className="mt-1 text-sm text-slate-500">
            본부를 기준으로 단, 팀, 구성원을 확인합니다.{canEdit ? ' HEAD 계정은 편집 모드에서 조직을 관리할 수 있습니다.' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('view')} className={mode === 'view' ? activeDarkButton : idleButton}>
            조직도 보기
          </button>
          {canEdit ? (
            <button type="button" onClick={switchEditMode} className={mode === 'edit' ? activeBlueButton : idleButton}>
              편집 모드
            </button>
          ) : null}
          <button type="button" onClick={reload} className={idleButton}>
            새로고침
          </button>
        </div>
      </div>

      {message ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}

      {mode === 'view' ? (
        <OrgTree
          data={data}
          rootName={rootName}
          groups={groups}
          memberCount={memberCount}
          canEdit={canEdit}
          onManage={switchEditMode}
          onEditRoot={() => {
            setRootNameDraft(rootName);
            setRootModalOpen(true);
          }}
        />
      ) : canEdit ? (
        <EditBoard
          data={data}
          allMembers={allMembers}
          canEdit={canEdit}
          pendingId={pendingId}
          onNewTeam={() => {
            setTeamDraft({ name: '', headUserId: '' });
            setTeamModalOpen(true);
          }}
          onEditTeam={(team) => {
            setTeamDraft({ id: team.id, name: team.name, headUserId: team.headUserId ?? '' });
            setTeamModalOpen(true);
          }}
          onRemoveTeam={removeTeam}
          onUpdateMember={updateMember}
        />
      ) : (
        <OrgTree
          data={data}
          rootName={rootName}
          groups={groups}
          memberCount={memberCount}
          canEdit={false}
          onManage={switchEditMode}
          onEditRoot={() => undefined}
        />
      )}

      {teamModalOpen ? (
        <Modal title={teamDraft.id ? '팀 수정' : '팀 등록'} description="팀명과 팀장을 지정하면 조직도와 결재 흐름에 반영됩니다." onClose={() => setTeamModalOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              팀명
              <input value={teamDraft.name} onChange={(event) => setTeamDraft((prev) => ({ ...prev, name: event.target.value }))} className={inputClass} placeholder="예: 솔루션개발팀" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              팀장
              <select value={teamDraft.headUserId} onChange={(event) => setTeamDraft((prev) => ({ ...prev, headUserId: event.target.value }))} className={inputClass}>
                <option value="">팀장 미지정</option>
                {allMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} · {member.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ModalActions onCancel={() => setTeamModalOpen(false)} onSave={saveTeam} disabled={Boolean(pendingId)} />
        </Modal>
      ) : null}

      {rootModalOpen ? (
        <Modal title="ROOT명 수정" description="고객사명이나 본부명에 맞춰 조직도 최상위 이름을 변경합니다." onClose={() => setRootModalOpen(false)}>
          <input value={rootNameDraft} onChange={(event) => setRootNameDraft(event.target.value)} className={inputClass} placeholder="예: AICC 본부" />
          <ModalActions onCancel={() => setRootModalOpen(false)} onSave={saveRootName} disabled={pendingId === 'root'} />
        </Modal>
      ) : null}
    </div>
  );
}

const idleButton = 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50';
const activeDarkButton = 'rounded-md border border-slate-300 bg-slate-900 px-3 py-2 text-sm font-medium text-white transition';
const activeBlueButton = 'rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition';
const inputClass = 'mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function OrgTree({
  data,
  rootName,
  groups,
  memberCount,
  canEdit,
  onManage,
  onEditRoot,
}: {
  data: OrgData;
  rootName: string;
  groups: ReturnType<typeof buildGroups>;
  memberCount: number;
  canEdit: boolean;
  onManage: () => void;
  onEditRoot: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-slate-500">ROOT</div>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{rootName}</h2>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">팀 {data.teams.length}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">구성원 {memberCount}</span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">미지정 {data.unassigned.length}</span>
            {canEdit ? (
              <button type="button" onClick={onEditRoot} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100">
                ROOT명 수정
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" onClick={onManage} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 font-medium text-blue-700 hover:bg-blue-100">
                편집
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="relative pl-5">
          <div className="absolute bottom-0 left-2 top-0 w-px bg-slate-200" />
          <DivisionNode
            title="컨설팅단"
            subtitle="사업 수행과 솔루션 개발 조직"
            groups={[
              { title: '사업팀', description: '고객/영업/컨설팅 수행', teams: groups.business },
              { title: '개발팀', description: 'AICC 솔루션 개발 및 운영', teams: groups.development },
            ]}
          />
          <DivisionNode title="경영지원단" subtitle="인사, 정산, 운영 지원" groups={[{ title: '지원팀', description: '인사/정산/공통 운영', teams: groups.support }]} />
        </div>
      </div>
    </section>
  );
}

function DivisionNode({
  title,
  subtitle,
  groups,
}: {
  title: string;
  subtitle: string;
  groups: Array<{ title: string; description: string; teams: OrgTeam[] }>;
}) {
  const teamCount = groups.reduce((sum, group) => sum + group.teams.length, 0);
  const memberCount = groups.reduce((sum, group) => sum + group.teams.reduce((subtotal, team) => subtotal + team.members.length, 0), 0);

  return (
    <section className="relative mb-5 pl-6">
      <div className="absolute left-[-12px] top-4 h-px w-8 bg-slate-200" />
      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className="flex gap-2 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{teamCount}팀</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{memberCount}명</span>
          </div>
        </div>
        <div className="grid gap-3 p-4 xl:grid-cols-2">
          {groups.map((group) => <GroupNode key={group.title} {...group} />)}
        </div>
      </div>
    </section>
  );
}

function GroupNode({ title, description, teams }: { title: string; description: string; teams: OrgTeam[] }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/60">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">{description}</div>
          </div>
          <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{teams.length}팀</span>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {teams.map((team) => <TeamNode key={team.id} team={team} />)}
        {teams.length === 0 ? <div className="px-3 py-6 text-center text-sm text-slate-500">배정된 팀이 없습니다.</div> : null}
      </div>
    </div>
  );
}

function TeamNode({ team }: { team: OrgTeam }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{team.name}</div>
          <div className="text-xs text-slate-500">팀장: {team.headName || '미지정'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">{team.members.length}명</span>
          <span className="text-xs text-slate-400 group-open:hidden">펼치기</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">접기</span>
        </div>
      </summary>
      <div className="border-t border-slate-100 bg-white/80">
        {team.members.map((member) => <MemberRow key={member.id} member={member} />)}
        {team.members.length === 0 ? <div className="px-3 py-3 text-sm text-slate-500">소속 구성원이 없습니다.</div> : null}
      </div>
    </details>
  );
}

function MemberRow({ member }: { member: OrgMember }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">{member.name}</div>
        <div className="truncate text-xs text-slate-500">{member.email}</div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{member.role}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{POSITION_LABEL[member.position] ?? member.position}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5">{EMPLOYMENT_LABEL[member.employmentType] ?? member.employmentType}</span>
      </div>
    </div>
  );
}

function EditBoard({
  data,
  allMembers,
  canEdit,
  pendingId,
  onNewTeam,
  onEditTeam,
  onRemoveTeam,
  onUpdateMember,
}: {
  data: OrgData;
  allMembers: OrgMember[];
  canEdit: boolean;
  pendingId: string | null;
  onNewTeam: () => void;
  onEditTeam: (team: OrgTeam) => void;
  onRemoveTeam: (team: OrgTeam) => void;
  onUpdateMember: (member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">조직 편집 보드</h2>
            <p className="mt-1 text-sm text-slate-500">팀을 만들고 구성원을 원하는 팀으로 이동시키는 칸반형 관리 화면입니다.</p>
          </div>
          <button type="button" onClick={onNewTeam} disabled={!canEdit} className="w-fit rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            팀 추가
          </button>
        </div>
      </div>

      {!canEdit ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">HEAD 계정만 조직을 편집할 수 있습니다.</div> : null}

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-3">
          <KanbanColumn title="팀 미지정" subtitle="배치가 필요한 구성원" members={data.unassigned} teams={data.teams} teamId={null} canEdit={canEdit} pendingId={pendingId} onUpdateMember={onUpdateMember} />
          {data.teams.map((team) => (
            <KanbanColumn
              key={team.id}
              title={team.name}
              subtitle={`팀장: ${team.headName || '미지정'}`}
              members={team.members}
              teams={data.teams}
              teamId={team.id}
              team={team}
              canEdit={canEdit}
              pendingId={pendingId}
              onEditTeam={onEditTeam}
              onRemoveTeam={onRemoveTeam}
              onUpdateMember={onUpdateMember}
            />
          ))}
          {data.teams.length === 0 ? <div className="w-[320px] rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">등록된 팀이 없습니다.</div> : null}
        </div>
      </div>
    </section>
  );
}

function KanbanColumn({
  title,
  subtitle,
  members,
  teams,
  teamId,
  team,
  canEdit,
  pendingId,
  onEditTeam,
  onRemoveTeam,
  onUpdateMember,
}: {
  title: string;
  subtitle: string;
  members: OrgMember[];
  teams: OrgTeam[];
  teamId: string | null;
  team?: OrgTeam;
  canEdit: boolean;
  pendingId: string | null;
  onEditTeam?: (team: OrgTeam) => void;
  onRemoveTeam?: (team: OrgTeam) => void;
  onUpdateMember: (member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) => void;
}) {
  return (
    <div className="w-[340px] shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
      <div className="border-b border-slate-100 bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-950">{title}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{subtitle}</div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">{members.length}</span>
        </div>
        {team ? (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => onEditTeam?.(team)} disabled={!canEdit} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              팀 수정
            </button>
            <button type="button" onClick={() => onRemoveTeam?.(team)} disabled={!canEdit} className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100 disabled:opacity-50">
              삭제
            </button>
          </div>
        ) : null}
      </div>
      <div className="max-h-[640px] space-y-2 overflow-y-auto p-2">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} teams={teams} teamId={teamId} disabled={!canEdit || pendingId === member.id} onUpdateMember={onUpdateMember} />
        ))}
        {members.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">구성원이 없습니다.</div> : null}
      </div>
    </div>
  );
}

function MemberCard({
  member,
  teams,
  teamId,
  disabled,
  onUpdateMember,
}: {
  member: OrgMember;
  teams: OrgTeam[];
  teamId: string | null;
  disabled: boolean;
  onUpdateMember: (member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) => void;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-white p-3 shadow-sm">
      <div className="mb-3">
        <div className="truncate text-sm font-semibold text-slate-950">{member.name}</div>
        <div className="truncate text-xs text-slate-500">{member.email}</div>
      </div>
      <div className="grid gap-2">
        <label className="text-xs font-medium text-slate-500">
          팀
          <select value={teamId ?? ''} disabled={disabled} onChange={(event) => onUpdateMember(member, event.target.value || null, { teamId: event.target.value || null })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-100">
            <option value="">팀 미지정</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-slate-500">
            직급
            <select value={member.position} disabled={disabled} onChange={(event) => onUpdateMember(member, teamId, { position: event.target.value as EmployeePosition })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-100">
              {EMPLOYEE_POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {POSITION_LABEL[position]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            고용
            <select value={member.employmentType} disabled={disabled} onChange={(event) => onUpdateMember(member, teamId, { employmentType: event.target.value as EmploymentType })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-100">
              {EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EMPLOYMENT_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-[1fr_74px] gap-2">
          <label className="text-xs font-medium text-slate-500">
            입사일
            <input type="date" value={member.hireDate ?? ''} disabled={disabled} onChange={(event) => onUpdateMember(member, teamId, { hireDate: event.target.value || null })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-100" />
          </label>
          <label className="text-xs font-medium text-slate-500">
            근속
            <input type="number" min={0} max={80} value={member.yearsOfService} disabled={disabled} onChange={(event) => onUpdateMember(member, teamId, { yearsOfService: Math.max(0, Number(event.target.value || 0)) })} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 disabled:bg-slate-100" />
          </label>
        </div>
      </div>
    </div>
  );
}

function Modal({ title, description, children, onClose }: { title: string; description: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, disabled }: { onCancel: () => void; onSave: () => void; disabled: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
        취소
      </button>
      <button type="button" onClick={onSave} disabled={disabled} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
        저장
      </button>
    </div>
  );
}
