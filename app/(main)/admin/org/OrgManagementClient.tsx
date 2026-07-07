'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronRight, FolderPlus, Loader2, Network, Pencil, Settings2, Trash2 } from 'lucide-react';

import { RichSelect } from '@/app/components/ui/select';
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
  divisionName: string;
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
  divisionName: string;
  headUserId: string;
};

type DivisionGroup = {
  name: string;
  teams: OrgTeam[];
  memberCount: number;
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

const activeGreenButton = 'inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 shadow-sm';
const activeBlueButton = 'inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm';
const idleButton = 'inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50';
const inputClass = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';
const smallInputClass = 'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

function buildDivisions(teams: OrgTeam[]): DivisionGroup[] {
  const divisions = new Map<string, OrgTeam[]>();
  for (const team of teams) {
    const divisionName = team.divisionName?.trim() || '운영단';
    divisions.set(divisionName, [...(divisions.get(divisionName) ?? []), team]);
  }
  return Array.from(divisions.entries()).map(([name, divisionTeams]) => ({
    name,
    teams: divisionTeams,
    memberCount: divisionTeams.reduce((sum, team) => sum + team.members.length, 0),
  }));
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
  const [teamDraft, setTeamDraft] = useState<TeamDraft>({ name: '', divisionName: '운영단', headUserId: '' });
  const [headSearch, setHeadSearch] = useState('');
  const [rootNameDraft, setRootNameDraft] = useState(initialData.rootName ?? 'AICC 본부');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = currentUser.role === 'HEAD';
  const rootName = data.rootName ?? 'AICC 본부';
  const divisions = useMemo(() => buildDivisions(data.teams), [data.teams]);
  const allMembers = useMemo(() => [...data.teams.flatMap((team) => team.members), ...data.unassigned], [data]);
  const selectedHead = allMembers.find((member) => member.id === teamDraft.headUserId) ?? null;
  const headCandidates = useMemo(() => {
    const keyword = headSearch.trim().toLowerCase();
    if (!keyword) return allMembers.slice(0, 8);
    return allMembers.filter((member) => `${member.name} ${member.email} ${member.role}`.toLowerCase().includes(keyword)).slice(0, 12);
  }, [allMembers, headSearch]);
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
        divisionName: teamDraft.divisionName.trim() || '운영단',
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
    setTeamDraft({ name: '', divisionName: '운영단', headUserId: '' });
    await reload();
  }

  async function removeTeam(team: OrgTeam) {
    if (!confirm(`${team.name} 팀을 삭제할까요? 소속 구성원은 팀 미지정으로 이동합니다.`)) return;
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

  function applyMemberProfileUpdate(member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) {
    const nextMember: OrgMember = {
      ...member,
      position: patch.position ?? member.position,
      employmentType: patch.employmentType ?? member.employmentType,
      hireDate: patch.hireDate === undefined ? member.hireDate : patch.hireDate,
      yearsOfService: patch.yearsOfService ?? member.yearsOfService,
    };

    setData((prev) => ({
      ...prev,
      teams: prev.teams.map((team) => ({
        ...team,
        members: team.id === teamId ? [...team.members.filter((item) => item.id !== member.id), nextMember] : team.members.filter((item) => item.id !== member.id),
      })),
      unassigned: teamId ? prev.unassigned.filter((item) => item.id !== member.id) : [...prev.unassigned.filter((item) => item.id !== member.id), nextMember],
    }));
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
    applyMemberProfileUpdate(member, teamId, patch);
    await reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-950">조직도 / 팀 현황</h1>
          <p className="mt-1 text-sm text-slate-500">본부를 기준으로 팀과 구성원을 확인합니다.{canEdit ? ' HEAD 계정은 편집 모드에서 조직을 관리할 수 있습니다.' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('view')} className={mode === 'view' ? activeGreenButton : idleButton}>
            <Network className="h-4 w-4" aria-hidden="true" />
            조직도 보기
          </button>
          {canEdit ? (
            <button type="button" onClick={() => setMode('edit')} className={mode === 'edit' ? activeBlueButton : idleButton}>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              편집 모드
            </button>
          ) : null}
        </div>
      </div>

      {message ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div> : null}

      {mode === 'view' ? (
        <OrgTree
          data={data}
          rootName={rootName}
          divisions={divisions}
          memberCount={memberCount}
          canEdit={canEdit}
          onEditRoot={() => {
            setRootNameDraft(rootName);
            setRootModalOpen(true);
          }}
        />
      ) : canEdit ? (
        <EditBoard
          data={data}
          canEdit={canEdit}
          pendingId={pendingId}
          onNewTeam={(divisionName) => {
            setTeamDraft({ name: '', divisionName: divisionName || '운영단', headUserId: '' });
            setHeadSearch('');
            setTeamModalOpen(true);
          }}
          onEditTeam={(team) => {
            setTeamDraft({ id: team.id, name: team.name, divisionName: team.divisionName || '운영단', headUserId: team.headUserId ?? '' });
            setHeadSearch('');
            setTeamModalOpen(true);
          }}
          onRemoveTeam={removeTeam}
          onUpdateMember={updateMember}
        />
      ) : (
        <OrgTree data={data} rootName={rootName} divisions={divisions} memberCount={memberCount} canEdit={false} onEditRoot={() => undefined} />
      )}

      {teamModalOpen ? (
        <Modal title={teamDraft.id ? '팀 수정' : '팀 추가'} description="단, 팀명, 팀장을 지정합니다." onClose={() => setTeamModalOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              단
              <input value={teamDraft.divisionName} onChange={(event) => setTeamDraft((prev) => ({ ...prev, divisionName: event.target.value }))} className={`${inputClass} mt-1`} placeholder="예: 운영단" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              팀명
              <input value={teamDraft.name} onChange={(event) => setTeamDraft((prev) => ({ ...prev, name: event.target.value }))} className={`${inputClass} mt-1`} placeholder="예: AICC 운영팀" />
            </label>
            <div className="block text-sm font-medium text-slate-700">
              팀장
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                {selectedHead ? (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-blue-900">{selectedHead.name}</div>
                      <div className="truncate text-xs font-normal text-blue-700">{selectedHead.email}</div>
                    </div>
                    <button type="button" onClick={() => setTeamDraft((prev) => ({ ...prev, headUserId: '' }))} className="shrink-0 rounded-md border border-blue-100 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                      해제
                    </button>
                  </div>
                ) : (
                  <div className="mb-2 rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-xs font-normal text-slate-500">팀장 미지정</div>
                )}
                <input value={headSearch} onChange={(event) => setHeadSearch(event.target.value)} className={inputClass} placeholder="이름, 로그인 ID, 권한 검색" />
                <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-slate-100 bg-white">
                  {headCandidates.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => {
                        setTeamDraft((prev) => ({ ...prev, headUserId: member.id }));
                        setHeadSearch('');
                      }}
                      className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 ${teamDraft.headUserId === member.id ? 'bg-blue-50/70' : ''}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">{member.name}</span>
                        <span className="block truncate text-xs font-normal text-slate-500">{member.email}</span>
                      </span>
                      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-normal text-slate-500">{member.role}</span>
                    </button>
                  ))}
                  {headCandidates.length === 0 ? <div className="px-3 py-6 text-center text-sm font-normal text-slate-500">검색 결과가 없습니다.</div> : null}
                </div>
              </div>
            </div>
          </div>
          <ModalActions onCancel={() => setTeamModalOpen(false)} onSave={saveTeam} disabled={Boolean(pendingId)} />
        </Modal>
      ) : null}

      {rootModalOpen ? (
        <Modal title="조직 ROOT 수정" description="조직도 최상단에 표시되는 본부명을 변경합니다." onClose={() => setRootModalOpen(false)}>
          <label className="block text-sm font-medium text-slate-700">
            ROOT명
            <input value={rootNameDraft} onChange={(event) => setRootNameDraft(event.target.value)} className={`${inputClass} mt-1`} placeholder="예: AICC 사업본부" />
          </label>
          <ModalActions onCancel={() => setRootModalOpen(false)} onSave={saveRootName} disabled={pendingId === 'root'} />
        </Modal>
      ) : null}
    </div>
  );
}

function OrgTree({
  data,
  rootName,
  divisions,
  memberCount,
  canEdit,
  onEditRoot,
}: {
  data: OrgData;
  rootName: string;
  divisions: DivisionGroup[];
  memberCount: number;
  canEdit: boolean;
  onEditRoot: () => void;
}) {
  const [selectedDivisionName, setSelectedDivisionName] = useState(divisions[0]?.name ?? '');
  const selectedDivision = divisions.find((division) => division.name === selectedDivisionName) ?? divisions[0] ?? null;
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(selectedDivision?.teams[0]?.id ?? null);
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? null;

  return (
    <section className="space-y-4">
      <div className="mt-2 flex items-end justify-between gap-3 border-t border-slate-100 pt-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-950">{rootName}</h2>
          <p className="mt-1 text-sm text-slate-500">{data.teams.length}개 팀 · {memberCount}명 구성원</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={onEditRoot} className={`${idleButton} shrink-0`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            본부명 수정
          </button>
        ) : null}
      </div>

      <OrgMiniMap
        rootName={rootName}
        divisions={divisions}
        activeDivisionName={selectedDivision?.name}
        activeTeamId={selectedTeamId}
        onSelectDivision={(division) => {
          setSelectedDivisionName(division.name);
          setSelectedTeamId(division.teams[0]?.id ?? null);
        }}
        onSelectTeam={(division, team) => {
          setSelectedDivisionName(division.name);
          setSelectedTeamId(team.id);
        }}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{selectedTeam ? selectedTeam.name : selectedDivision?.name ?? '조직 상세'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedTeam ? `팀장 ${selectedTeam.headName || '미지정'} · ${selectedTeam.members.length}명` : selectedDivision ? `${selectedDivision.teams.length}개 팀 · ${selectedDivision.memberCount}명` : '선택된 조직이 없습니다.'}
            </p>
          </div>
          {selectedDivision ? <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{selectedDivision.name}</span> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {selectedTeam ? (
            selectedTeam.members.length > 0 ? (
              selectedTeam.members.map((member) => <MemberRow key={member.id} member={member} />)
            ) : (
              <div className="rounded-md border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">소속 구성원이 없습니다.</div>
            )
          ) : selectedDivision ? (
            selectedDivision.teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-left transition hover:bg-slate-100"
              >
                <div className="text-sm font-semibold text-slate-900">{team.name}</div>
                <div className="mt-1 text-xs text-slate-500">팀장 {team.headName || '미지정'} · {team.members.length}명</div>
              </button>
            ))
          ) : null}
        </div>
      </div>

      {data.unassigned.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">팀 미지정 구성원</h3>
              <p className="text-sm text-amber-700">계정 승인 후 팀이 연결되지 않은 구성원입니다.</p>
            </div>
            <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-700">{data.unassigned.length}명</span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {data.unassigned.map((member) => <MemberRow key={member.id} member={member} />)}
          </div>
        </div>
      ) : null}
    </section>
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

function OrgMiniMap({
  rootName,
  divisions,
  activeDivisionName,
  activeTeamId,
  onSelectDivision,
  onSelectTeam,
  compactHeader = false,
}: {
  rootName: string;
  divisions: DivisionGroup[];
  activeDivisionName?: string;
  activeTeamId?: string | null;
  onSelectDivision?: (division: DivisionGroup) => void;
  onSelectTeam?: (division: DivisionGroup, team: OrgTeam) => void;
  compactHeader?: boolean;
}) {
  return (
    <div className={compactHeader ? 'bg-white' : 'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'}>
      {compactHeader ? null : (
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">조직도 맵</h2>
          <p className="mt-1 text-sm text-slate-500">본부, 단, 팀 흐름을 한눈에 확인합니다.</p>
        </div>
      )}
      <div className="-mx-4 overflow-x-auto px-4 py-5 sm:mx-0">
        <div className="mx-auto min-w-[720px] max-w-6xl">
          <div className="flex justify-center">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-5 py-2 text-sm font-semibold text-blue-800 shadow-sm">{rootName}</div>
          </div>
          <div className="mx-auto h-6 w-px bg-slate-200" />
          <div className="h-px bg-slate-200" />
          <div className="grid gap-4 pt-6" style={{ gridTemplateColumns: `repeat(${Math.max(divisions.length, 1)}, minmax(180px, 1fr))` }}>
            {divisions.map((division) => {
              const activeDivision = activeDivisionName === division.name;
              return (
                <div key={division.name} className="flex min-w-0 flex-col items-center">
                  <div className="h-5 w-px bg-slate-200" />
                  <button
                    type="button"
                    onClick={() => onSelectDivision?.(division)}
                    className={`w-full rounded-md border px-3 py-2 text-center text-sm font-semibold transition ${
                      activeDivision ? 'border-blue-300 bg-blue-600 text-white shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                    } ${onSelectDivision ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {division.name}
                  </button>
                  <div className="h-5 w-px bg-slate-200" />
                  <div className="grid w-full gap-2">
                    {division.teams.map((team) => {
                      const activeTeam = activeTeamId === team.id;
                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => onSelectTeam?.(division, team)}
                          className={`rounded-md border px-2 py-2 text-center text-xs transition ${
                            activeTeam ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          } ${onSelectTeam ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span className="block truncate font-semibold">{team.name}</span>
                          <span className="mt-0.5 block text-[11px] opacity-75">{team.members.length}명</span>
                        </button>
                      );
                    })}
                    {division.teams.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 px-2 py-4 text-center text-xs text-slate-400">팀 없음</div> : null}
                  </div>
                </div>
              );
            })}
            {divisions.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">등록된 단이 없습니다.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditBoard({
  data,
  canEdit,
  pendingId,
  onNewTeam,
  onEditTeam,
  onRemoveTeam,
  onUpdateMember,
}: {
  data: OrgData;
  canEdit: boolean;
  pendingId: string | null;
  onNewTeam: (divisionName?: string) => void;
  onEditTeam: (team: OrgTeam) => void;
  onRemoveTeam: (team: OrgTeam) => void;
  onUpdateMember: (member: OrgMember, teamId: string | null, patch: Partial<ReturnType<typeof getDefaultProfile>>) => void;
}) {
  const divisions = useMemo(() => buildDivisions(data.teams), [data.teams]);
  const [focusedPane, setFocusedPane] = useState<'division' | 'team' | 'members'>('members');
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedDivisionName, setSelectedDivisionName] = useState(() => data.teams[0]?.divisionName || divisions[0]?.name || '운영단');
  const currentDivision = divisions.find((division) => division.name === selectedDivisionName) ?? divisions[0] ?? { name: selectedDivisionName, teams: [], memberCount: 0 };
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(currentDivision.teams[0]?.id ?? null);
  const divisionTeams = currentDivision.teams;
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId) ?? null;
  const selectedMembers = selectedTeam ? selectedTeam.members : data.unassigned;
  const selectedTitle = selectedTeam?.name ?? '팀 미지정';
  const selectedSubtitle = selectedTeam ? `팀장 ${selectedTeam.headName || '미지정'}` : '아직 팀에 배정되지 않은 구성원입니다.';
  const layoutClass =
    focusedPane === 'division'
      ? 'xl:grid-cols-[340px_240px_minmax(0,1fr)]'
      : focusedPane === 'team'
        ? 'xl:grid-cols-[220px_360px_minmax(0,1fr)]'
        : 'xl:grid-cols-[200px_240px_minmax(0,1.4fr)]';

  return (
    <section className={`grid gap-4 transition-[grid-template-columns] duration-300 ${layoutClass}`}>
      <aside
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
          focusedPane === 'division' ? 'border-blue-200 ring-2 ring-blue-50' : 'border-slate-200'
        }`}
        onClick={() => setFocusedPane('division')}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">단 편집</h2>
              <p className="mt-1 text-xs text-slate-500">상위 조직 단위를 먼저 선택합니다.</p>
            </div>
          </div>
        </div>
        <div className="max-h-[680px] overflow-y-auto p-2">
          {divisions.map((division) => (
            <button
              key={division.name}
              type="button"
              onClick={() => {
                setFocusedPane('division');
                setSelectedDivisionName(division.name);
                setSelectedTeamId(division.teams[0]?.id ?? null);
              }}
              className={`mb-1 w-full rounded-md border px-3 py-2 text-left transition ${
                currentDivision.name === division.name ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-transparent bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{division.name}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">{division.teams.length}</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{division.memberCount}명 · 팀 {division.teams.length}개</div>
            </button>
          ))}
          {divisions.length === 0 ? <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500">등록된 단이 없습니다.</div> : null}
        </div>
      </aside>

      <aside
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
          focusedPane === 'team' ? 'border-blue-200 ring-2 ring-blue-50' : 'border-slate-200'
        }`}
        onClick={() => setFocusedPane('team')}
      >
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">팀 편집</h2>
              <p className="mt-1 text-xs text-slate-500">{currentDivision.name}에 속한 팀을 관리합니다.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFocusedPane('team');
                onNewTeam(currentDivision.name);
              }}
              disabled={!canEdit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              팀 추가
            </button>
          </div>
        </div>
        <div className="max-h-[680px] overflow-y-auto p-2">
          {divisionTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => {
                setFocusedPane('team');
                setSelectedTeamId(team.id);
              }}
              className={`mb-1 w-full rounded-md border px-3 py-2 text-left transition ${
                selectedTeamId === team.id ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-transparent bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">{team.name}</span>
                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">{team.members.length}</span>
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">팀장 {team.headName || '미지정'}</div>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setFocusedPane('team');
              setSelectedTeamId(null);
            }}
            className={`mt-2 w-full rounded-md border px-3 py-2 text-left transition ${
              selectedTeamId === null ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-transparent bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">팀 미지정</span>
              <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-xs text-amber-700">{data.unassigned.length}</span>
            </div>
            <div className="mt-1 truncate text-xs text-slate-500">배치가 필요한 구성원</div>
          </button>
        </div>
      </aside>

      <div
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
          focusedPane === 'members' ? 'border-blue-200 ring-2 ring-blue-50' : 'border-slate-200'
        }`}
        onClick={() => setFocusedPane('members')}
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{selectedTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{selectedSubtitle} · {selectedMembers.length}명</p>
          </div>
          {selectedTeam ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => onEditTeam(selectedTeam)} disabled={!canEdit} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Pencil className="h-4 w-4" aria-hidden="true" />
                팀 정보 수정
              </button>
              <button type="button" onClick={() => onRemoveTeam(selectedTeam)} disabled={!canEdit} className="inline-flex items-center gap-1.5 rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                삭제
              </button>
            </div>
          ) : null}
        </div>

        {!canEdit ? <div className="m-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">HEAD 계정만 조직도를 편집할 수 있습니다.</div> : null}

        <div className="relative">
          {pendingId ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                잠시만 기다려주세요.
              </div>
            </div>
          ) : null}
          <div className="grid gap-3 p-3 min-[481px]:hidden">
            {selectedMembers.map((member) => {
              const disabled = !canEdit || pendingId === member.id;
              const currentTeamId = selectedTeam?.id ?? null;
              return (
                <div key={member.id} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{member.name}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{member.email}</div>
                  </div>

                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-semibold text-slate-500">소속 팀</span>
                      <RichSelect
                        value={currentTeamId ?? ''}
                        disabled={disabled}
                        onChange={(value) => {
                          const nextTeamId = value || null;
                          const nextTeam = data.teams.find((team) => team.id === nextTeamId);
                          if (nextTeam) setSelectedDivisionName(nextTeam.divisionName || '운영단');
                          setSelectedTeamId(nextTeamId);
                          onUpdateMember(member, nextTeamId, { teamId: nextTeamId });
                        }}
                        options={[
                          { value: '', label: '팀 미지정' },
                          ...data.teams.map((team) => ({ value: team.id, label: team.name, description: team.divisionName || '소속 단 미지정' })),
                        ]}
                        buttonClassName="min-h-11 rounded-md border-slate-200 px-3 text-sm"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">직급</span>
                        <RichSelect
                          value={member.position}
                          disabled={disabled}
                          onChange={(value) => onUpdateMember(member, currentTeamId, { position: value as EmployeePosition })}
                          options={EMPLOYEE_POSITIONS.map((position) => ({ value: position, label: POSITION_LABEL[position] }))}
                          buttonClassName="min-h-11 rounded-md border-slate-200 px-3 text-sm"
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">고용</span>
                        <RichSelect
                          value={member.employmentType}
                          disabled={disabled}
                          onChange={(value) => onUpdateMember(member, currentTeamId, { employmentType: value as EmploymentType })}
                          options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_LABEL[type] }))}
                          buttonClassName="min-h-11 rounded-md border-slate-200 px-3 text-sm"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">입사일</span>
                        <input type="date" value={member.hireDate ?? ''} disabled={disabled} onChange={(event) => onUpdateMember(member, currentTeamId, { hireDate: event.target.value || null })} className={`${smallInputClass} min-h-11`} />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-semibold text-slate-500">근속</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={80}
                            value={member.yearsOfService}
                            disabled={disabled}
                            onChange={(event) => onUpdateMember(member, currentTeamId, { yearsOfService: Math.max(0, Number(event.target.value || 0)) })}
                            className={`${smallInputClass} min-h-11 text-right`}
                          />
                          <span className="text-xs text-slate-500">년</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            {selectedMembers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-8 text-center text-sm text-slate-500">
                표시할 구성원이 없습니다.
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto max-[480px]:hidden">
          <table className="min-w-[920px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">구성원</th>
                <th className="px-3 py-3">소속 팀</th>
                <th className="px-3 py-3">직급</th>
                <th className="px-3 py-3">고용</th>
                <th className="px-3 py-3">입사일</th>
                <th className="px-3 py-3 text-right">근속</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedMembers.map((member) => {
                const disabled = !canEdit || pendingId === member.id;
                const currentTeamId = selectedTeam?.id ?? null;
                return (
                  <tr key={member.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-950">{member.name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{member.email}</div>
                    </td>
                    <td className="px-3 py-3">
                      <RichSelect
                        value={currentTeamId ?? ''}
                        disabled={disabled}
                        onChange={(value) => {
                          const nextTeamId = value || null;
                          const nextTeam = data.teams.find((team) => team.id === nextTeamId);
                          if (nextTeam) setSelectedDivisionName(nextTeam.divisionName || '운영단');
                          setSelectedTeamId(nextTeamId);
                          onUpdateMember(member, nextTeamId, { teamId: nextTeamId });
                        }}
                        options={[
                          { value: '', label: '팀 미지정' },
                          ...data.teams.map((team) => ({ value: team.id, label: team.name, description: team.divisionName || '소속 단 미지정' })),
                        ]}
                        buttonClassName={smallInputClass}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <RichSelect
                        value={member.position}
                        disabled={disabled}
                        onChange={(value) => onUpdateMember(member, currentTeamId, { position: value as EmployeePosition })}
                        options={EMPLOYEE_POSITIONS.map((position) => ({ value: position, label: POSITION_LABEL[position] }))}
                        buttonClassName={smallInputClass}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <RichSelect
                        value={member.employmentType}
                        disabled={disabled}
                        onChange={(value) => onUpdateMember(member, currentTeamId, { employmentType: value as EmploymentType })}
                        options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: EMPLOYMENT_LABEL[type] }))}
                        buttonClassName={smallInputClass}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input type="date" value={member.hireDate ?? ''} disabled={disabled} onChange={(event) => onUpdateMember(member, currentTeamId, { hireDate: event.target.value || null })} className={smallInputClass} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={member.yearsOfService}
                          disabled={disabled}
                          onChange={(event) => onUpdateMember(member, currentTeamId, { yearsOfService: Math.max(0, Number(event.target.value || 0)) })}
                          className="w-20 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm text-slate-800 outline-none transition focus:border-blue-200 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                        />
                        <span className="text-xs text-slate-500">년</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {selectedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                    표시할 구성원이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
          입사일 미입력 시 현재 프로필의 근속연수 값을 사용합니다. 팀 이동은 계정 승인 현황과 조직도에 같이 반영됩니다.
        </div>
      </div>

      <div className="min-w-0 xl:col-span-3">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <button type="button" onClick={() => setMapOpen((prev) => !prev)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
              <ChevronRight className={`h-4 w-4 transition-transform ${mapOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-950">조직도 맵</h2>
              <p className="mt-1 text-sm text-slate-500">선택된 단과 팀을 시각적으로 확인합니다.</p>
            </div>
          </button>
          {mapOpen ? (
            <div className="min-w-0 border-t border-slate-100">
              <OrgMiniMap
                rootName={data.rootName ?? 'AICC 본부'}
                divisions={divisions}
                activeDivisionName={currentDivision.name}
                activeTeamId={selectedTeamId}
                compactHeader
                onSelectDivision={(division) => {
                  setFocusedPane('division');
                  setSelectedDivisionName(division.name);
                  setSelectedTeamId(division.teams[0]?.id ?? null);
                }}
                onSelectTeam={(division, team) => {
                  setFocusedPane('team');
                  setSelectedDivisionName(division.name);
                  setSelectedTeamId(team.id);
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
