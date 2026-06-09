'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthUser, UserRole, UserStatus } from '@/app/lib/db/users';
import { Button } from '@/app/components/ui/button';
import {
  EMPLOYEE_POSITION_LABEL,
  EMPLOYEE_POSITIONS,
  EMPLOYMENT_TYPE_LABEL,
  EMPLOYMENT_TYPES,
  type EmployeePosition,
  type EmployeeProfile,
  type EmploymentType,
  type Team,
} from '@/app/lib/types/hr';

type Props = {
  currentUser: AuthUser;
};

const ROLES: UserRole[] = ['ADMIN', 'OPERATOR', 'VIEWER'];
const STATUSES: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function statusBadge(status: UserStatus) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function UsersAdminClient({ currentUser }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [teamDraft, setTeamDraft] = useState<{ id?: string; name: string; headUserId: string }>({ name: '', headUserId: '' });
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState({ pending: 0, approved: 0, admin: 0 });
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(totalUsers / pageSize));
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, page - 2);
    const end = Math.min(pageCount, page + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pageCount]);
  const rangeStart = totalUsers === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalUsers, page * pageSize);
  const pendingUsers = { length: summary.pending };
  const filteredUsers = { length: totalUsers };
  const pagedUsers = users;

  async function loadUsers() {
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        status: statusFilter,
        role: roleFilter,
        teamId: teamFilter,
      });
      const [usersRes, teamsRes, profilesRes] = await Promise.all([
        fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/admin/teams', { cache: 'no-store' }),
        fetch('/api/admin/hr-profiles', { cache: 'no-store' }),
      ]);
      const usersBody = await usersRes.json().catch(() => ({}));
      const teamsBody = await teamsRes.json().catch(() => ({}));
      const profilesBody = await profilesRes.json().catch(() => ({}));
      if (!usersRes.ok) {
        setMessage(usersBody.message || '사용자 목록을 불러오지 못했습니다.');
        return;
      }
      setUsers(usersBody.users ?? []);
      setTotalUsers(Number(usersBody.total ?? usersBody.users?.length ?? 0));
      setSummary(usersBody.summary ?? { pending: 0, approved: 0, admin: 0 });
      if (usersBody.page && usersBody.page !== page) setPage(usersBody.page);
      setTeams(teamsRes.ok ? teamsBody.teams ?? [] : []);
      setProfiles(profilesRes.ok ? profilesBody.profiles ?? [] : []);
      if (!teamsRes.ok || !profilesRes.ok) {
        setMessage('사용자 목록은 불러왔지만 팀 또는 HR 프로필 일부를 불러오지 못했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '계정 승인 관리 데이터를 불러오지 못했습니다.';
      setMessage(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [pageSize, roleFilter, search, statusFilter, teamFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    void loadUsers();
  }, [page, pageSize, roleFilter, search, statusFilter, teamFilter]);

  async function updateUser(id: string, input: { status?: UserStatus; role?: UserRole }) {
    setPendingId(id);
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...input }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);

    if (!res.ok) {
      setMessage(body.message || '사용자 권한 변경에 실패했습니다.');
      return;
    }

    await loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm('이 계정을 삭제하시겠습니까?')) return;
    setPendingId(id);
    setMessage(null);
    const res = await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);

    if (!res.ok) {
      setMessage(body.message || '사용자 삭제에 실패했습니다.');
      return;
    }

    await loadUsers();
  }

  async function resetPassword(id: string, name: string) {
    if (!confirm(`${name}님의 비밀번호를 new123!@로 초기화하시겠습니까?`)) return;
    setPendingId(`password:${id}`);
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, resetPassword: true }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);

    if (!res.ok) {
      setMessage(body.message || '비밀번호 초기화에 실패했습니다.');
      return;
    }

    await loadUsers();
    setMessage(`${name}님의 비밀번호를 new123!@로 초기화했습니다.`);
  }

  function getProfile(userId: string): EmployeeProfile {
    return (
      profiles.find((profile) => profile.userId === userId) ?? {
        userId,
        teamId: null,
        teamName: null,
        position: 'STAFF',
        employmentType: 'P',
        hireDate: null,
        yearsOfService: 0,
        grantedDays: 15,
        usedDays: 0,
        remainingDays: 15,
      }
    );
  }

  async function updateProfile(input: EmployeeProfile) {
    setPendingId(input.userId);
    setMessage(null);
    const res = await fetch('/api/admin/hr-profiles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: input.userId,
        teamId: input.teamId,
        position: input.position,
        employmentType: input.employmentType,
        hireDate: input.hireDate,
        yearsOfService: input.yearsOfService,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || 'HR 프로필 저장에 실패했습니다.');
      return;
    }
    await loadUsers();
  }

  async function saveTeam() {
    if (!teamDraft.name.trim()) {
      setMessage('팀명을 입력해 주세요.');
      return;
    }
    setPendingId(teamDraft.id ?? 'team');
    setMessage(null);
    const res = await fetch('/api/admin/teams', {
      method: teamDraft.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: teamDraft.id,
        name: teamDraft.name,
        headUserId: teamDraft.headUserId || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || '팀 저장에 실패했습니다.');
      return;
    }
    setTeamDraft({ name: '', headUserId: '' });
    setTeamModalOpen(false);
    await loadUsers();
  }

  async function removeTeam(id: string) {
    if (!confirm('팀을 삭제하시겠습니까? 연결된 사용자 프로필의 팀 정보는 비워집니다.')) return;
    setPendingId(id);
    const res = await fetch(`/api/admin/teams?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);
    if (!res.ok) {
      setMessage(body.message || '팀 삭제에 실패했습니다.');
      return;
    }
    await loadUsers();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">계정 승인 관리</h1>
          <p className="mt-1 text-sm text-slate-500">가입 신청 승인, 반려, 역할 변경을 관리합니다.</p>
        </div>
        <Button variant="outline" onClick={loadUsers} disabled={loading || Boolean(pendingId)}>
          {loading ? '불러오는 중...' : '새로고침'}
        </Button>
      </div>

      <div className="hidden">
        <Metric label="승인 대기" value={pendingUsers.length} />
        <Metric label="승인 계정" value={users.filter((user) => user.status === 'APPROVED').length} />
        <Metric label="관리자" value={users.filter((user) => user.role === 'HEAD' || user.role === 'ADMIN').length} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="승인 대기" value={summary.pending} />
        <Metric label="승인 계정" value={summary.approved} />
        <Metric label="관리자" value={summary.admin} />
      </div>

      {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div>}

      {currentUser.role === 'HEAD' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">팀 관리</h2>
              <p className="mt-1 text-sm text-slate-500">HEAD 계정은 팀을 등록, 수정, 삭제하고 팀장을 지정할 수 있습니다.</p>
            </div>
            <Button
              variant="saveOutline"
              onClick={() => {
                setTeamDraft({ name: '', headUserId: '' });
                setTeamModalOpen(true);
              }}
            >
              팀 등록
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{team.name}</div>
                  <div className="text-xs text-slate-500">팀장: {team.headName ?? '미지정'}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-700 hover:text-slate-950"
                    onClick={() => {
                      setTeamDraft({ id: team.id, name: team.name, headUserId: team.headUserId ?? '' });
                      setTeamModalOpen(true);
                    }}
                  >
                    수정
                  </button>
                  <button type="button" className="text-xs font-medium text-rose-600 hover:text-rose-700" onClick={() => removeTeam(team.id)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
            {teams.length === 0 ? <div className="text-sm text-slate-500">등록된 팀이 없습니다.</div> : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">회원 목록</h2>
              <p className="mt-1 text-xs text-slate-500">
                전체 {users.length}명 중 {filteredUsers.length}명 표시 · {rangeStart}-{rangeEnd}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[220px_130px_130px_160px_110px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as UserStatus | 'ALL')}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">상태 전체</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as UserRole | 'ALL')}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">역할 전체</option>
                {(['HEAD', 'ADMIN', 'OPERATOR', 'VIEWER'] as UserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={teamFilter}
                onChange={(event) => setTeamFilter(event.target.value)}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="ALL">팀 전체</option>
                <option value="UNASSIGNED">팀 미지정</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}개씩
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1970px] table-fixed text-sm">
            <colgroup>
              <col className="w-[160px]" />
              <col className="w-[260px]" />
              <col className="w-[130px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[150px]" />
              <col className="w-[130px]" />
              <col className="w-[160px]" />
              <col className="w-[170px]" />
              <col className="w-[110px]" />
              <col className="w-[130px]" />
              <col className="w-[380px]" />
            </colgroup>
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium">팀</th>
                <th className="px-4 py-3 font-medium">직급</th>
                <th className="px-4 py-3 font-medium">고용</th>
                <th className="px-4 py-3 font-medium">연차</th>
                <th className="px-4 py-3 font-medium">입사일</th>
                <th className="px-4 py-3 font-medium">근속</th>
                <th className="px-4 py-3 font-medium">신청일</th>
                <th className="px-4 py-3 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={12}>
                    불러오는 중...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={12}>
                    가입 신청 계정이 없습니다.
                  </td>
                </tr>
              ) : (
                pagedUsers.map((user) => {
                  const isHead = user.role === 'HEAD';
                  const passwordBusy = pendingId === `password:${user.id}`;
                  const busy = pendingId === user.id || passwordBusy;
                  const canEdit = !isHead && (currentUser.role === 'HEAD' || user.role !== 'ADMIN');
                  const profile = getProfile(user.id);
                  const canEditProfile = currentUser.role === 'HEAD' || currentUser.role === 'ADMIN';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70">
                      <td className="truncate px-4 py-3 font-medium text-slate-900" title={user.name}>{user.name}</td>
                      <td className="truncate px-4 py-3 text-slate-600" title={user.email}>{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={['inline-flex rounded-full border px-2 py-1 text-xs font-medium', statusBadge(user.status)].join(' ')}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isHead ? (
                          <span className="font-medium text-slate-900">HEAD</span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={!canEdit || busy}
                            onChange={(e) => updateUser(user.id, { role: e.target.value as UserRole })}
                            className="w-[120px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                          >
                            {(currentUser.role === 'HEAD' ? ['ADMIN', ...ROLES.filter((role) => role !== 'ADMIN')] : ROLES.filter((role) => role !== 'ADMIN')).map((role) => (
                              <option key={role} value={role}>
                                {role}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={profile.teamId ?? ''}
                          disabled={!canEditProfile || busy}
                          onChange={(e) => updateProfile({ ...profile, teamId: e.target.value || null })}
                          className="w-[150px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                        >
                          <option value="">팀 미지정</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={profile.position}
                          disabled={!canEditProfile || busy}
                          onChange={(e) => updateProfile({ ...profile, position: e.target.value as EmployeePosition })}
                          className="w-[120px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                        >
                          {EMPLOYEE_POSITIONS.map((position) => (
                            <option key={position} value={position}>
                              {EMPLOYEE_POSITION_LABEL[position]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={profile.employmentType}
                          disabled={!canEditProfile || busy}
                          onChange={(e) => updateProfile({ ...profile, employmentType: e.target.value as EmploymentType })}
                          className="w-[104px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                        >
                          {EMPLOYMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type} · {EMPLOYMENT_TYPE_LABEL[type]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex flex-col rounded-md border border-emerald-100 bg-emerald-50/70 px-2.5 py-1 text-xs text-emerald-800">
                          <span className="font-semibold">잔여 {profile.remainingDays}일</span>
                          <span className="text-emerald-700/80">부여 {profile.grantedDays} / 사용 {profile.usedDays}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={profile.hireDate ?? ''}
                          disabled={!canEditProfile || busy}
                          onChange={(e) => updateProfile({ ...profile, hireDate: e.target.value || null })}
                          className="w-[150px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={profile.yearsOfService}
                          disabled={!canEditProfile || busy}
                          onChange={(e) => updateProfile({ ...profile, yearsOfService: Math.max(0, Number(e.target.value || 0)) })}
                          className="w-[72px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{new Date(user.createdAt).toLocaleDateString('ko-KR')}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          {STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={!canEdit || busy || user.status === status}
                              onClick={() => updateUser(user.id, { status })}
                              className="min-w-[72px] rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {status}
                            </button>
                          ))}
                          {currentUser.role === 'HEAD' && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => resetPassword(user.id, user.name)}
                              className="min-w-[86px] rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {passwordBusy ? '초기화 중' : '비번 초기화'}
                            </button>
                          )}
                          {currentUser.role === 'HEAD' && !isHead && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => deleteUser(user.id)}
                              className="min-w-[48px] rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            {filteredUsers.length === 0 ? '표시할 회원이 없습니다.' : `${rangeStart}-${rangeEnd} / ${filteredUsers.length}명`}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <PaginationButton disabled={page === 1} onClick={() => setPage(1)}>
              First
            </PaginationButton>
            <PaginationButton disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              &lt;
            </PaginationButton>
            {pageNumbers.map((pageNumber) => (
              <PaginationButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                {pageNumber}
              </PaginationButton>
            ))}
            <PaginationButton disabled={page === pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>
              &gt;
            </PaginationButton>
            <PaginationButton disabled={page === pageCount} onClick={() => setPage(pageCount)}>
              Last
            </PaginationButton>
          </div>
        </div>
      </div>

      {teamModalOpen ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => {
              setTeamModalOpen(false);
              setTeamDraft({ name: '', headUserId: '' });
            }}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4">
                <h2 className="text-base font-semibold">{teamDraft.id ? '팀 수정' : '팀 등록'}</h2>
                <p className="mt-1 text-sm text-slate-500">팀명과 팀장을 지정합니다.</p>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">팀명</span>
                  <input
                    value={teamDraft.name}
                    onChange={(e) => setTeamDraft((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="팀명을 입력해 주세요."
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    autoFocus
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">팀장</span>
                  <select
                    value={teamDraft.headUserId}
                    onChange={(e) => setTeamDraft((prev) => ({ ...prev, headUserId: e.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="">팀장 미지정</option>
                    {users
                      .filter((user) => user.role === 'HEAD' || user.role === 'ADMIN' || user.role === 'OPERATOR')
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTeamModalOpen(false);
                    setTeamDraft({ name: '', headUserId: '' });
                  }}
                  disabled={Boolean(pendingId)}
                >
                  취소
                </Button>
                <Button variant="saveOutline" onClick={saveTeam} disabled={Boolean(pendingId)}>
                  {teamDraft.id ? '수정' : '등록'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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

function PaginationButton({
  active,
  disabled,
  children,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'min-w-9 rounded-md border px-2.5 py-1.5 text-xs font-medium transition',
        active ? 'border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
