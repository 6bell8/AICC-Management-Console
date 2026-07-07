'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Network, UserPlus } from 'lucide-react';
import type { AuthUser, UserRole, UserStatus } from '@/app/lib/db/users';
import { Button } from '@/app/components/ui/button';
import { RichSelect } from '@/app/components/ui/select';
import { Skeleton } from '@/app/components/ui/skeleton';
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
type CreateUserDraft = {
  loginId: string;
  name: string;
  role: UserRole;
};

function statusBadge(status: UserStatus) {
  if (status === 'APPROVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function UserTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: 12 }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <Skeleton className={colIndex === 1 || colIndex === 11 ? 'h-4 w-full' : 'h-4 w-24'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function UsersAdminClient({ currentUser }: Props) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [nextLoginId, setNextLoginId] = useState('00001');
  const [createUserDraft, setCreateUserDraft] = useState<CreateUserDraft>({ loginId: '00001', name: '', role: 'OPERATOR' });
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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
  const filteredUsers = { length: totalUsers };
  const pagedUsers = users;

  const loadUsers = useCallback(async () => {
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
      const nextId = usersBody.nextLoginId ?? '00001';
      setNextLoginId(nextId);
      setCreateUserDraft((prev) => (prev.loginId && prev.loginId !== nextId ? prev : { ...prev, loginId: nextId }));
      setTotalUsers(Number(usersBody.total ?? usersBody.users?.length ?? 0));
      if (usersBody.page && usersBody.page !== page) setPage(usersBody.page);
      setTeams(teamsRes.ok ? teamsBody.teams ?? [] : []);
      setProfiles(profilesRes.ok ? profilesBody.profiles ?? [] : []);
      if (!teamsRes.ok || !profilesRes.ok) {
        setMessage('사용자 목록은 불러왔지만 팀 또는 HR 프로필을 불러오지 못했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '계정 승인 관리 데이터를 불러오지 못했습니다.';
      setMessage(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, roleFilter, search, statusFilter, teamFilter]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, roleFilter, search, statusFilter, teamFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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

  async function createUser() {
    if (!createUserDraft.loginId.trim() || !createUserDraft.name.trim()) {
      setMessage('로그인 ID와 이름을 입력해 주세요.');
      return;
    }
    setPendingId('create-user');
    setMessage(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createUserDraft),
    });
    const body = await res.json().catch(() => ({}));
    setPendingId(null);

    if (!res.ok) {
      setMessage(body.message || '계정을 생성하지 못했습니다.');
      return;
    }

    const nextId = body.nextLoginId ?? nextLoginId;
    setNextLoginId(nextId);
    setCreateUserDraft({ loginId: nextId, name: '', role: 'OPERATOR' });
    setCreateUserModalOpen(false);
    setMessage(`${body.user?.name ?? '계정'} 계정을 생성했습니다. 초기 비밀번호는 new123!@ 입니다.`);
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
      setMessage(body.message || 'HR ?꾨줈????μ뿉 ?ㅽ뙣?덉뒿?덈떎.');
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
        {currentUser.role === 'HEAD' || currentUser.role === 'ADMIN' ? (
          <Button
            variant="saveOutline"
            onClick={() => {
              setCreateUserDraft({ loginId: nextLoginId, name: '', role: 'OPERATOR' });
              setCreateUserModalOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            계정 생성
          </Button>
        ) : null}
      </div>

      {message && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{message}</div>}

      {currentUser.role === 'HEAD' || currentUser.role === 'ADMIN' ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">팀 구조 관리</h2>
            <p className="mt-1 text-sm text-slate-500">팀 등록, 수정, 삭제와 팀장 지정은 조직도 / 팀 현황에서 관리합니다.</p>
          </div>
          <Link
            href="/admin/org"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
          >
            <Network className="h-4 w-4" aria-hidden="true" />
            조직도에서 관리
          </Link>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-white px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">회원 목록</h2>
              <p className="mt-1 text-xs text-slate-500">
                전체 {totalUsers}명 중 {rangeStart}-{rangeEnd} 표시
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[220px_130px_130px_160px_110px]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
              <RichSelect
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as UserStatus | 'ALL')}
                options={[{ value: 'ALL', label: '상태 전체' }, ...STATUSES.map((status) => ({ value: status, label: status }))]}
              />
              <RichSelect
                value={roleFilter}
                onChange={(value) => setRoleFilter(value as UserRole | 'ALL')}
                options={[{ value: 'ALL', label: '역할 전체' }, ...(['HEAD', 'ADMIN', 'OPERATOR', 'VIEWER'] as UserRole[]).map((role) => ({ value: role, label: role }))]}
              />
              <RichSelect
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: 'ALL', label: '팀 전체' },
                  { value: 'UNASSIGNED', label: '팀 미지정' },
                  ...teams.map((team) => ({ value: team.id, label: team.name })),
                ]}
              />
              <RichSelect
                value={String(pageSize)}
                onChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size}개씩` }))}
              />
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
                <UserTableSkeleton />
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
                          <RichSelect
                            value={user.role}
                            disabled={!canEdit || busy}
                            onChange={(value) => updateUser(user.id, { role: value as UserRole })}
                            options={(currentUser.role === 'HEAD' ? ['ADMIN', ...ROLES.filter((role) => role !== 'ADMIN')] : ROLES.filter((role) => role !== 'ADMIN')).map((role) => ({ value: role, label: role }))}
                            className="w-[120px]"
                            buttonClassName="min-h-8 rounded-md border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <RichSelect
                          value={profile.teamId ?? ''}
                          disabled={!canEditProfile || busy}
                          onChange={(value) => updateProfile({ ...profile, teamId: value || null })}
                          options={[{ value: '', label: '팀 미지정' }, ...teams.map((team) => ({ value: team.id, label: team.name }))]}
                          className="w-[150px]"
                          buttonClassName="min-h-8 rounded-md border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RichSelect
                          value={profile.position}
                          disabled={!canEditProfile || busy}
                          onChange={(value) => updateProfile({ ...profile, position: value as EmployeePosition })}
                          options={EMPLOYEE_POSITIONS.map((position) => ({ value: position, label: EMPLOYEE_POSITION_LABEL[position] }))}
                          className="w-[120px]"
                          buttonClassName="min-h-8 rounded-md border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <RichSelect
                          value={profile.employmentType}
                          disabled={!canEditProfile || busy}
                          onChange={(value) => updateProfile({ ...profile, employmentType: value as EmploymentType })}
                          options={EMPLOYMENT_TYPES.map((type) => ({ value: type, label: `${type} · ${EMPLOYMENT_TYPE_LABEL[type]}` }))}
                          className="w-[104px]"
                          buttonClassName="min-h-8 rounded-md border-slate-200 px-2 py-1 text-sm disabled:bg-slate-100"
                        />
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
            {filteredUsers.length === 0 ? '표시할 회원이 없습니다.' : `${rangeStart}-${rangeEnd} / ${totalUsers}명`}
          </div>
          <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-1.5">
            <span className="hidden sm:inline-flex">
              <PaginationButton disabled={page === 1} onClick={() => setPage(1)}>
                First
              </PaginationButton>
            </span>
            <PaginationButton disabled={page === 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              &lt;
            </PaginationButton>
            <span className="flex min-w-0 items-center justify-center gap-1.5">
              {pageNumbers.map((pageNumber) => (
                <PaginationButton key={pageNumber} active={pageNumber === page} onClick={() => setPage(pageNumber)}>
                  {pageNumber}
                </PaginationButton>
              ))}
            </span>
            <PaginationButton disabled={page === pageCount} onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}>
              &gt;
            </PaginationButton>
            <span className="hidden sm:inline-flex">
              <PaginationButton disabled={page === pageCount} onClick={() => setPage(pageCount)}>
                Last
              </PaginationButton>
            </span>
          </div>
        </div>
      </div>

      {createUserModalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/35" onClick={() => setCreateUserModalOpen(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-950">계정 생성</h2>
                <p className="mt-1 text-sm text-slate-500">승인 완료 상태의 계정을 바로 생성합니다. 초기 비밀번호는 new123!@ 입니다.</p>
              </div>
              <div className="space-y-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">로그인 ID</span>
                  <div className="flex gap-2">
                    <input
                      value={createUserDraft.loginId}
                      onChange={(event) => setCreateUserDraft((prev) => ({ ...prev, loginId: event.target.value }))}
                      className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                      placeholder="00001 또는 user@company.com"
                    />
                    <button
                      type="button"
                      onClick={() => setCreateUserDraft((prev) => ({ ...prev, loginId: nextLoginId }))}
                      className="shrink-0 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      자동
                    </button>
                  </div>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">이름</span>
                  <input
                    value={createUserDraft.name}
                    onChange={(event) => setCreateUserDraft((prev) => ({ ...prev, name: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    placeholder="사용자 이름"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-500">권한</span>
                  <RichSelect
                    value={createUserDraft.role}
                    onChange={(value) => setCreateUserDraft((prev) => ({ ...prev, role: value as UserRole }))}
                    options={(currentUser.role === 'HEAD' ? ['ADMIN', 'OPERATOR', 'VIEWER'] : ['OPERATOR', 'VIEWER']).map((role) => ({ value: role, label: role }))}
                    buttonClassName="min-h-10 rounded-md border-slate-200 px-3 text-sm shadow-sm focus:border-slate-300 focus:ring-slate-100"
                  />
                </label>
                <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm text-slate-600">
                  초기 비밀번호: <span className="font-semibold text-slate-900">new123!@</span>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateUserModalOpen(false)} disabled={pendingId === 'create-user'}>
                  취소
                </Button>
                <Button variant="saveOutline" onClick={createUser} disabled={pendingId === 'create-user'}>
                  {pendingId === 'create-user' ? '생성 중' : '계정 생성'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
        active ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
