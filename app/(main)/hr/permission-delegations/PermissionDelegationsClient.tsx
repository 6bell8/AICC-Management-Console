'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, Search, ShieldCheck, Star, Trash2, UserCog, X } from 'lucide-react';

import { RichSelect } from '@/app/components/ui/select';
import type { AuthUser } from '@/app/lib/db/users';
import type { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

type SettingsData = Awaited<ReturnType<typeof getSettingsCenterData>>;
type PermissionDelegation = SettingsData['permissionDelegations'][number];
type PermissionDelegationPreset = SettingsData['permissionDelegationPresets'][number];

type DelegationDraft = {
  delegatorUserId: string;
  delegateeUserId: string;
  teamId: string;
  scope: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  saveAsDefault: boolean;
};

type ConfirmDialog = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
};

const delegationScopeLabel: Record<string, string> = {
  TEAM_MANAGER: '팀장 전체 권한',
  APPROVAL: '결재 권한',
  TEAM_HR: '팀 근태 관리',
  TEAM_CALENDAR: '팀 캘린더 관리',
};

const delegationStatusLabel: Record<string, string> = {
  ACTIVE: '활성',
  CANCELLED: '취소',
  EXPIRED: '만료',
};

function emptyDelegationDraft(defaults?: { delegatorUserId?: string; teamId?: string; delegateeUserId?: string }): DelegationDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    delegatorUserId: defaults?.delegatorUserId ?? '',
    delegateeUserId: defaults?.delegateeUserId ?? '',
    teamId: defaults?.teamId ?? '',
    scope: 'TEAM_MANAGER',
    startsAt: today,
    endsAt: today,
    reason: '',
    saveAsDefault: false,
  };
}

export default function PermissionDelegationsClient({ initialData, currentUser }: { initialData: SettingsData; currentUser: AuthUser }) {
  const globalAdmin = currentUser.role === 'HEAD' || currentUser.role === 'ADMIN';
  const initialTeamId = initialData.teams[0]?.id ?? '';
  const defaultDraft = () => emptyDelegationDraft(globalAdmin ? { teamId: initialTeamId } : { delegatorUserId: currentUser.id, teamId: initialTeamId });

  const [data, setData] = useState(initialData);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DelegationDraft>(defaultDraft);
  const [userSearch, setUserSearch] = useState('');
  const [teamSearch, setTeamSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const activeCount = useMemo(() => data.permissionDelegations.filter((item) => item.status === 'ACTIVE').length, [data.permissionDelegations]);
  const selectedDelegator = data.approvedUsers.find((user) => user.id === draft.delegatorUserId);
  const selectedDelegatee = data.approvedUsers.find((user) => user.id === draft.delegateeUserId);
  const selectedTeam = data.teams.find((team) => team.id === draft.teamId);

  const activePreset = useMemo(() => {
    return data.permissionDelegationPresets.find((preset) => preset.teamId === draft.teamId && preset.delegatorUserId === draft.delegatorUserId) ?? null;
  }, [data.permissionDelegationPresets, draft.delegatorUserId, draft.teamId]);

  const delegationUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    const scopedUsers = data.approvedUsers.filter((user) => {
      if (!draft.teamId) return globalAdmin;
      return user.teamId === draft.teamId || (globalAdmin && user.id === draft.delegatorUserId);
    });
    if (!keyword) return scopedUsers;
    return scopedUsers.filter((user) => `${user.name} ${user.email} ${user.teamName ?? '팀 미지정'} ${roleLabel(user.role)}`.toLowerCase().includes(keyword));
  }, [data.approvedUsers, draft.delegatorUserId, draft.teamId, globalAdmin, userSearch]);

  const delegationTeams = useMemo(() => {
    const keyword = teamSearch.trim().toLowerCase();
    if (!keyword) return data.teams;
    return data.teams.filter((team) => `${team.name} ${team.headName ?? ''}`.toLowerCase().includes(keyword));
  }, [data.teams, teamSearch]);

  const resetModal = () => {
    setDraft(defaultDraft());
    setUserSearch('');
    setTeamSearch('');
  };

  const openModal = () => {
    resetModal();
    setModalOpen(true);
  };

  function selectTeam(teamId: string) {
    const preset = data.permissionDelegationPresets.find((item) => item.teamId === teamId && item.delegatorUserId === draft.delegatorUserId);
    setDraft((prev) => ({ ...prev, teamId, delegateeUserId: preset?.defaultDelegateeUserId ?? prev.delegateeUserId }));
  }

  function applyPreset(preset: PermissionDelegationPreset) {
    setDraft((prev) => ({
      ...prev,
      teamId: preset.teamId,
      delegatorUserId: preset.delegatorUserId,
      delegateeUserId: preset.defaultDelegateeUserId,
    }));
  }

  async function saveDelegation() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/permission-delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '권한 위임을 저장하지 못했습니다.');

      setData((prev) => {
        const nextDelegations = [body.delegation as PermissionDelegation, ...prev.permissionDelegations];
        const nextPresets = draft.saveAsDefault && selectedTeam && selectedDelegator && selectedDelegatee
          ? upsertPresetState(prev.permissionDelegationPresets, {
              id: `${draft.teamId}-${draft.delegatorUserId}`,
              teamId: draft.teamId,
              teamName: selectedTeam.name,
              delegatorUserId: draft.delegatorUserId,
              delegatorName: selectedDelegator.name,
              defaultDelegateeUserId: draft.delegateeUserId,
              defaultDelegateeName: selectedDelegatee.name,
              createdBy: currentUser.id,
              updatedAt: new Date().toISOString(),
            })
          : prev.permissionDelegationPresets;
        return { ...prev, permissionDelegations: nextDelegations, permissionDelegationPresets: nextPresets };
      });

      resetModal();
      setModalOpen(false);
      setMessage(draft.saveAsDefault ? '권한 위임을 등록하고 기본 위임자로 저장했습니다.' : '권한 위임을 등록했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '권한 위임을 저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  function requestCancelDelegation(delegation: PermissionDelegation) {
    setConfirmDialog({
      title: '권한 위임을 취소할까요?',
      description: `${delegation.delegateeName}님의 ${delegationScopeLabel[delegation.scope] ?? delegation.scope} 위임이 취소됩니다.`,
      confirmLabel: '위임 취소',
      tone: 'danger',
      onConfirm: () => void cancelDelegation(delegation),
    });
  }

  async function cancelDelegation(delegation: PermissionDelegation) {
    setPending(true);
    setMessage(null);
    setConfirmDialog(null);
    try {
      const res = await fetch(`/api/admin/settings/permission-delegations?id=${encodeURIComponent(delegation.id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '권한 위임을 취소하지 못했습니다.');
      setData((prev) => ({
        ...prev,
        permissionDelegations: prev.permissionDelegations.map((item) => (item.id === delegation.id ? { ...item, status: 'CANCELLED', cancelledAt: new Date().toISOString() } : item)),
      }));
      setMessage('권한 위임을 취소했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '권한 위임을 취소하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
            <UserCog className="h-3.5 w-3.5" />
            HR Permission Delegation
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">권한 위임 관리</h1>
          <p className="mt-1 text-sm text-slate-500">팀장 부재, 휴가, 출장 기간 동안 필요한 팀 권한을 기간제로 위임합니다.</p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-4 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
        >
          <UserCog className="h-4 w-4" />
          권한 위임 등록
        </button>
      </div>

      {message ? <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={<ShieldCheck className="h-4 w-4" />} label="활성 위임" value={`${activeCount}건`} helper="현재 기간에 적용 중인 위임" />
        <SummaryCard icon={<CalendarDays className="h-4 w-4" />} label="전체 이력" value={`${data.permissionDelegations.length}건`} helper="취소 및 만료 이력 포함" />
        <SummaryCard icon={<Star className="h-4 w-4" />} label="기본 위임자" value={`${data.permissionDelegationPresets.length}건`} helper="자주 쓰는 대리자 고정" />
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">위임 이력</h2>
          <p className="mt-1 text-sm text-slate-500">팀, 기간, 위임 범위를 기준으로 실제 반영되는 권한을 확인합니다.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {data.permissionDelegations.map((delegation) => (
            <div key={delegation.id} className="grid gap-3 px-5 py-4 text-sm lg:grid-cols-[1.2fr_1fr_1fr_120px] lg:items-center">
              <div className="min-w-0">
                <div className="font-semibold text-slate-950">{delegation.delegatorName} → {delegation.delegateeName}</div>
                <div className="mt-1 text-xs text-slate-500">{delegationScopeLabel[delegation.scope] ?? delegation.scope}</div>
                {delegation.reason ? <div className="mt-1 line-clamp-1 text-xs text-slate-400">{delegation.reason}</div> : null}
              </div>
              <div className="text-slate-600">{delegation.teamName}</div>
              <div className="text-xs text-slate-500">{delegation.startsAt} ~ {delegation.endsAt}</div>
              <div className="flex items-center justify-start gap-2 lg:justify-end">
                <DelegationStatusBadge status={delegation.status} />
                {delegation.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    onClick={() => requestCancelDelegation(delegation)}
                    disabled={pending}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-45"
                    aria-label="권한 위임 취소"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {data.permissionDelegations.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">등록된 권한 위임이 없습니다.</div> : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="권한 위임 등록 닫기" onClick={() => setModalOpen(false)} />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-sky-600" />
                  <h2 className="text-base font-semibold text-slate-950">권한 위임 등록</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">{globalAdmin ? '사용자와 팀을 선택한 뒤 위임 범위와 기간을 지정합니다.' : '본인 팀 구성원에게만 기간제 권한을 위임할 수 있습니다.'}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900" aria-label="닫기">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <section className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">사용자 선택</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{globalAdmin ? '위임자와 대리자를 각각 선택합니다.' : '대리자를 선택합니다. 위임자는 현재 로그인 계정으로 고정됩니다.'}</p>
                      </div>
                      <div className="relative w-full sm:max-w-[280px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="이름, 이메일, 권한 검색" className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                      </div>
                    </div>
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {delegationUsers.map((user) => (
                        <div key={user.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950">{user.name}</div>
                            <div className="mt-0.5 truncate text-xs text-slate-500">{user.email}</div>
                            <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{user.teamName ?? '팀 미지정'} · {roleLabel(user.role)}</div>
                          </div>
                          <div className={['mt-2 grid gap-1.5', globalAdmin ? 'grid-cols-2' : 'grid-cols-1'].join(' ')}>
                            {globalAdmin ? <SelectChipButton label="위임자" selected={draft.delegatorUserId === user.id} onClick={() => setDraft((prev) => ({ ...prev, delegatorUserId: user.id }))} /> : null}
                            <SelectChipButton label="대리자" selected={draft.delegateeUserId === user.id} onClick={() => setDraft((prev) => ({ ...prev, delegateeUserId: user.id, teamId: user.teamId ?? prev.teamId }))} />
                          </div>
                        </div>
                      ))}
                      {delegationUsers.length === 0 ? <div className="col-span-full px-3 py-8 text-center text-sm text-slate-500">검색된 사용자가 없습니다.</div> : null}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">팀 선택</h3>
                        <p className="mt-0.5 text-xs text-slate-500">위임 권한이 적용될 팀을 선택합니다.</p>
                      </div>
                      <div className="relative w-full sm:max-w-[260px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="팀명, 팀장 검색" className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                      </div>
                    </div>
                    <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {delegationTeams.map((team) => (
                        <button key={team.id} type="button" onClick={() => selectTeam(team.id)} className={['rounded-md border p-3 text-left transition', draft.teamId === team.id ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:border-sky-100 hover:bg-sky-50/60'].join(' ')}>
                          <div className="text-sm font-semibold">{team.name}</div>
                          <div className="mt-1 text-xs opacity-70">팀장 {team.headName ?? '-'}</div>
                        </button>
                      ))}
                      {delegationTeams.length === 0 ? <div className="col-span-full px-3 py-8 text-center text-sm text-slate-500">검색된 팀이 없습니다.</div> : null}
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-950">선택 요약</h3>
                      {activePreset ? (
                        <button type="button" onClick={() => applyPreset(activePreset)} className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          <Star className="h-3.5 w-3.5" />
                          기본 위임자 적용
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2">
                      <SummaryLine label="위임자" value={selectedDelegator ? `${selectedDelegator.name} · ${roleLabel(selectedDelegator.role)}` : '선택 필요'} />
                      <SummaryLine label="대리자" value={selectedDelegatee ? `${selectedDelegatee.name} · ${selectedDelegatee.email}` : '선택 필요'} />
                      <SummaryLine label="대상 팀" value={selectedTeam?.name ?? '선택 필요'} />
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-100 bg-white p-4">
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">위임 범위</span>
                        <RichSelect
                          value={draft.scope}
                          onChange={(value) => setDraft((prev) => ({ ...prev, scope: value }))}
                          disabled={pending}
                          options={Object.entries(delegationScopeLabel).map(([value, label]) => ({ value, label }))}
                          buttonClassName="min-h-10 rounded-md border-slate-200 px-3 text-sm text-slate-900 focus:border-sky-200 focus:ring-sky-100"
                        />
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">시작일</span>
                          <input type="date" value={draft.startsAt} onChange={(event) => setDraft((prev) => ({ ...prev, startsAt: event.target.value }))} disabled={pending} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">종료일</span>
                          <input type="date" value={draft.endsAt} onChange={(event) => setDraft((prev) => ({ ...prev, endsAt: event.target.value }))} disabled={pending} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                        </label>
                      </div>
                      <label className="flex items-start gap-2 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2">
                        <input type="checkbox" checked={draft.saveAsDefault} onChange={(event) => setDraft((prev) => ({ ...prev, saveAsDefault: event.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-200 text-amber-600" />
                        <span>
                          <span className="block text-xs font-semibold text-amber-800">이 대리자를 기본 위임자로 저장</span>
                          <span className="mt-0.5 block text-[11px] text-amber-700">다음 등록 때 같은 팀/위임자 기준으로 빠르게 불러옵니다.</span>
                        </span>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">사유</span>
                        <textarea value={draft.reason} onChange={(event) => setDraft((prev) => ({ ...prev, reason: event.target.value }))} disabled={pending} className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100" placeholder="휴가, 출장, 부재 기간 등" />
                      </label>
                    </div>
                  </section>
                </aside>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">등록 즉시 설정 기간 동안 대리자에게 위임 권한이 반영됩니다.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} disabled={pending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">취소</button>
                <button type="button" onClick={saveDelegation} disabled={pending || !draft.delegatorUserId || !draft.delegateeUserId || !draft.teamId || !draft.startsAt || !draft.endsAt} className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-45">
                  {pending ? '등록 중' : '권한 위임 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <ConfirmModal
          dialog={confirmDialog}
          pending={pending}
          onClose={() => setConfirmDialog(null)}
        />
      ) : null}
    </div>
  );
}

function ConfirmModal({ dialog, onClose, pending }: { dialog: ConfirmDialog; onClose: () => void; pending: boolean }) {
  const danger = dialog.tone === 'danger';
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="확인 창 닫기" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-base font-semibold text-slate-950">{dialog.title}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{dialog.description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">
            닫기
          </button>
          <button
            type="button"
            onClick={dialog.onConfirm}
            disabled={pending}
            className={[
              'rounded-md border px-3 py-2 text-sm font-semibold shadow-sm transition disabled:pointer-events-none disabled:opacity-45',
              danger ? 'border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100',
            ].join(' ')}
          >
            {pending ? '처리 중' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function upsertPresetState(presets: PermissionDelegationPreset[], next: PermissionDelegationPreset) {
  const exists = presets.some((preset) => preset.teamId === next.teamId && preset.delegatorUserId === next.delegatorUserId);
  if (!exists) return [next, ...presets];
  return presets.map((preset) => (preset.teamId === next.teamId && preset.delegatorUserId === next.delegatorUserId ? { ...preset, ...next } : preset));
}

function SummaryCard({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">{icon}<span>{label}</span></div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function SelectChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={['rounded-md border px-2 py-1.5 text-xs font-semibold transition', selected ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700'].join(' ')}>
      {selected ? '선택됨' : label}
    </button>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function DelegationStatusBadge({ status }: { status: string }) {
  const toneClass = status === 'ACTIVE' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : status === 'EXPIRED' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-rose-100 bg-rose-50 text-rose-700';
  return <span className={['rounded-full border px-2 py-0.5 text-[11px] font-semibold', toneClass].join(' ')}>{delegationStatusLabel[status] ?? status}</span>;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    HEAD: '총괄 관리자',
    ADMIN: '관리자',
    OPERATOR: '운영 담당자',
    VIEWER: '조회 사용자',
  };
  return labels[role] ?? role;
}
