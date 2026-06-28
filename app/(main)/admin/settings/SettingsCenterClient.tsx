'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Bell, Building2, ChevronDown, ClipboardCheck, KeyRound, Search, Settings, ShieldCheck, Stamp, Trash2, Upload, UserCog, UsersRound, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import type { AuthUser } from '@/app/lib/db/users';
import type { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

type SettingsData = Awaited<ReturnType<typeof getSettingsCenterData>>;
type LeavePolicy = SettingsData['leavePolicies'][number];
type PermissionDelegation = SettingsData['permissionDelegations'][number];

type LeavePolicyDraft = {
  id?: string;
  position: string;
  minYears: string;
  maxYears: string;
  grantedDays: string;
  effectiveFrom: string;
  effectiveTo: string;
};

type DelegationDraft = {
  delegatorUserId: string;
  delegateeUserId: string;
  teamId: string;
  scope: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

type ConfirmDialog = {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
};

type Props = {
  initialData: SettingsData;
  currentUser: AuthUser;
};

const sectionKeys = {
  delegation: 'aicc:settings-permission-delegation-open',
  document: 'aicc:settings-document-seal-open',
  leavePolicy: 'aicc:settings-leave-policy-open',
  approvalRule: 'aicc:settings-approval-rule-open',
  security: 'aicc:settings-security-notice-open',
} as const;

const policyPositionLabel: Record<string, string> = {
  ALL: '전체 직급',
  STAFF: '사원',
  ASSISTANT_MANAGER: '대리',
  MANAGER: '과장',
  SENIOR_MANAGER: '차장',
  DIRECTOR: '부장 이상',
};

const policyPositions = ['ALL', 'STAFF', 'ASSISTANT_MANAGER', 'MANAGER', 'SENIOR_MANAGER', 'DIRECTOR'] as const;

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

function emptyPolicyDraft(): LeavePolicyDraft {
  return {
    position: 'ALL',
    minYears: '0',
    maxYears: '',
    grantedDays: '15',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  };
}

function emptyDelegationDraft(): DelegationDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    delegatorUserId: '',
    delegateeUserId: '',
    teamId: '',
    scope: 'TEAM_MANAGER',
    startsAt: today,
    endsAt: today,
    reason: '',
  };
}

function sortPolicies(policies: LeavePolicy[]) {
  return [...policies].sort((a, b) => {
    if (a.position !== b.position) return a.position.localeCompare(b.position);
    if (a.minYears !== b.minYears) return a.minYears - b.minYears;
    return (a.effectiveFrom ?? '').localeCompare(b.effectiveFrom ?? '');
  });
}

function sectionInitialValue(key: string) {
  if (typeof window === 'undefined') return true;
  const saved = window.localStorage.getItem(key);
  return saved == null ? true : saved === '1';
}

export default function SettingsCenterClient({ initialData, currentUser }: Props) {
  const [data, setData] = useState(initialData);
  const [rootName, setRootName] = useState(initialData.organization.rootName);
  const [policyDraft, setPolicyDraft] = useState<LeavePolicyDraft>(emptyPolicyDraft);
  const [delegationDraft, setDelegationDraft] = useState<DelegationDraft>(emptyDelegationDraft);
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [delegationUserSearch, setDelegationUserSearch] = useState('');
  const [delegationTeamSearch, setDelegationTeamSearch] = useState('');
  const [openSections, setOpenSections] = useState<Record<keyof typeof sectionKeys, boolean>>({
    delegation: sectionInitialValue(sectionKeys.delegation),
    document: sectionInitialValue(sectionKeys.document),
    leavePolicy: sectionInitialValue(sectionKeys.leavePolicy),
    approvalRule: sectionInitialValue(sectionKeys.approvalRule),
    security: sectionInitialValue(sectionKeys.security),
  });
  const [pending, setPending] = useState(false);
  const [policyPending, setPolicyPending] = useState(false);
  const [delegationPending, setDelegationPending] = useState(false);
  const [sealPending, setSealPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);

  const canEdit = currentUser.role === 'HEAD';
  const teamHeadCount = useMemo(() => data.teams.filter((team) => team.headUserId).length, [data.teams]);
  const sortedLeavePolicies = useMemo(() => sortPolicies(data.leavePolicies), [data.leavePolicies]);
  const activeDelegationCount = useMemo(() => data.permissionDelegations.filter((item) => item.status === 'ACTIVE').length, [data.permissionDelegations]);
  const delegationUsers = useMemo(() => {
    const keyword = delegationUserSearch.trim().toLowerCase();
    if (!keyword) return data.approvedUsers;
    return data.approvedUsers.filter((user) => `${user.name} ${user.email} ${user.teamName ?? '팀 미지정'} ${roleLabel(user.role)}`.toLowerCase().includes(keyword));
  }, [data.approvedUsers, delegationUserSearch]);
  const delegationTeams = useMemo(() => {
    const keyword = delegationTeamSearch.trim().toLowerCase();
    if (!keyword) return data.teams;
    return data.teams.filter((team) => `${team.name} ${team.headName ?? ''}`.toLowerCase().includes(keyword));
  }, [data.teams, delegationTeamSearch]);

  const selectedDelegator = data.approvedUsers.find((user) => user.id === delegationDraft.delegatorUserId);
  const selectedDelegatee = data.approvedUsers.find((user) => user.id === delegationDraft.delegateeUserId);
  const selectedTeam = data.teams.find((team) => team.id === delegationDraft.teamId);

  function toggleSection(key: keyof typeof sectionKeys) {
    setOpenSections((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(sectionKeys[key], next[key] ? '1' : '0');
      return next;
    });
  }

  async function saveRootName() {
    if (!canEdit) return;
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/org', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '조직 설정을 저장하지 못했습니다.');
      setData((prev) => ({ ...prev, organization: { rootName: body.rootName ?? rootName } }));
      setMessage('조직 설정을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '조직 설정을 저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  function editPolicy(policy: LeavePolicy) {
    setPolicyDraft({
      id: policy.id,
      position: policy.position,
      minYears: String(policy.minYears),
      maxYears: policy.maxYears == null ? '' : String(policy.maxYears),
      grantedDays: String(policy.grantedDays),
      effectiveFrom: policy.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveTo: policy.effectiveTo ?? '',
    });
  }

  async function savePolicy() {
    if (!canEdit) return;
    setPolicyPending(true);
    setMessage(null);
    try {
      const payload = {
        id: policyDraft.id,
        position: policyDraft.position,
        minYears: Number(policyDraft.minYears || 0),
        maxYears: policyDraft.maxYears.trim() ? Number(policyDraft.maxYears) : null,
        grantedDays: Number(policyDraft.grantedDays || 0),
        effectiveFrom: policyDraft.effectiveFrom,
        effectiveTo: policyDraft.effectiveTo.trim() ? policyDraft.effectiveTo : null,
      };
      const res = await fetch('/api/admin/settings/leave-policies', {
        method: policyDraft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '연차 정책을 저장하지 못했습니다.');
      const saved = body.policy as LeavePolicy;
      setData((prev) => ({
        ...prev,
        leavePolicies: sortPolicies(policyDraft.id ? prev.leavePolicies.map((policy) => (policy.id === saved.id ? saved : policy)) : [...prev.leavePolicies, saved]),
      }));
      setPolicyDraft(emptyPolicyDraft());
      setMessage('연차 정책을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연차 정책을 저장하지 못했습니다.');
    } finally {
      setPolicyPending(false);
    }
  }

  function requestRemovePolicy(policy: LeavePolicy) {
    setConfirmDialog({
      title: '연차 정책을 삭제할까요?',
      description: `${policyPositionLabel[policy.position] ?? policy.position} ${rangeLabel(policy.minYears, policy.maxYears)} 정책을 삭제합니다.`,
      confirmLabel: '삭제',
      tone: 'danger',
      onConfirm: () => void removePolicy(policy),
    });
  }

  async function removePolicy(policy: LeavePolicy) {
    if (!canEdit) return;
    setConfirmDialog(null);
    setPolicyPending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/settings/leave-policies?id=${encodeURIComponent(policy.id)}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '연차 정책을 삭제하지 못했습니다.');
      setData((prev) => ({ ...prev, leavePolicies: prev.leavePolicies.filter((item) => item.id !== policy.id) }));
      if (policyDraft.id === policy.id) setPolicyDraft(emptyPolicyDraft());
      setMessage('연차 정책을 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '연차 정책을 삭제하지 못했습니다.');
    } finally {
      setPolicyPending(false);
    }
  }

  async function uploadDocumentSeal(file: File | null) {
    if (!canEdit || !file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('전자직인은 이미지 파일만 등록할 수 있습니다.');
      return;
    }
    if (file.size > 900_000) {
      setMessage('전자직인은 900KB 이하 이미지 파일을 권장합니다.');
      return;
    }

    setSealPending(true);
    setMessage(null);
    try {
      const imageUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/admin/settings/document-seal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, fileName: file.name, storageKey: null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '전자직인을 저장하지 못했습니다.');
      setData((prev) => ({ ...prev, documentSeal: body.seal }));
      setMessage('전자직인을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '전자직인을 저장하지 못했습니다.');
    } finally {
      setSealPending(false);
    }
  }

  function requestRemoveDocumentSeal() {
    setConfirmDialog({
      title: '전자직인을 삭제할까요?',
      description: '등록된 전자직인을 삭제합니다. 재직증명서에는 기본 직인 스타일이 표시됩니다.',
      confirmLabel: '삭제',
      tone: 'danger',
      onConfirm: () => void removeDocumentSeal(),
    });
  }

  async function removeDocumentSeal() {
    if (!canEdit) return;
    setConfirmDialog(null);
    setSealPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/document-seal', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '전자직인을 삭제하지 못했습니다.');
      setData((prev) => ({ ...prev, documentSeal: body.seal }));
      setMessage('전자직인을 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '전자직인을 삭제하지 못했습니다.');
    } finally {
      setSealPending(false);
    }
  }

  function openDelegationModal() {
    setDelegationDraft(emptyDelegationDraft());
    setDelegationUserSearch('');
    setDelegationTeamSearch('');
    setDelegationModalOpen(true);
  }

  async function saveDelegation() {
    if (!canEdit) return;
    setDelegationPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/permission-delegations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(delegationDraft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '권한 위임을 저장하지 못했습니다.');
      setData((prev) => ({ ...prev, permissionDelegations: [body.delegation as PermissionDelegation, ...prev.permissionDelegations] }));
      setDelegationDraft(emptyDelegationDraft());
      setDelegationModalOpen(false);
      setMessage('권한 위임을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '권한 위임을 저장하지 못했습니다.');
    } finally {
      setDelegationPending(false);
    }
  }

  function requestCancelDelegation(delegation: PermissionDelegation) {
    setConfirmDialog({
      title: '권한 위임을 취소할까요?',
      description: `${delegation.delegateeName}님의 ${delegationScopeLabel[delegation.scope] ?? delegation.scope} 위임을 취소합니다.`,
      confirmLabel: '위임 취소',
      tone: 'danger',
      onConfirm: () => void cancelDelegation(delegation),
    });
  }

  async function cancelDelegation(delegation: PermissionDelegation) {
    if (!canEdit) return;
    setConfirmDialog(null);
    setDelegationPending(true);
    setMessage(null);
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
      setDelegationPending(false);
    }
  }

  const delegationSaveDisabled =
    delegationPending || !delegationDraft.delegatorUserId || !delegationDraft.delegateeUserId || !delegationDraft.teamId || !delegationDraft.startsAt || !delegationDraft.endsAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-950">
            <Settings className="h-5 w-5" />
            <h1 className="text-xl font-semibold">설정 센터</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">조직, 권한, 연차 정책, 결재와 보안 기준을 한 곳에서 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            계정 관리
          </Link>
          <Link href="/admin/audit-logs" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            감사 로그
          </Link>
        </div>
      </div>

      {message ? <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-800">{message}</div> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <Metric icon={<UsersRound className="h-4 w-4" />} label="전체 계정" value={`${data.users.total}명`} helper={`승인 ${data.users.approved}명`} />
        <Metric icon={<ShieldCheck className="h-4 w-4" />} label="관리 권한" value={`${data.users.managers}명`} helper={`VIEWER ${data.users.viewers}명`} />
        <Metric icon={<Building2 className="h-4 w-4" />} label="팀" value={`${data.teams.length}개`} helper={`팀장 지정 ${teamHeadCount}개`} />
        <Metric icon={<Bell className="h-4 w-4" />} label="미확인 알림" value={`${data.notifications.unread}건`} helper={`전체 ${data.notifications.total}건`} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">조직 / 권한</h2>
          <p className="mt-1 text-sm text-slate-500">본부명, 팀 구성, 계정 승인과 역할 변경 상태를 관리합니다.</p>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-500">조직 ROOT명</label>
            <div className="flex gap-2">
              <input
                value={rootName}
                onChange={(event) => setRootName(event.target.value)}
                disabled={!canEdit || pending}
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <Button variant="saveOutline" onClick={saveRootName} disabled={!canEdit || pending || !rootName.trim()}>
                저장
              </Button>
            </div>
            <p className="text-xs text-slate-500">{canEdit ? '조직도 최상단에 표시되는 이름입니다.' : 'ROOT명 수정은 HEAD 계정만 가능합니다.'}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <QuickLink href="/admin/org" title="조직도 관리" description="본부, 단, 팀, 구성원 배치를 확인합니다." />
            <QuickLink href="/admin/users" title="계정 승인 관리" description="가입 승인, 역할, 팀, 직급을 관리합니다." />
          </div>
        </div>
      </section>

      <CollapsibleSection
        icon={<UserCog className="h-4 w-4" />}
        title="권한 위임 관리"
        description="팀장 부재나 출장 기간 동안 필요한 팀 권한을 기간제로 위임합니다."
        open={openSections.delegation}
        onToggle={() => toggleSection('delegation')}
        action={
          canEdit ? (
            <button type="button" onClick={openDelegationModal} className="inline-flex h-9 items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-100">
              <UserCog className="h-4 w-4" />
              위임 등록
            </button>
          ) : null
        }
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="활성 위임" value={`${activeDelegationCount}건`} helper="현재 적용 중" />
          <Metric icon={<ClipboardCheck className="h-4 w-4" />} label="전체 이력" value={`${data.permissionDelegations.length}건`} helper="취소, 만료 포함" />
          <Metric icon={<KeyRound className="h-4 w-4" />} label="기본 위임자" value={`${data.permissionDelegationPresets.length}건`} helper="자주 쓰는 위임 계정" />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_120px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
            <span>위임 정보</span>
            <span>대상 팀</span>
            <span>기간</span>
            <span className="text-right">상태</span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.permissionDelegations.map((delegation) => (
              <div key={delegation.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1.2fr_1fr_1fr_120px] lg:items-center">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-950">
                    {delegation.delegatorName} {'->'} {delegation.delegateeName}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{delegationScopeLabel[delegation.scope] ?? delegation.scope}</div>
                  {delegation.reason ? <div className="mt-1 line-clamp-1 text-xs text-slate-400">{delegation.reason}</div> : null}
                </div>
                <div className="text-slate-600">{delegation.teamName}</div>
                <div className="text-slate-600">
                  {delegation.startsAt} ~ {delegation.endsAt}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <DelegationStatusBadge status={delegation.status} />
                  {canEdit && delegation.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => requestCancelDelegation(delegation)}
                      disabled={delegationPending}
                      className="rounded-md border border-rose-100 bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45"
                      aria-label="권한 위임 취소"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {data.permissionDelegations.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-500">등록된 권한 위임이 없습니다.</div> : null}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Stamp className="h-4 w-4" />}
        title="문서증명서 설정"
        description="재직증명서 등에 사용할 전자직인을 관리합니다."
        open={openSections.document}
        onToggle={() => toggleSection('document')}
      >
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex min-h-36 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
            {data.documentSeal.sealImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.documentSeal.sealImageUrl} alt="전자직인" className="max-h-28 max-w-32 object-contain" />
            ) : (
              <div className="text-center text-sm text-slate-400">등록된 전자직인이 없습니다.</div>
            )}
          </div>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <SealInfo label="파일명" value={data.documentSeal.sealFileName || '-'} />
              <SealInfo label="수정일" value={data.documentSeal.sealUpdatedAt ? formatDateTime(data.documentSeal.sealUpdatedAt) : '-'} />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 hover:bg-sky-100">
                <Upload className="h-4 w-4" />
                직인 업로드
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!canEdit || sealPending} onChange={(event) => void uploadDocumentSeal(event.target.files?.[0] ?? null)} />
              </label>
              <button
                type="button"
                onClick={requestRemoveDocumentSeal}
                disabled={!canEdit || sealPending || !data.documentSeal.sealImageUrl}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-100 bg-rose-50 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:pointer-events-none disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<ClipboardCheck className="h-4 w-4" />}
        title="연차 정책"
        description="직급과 근속연수 기준의 연차 부여 정책을 관리합니다."
        open={openSections.leavePolicy}
        onToggle={() => toggleSection('leavePolicy')}
      >
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
            <div className="grid gap-3">
              <SelectField label="직급" value={policyDraft.position} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, position: value }))} disabled={!canEdit || policyPending}>
                {policyPositions.map((position) => (
                  <option key={position} value={position}>
                    {policyPositionLabel[position]}
                  </option>
                ))}
              </SelectField>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="최소 연차" value={policyDraft.minYears} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, minYears: value }))} disabled={!canEdit || policyPending} />
                <TextField label="최대 연차" value={policyDraft.maxYears} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, maxYears: value }))} disabled={!canEdit || policyPending} placeholder="비우면 이상" />
              </div>
              <TextField label="부여 일수" value={policyDraft.grantedDays} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, grantedDays: value }))} disabled={!canEdit || policyPending} />
              <div className="grid grid-cols-2 gap-2">
                <TextField type="date" label="시작일" value={policyDraft.effectiveFrom} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, effectiveFrom: value }))} disabled={!canEdit || policyPending} />
                <TextField type="date" label="종료일" value={policyDraft.effectiveTo} onChange={(value) => setPolicyDraft((prev) => ({ ...prev, effectiveTo: value }))} disabled={!canEdit || policyPending} />
              </div>
              <div className="flex gap-2">
                <Button variant="saveOutline" onClick={savePolicy} disabled={!canEdit || policyPending || !policyDraft.effectiveFrom}>
                  {policyPending ? '저장 중' : policyDraft.id ? '정책 수정' : '정책 추가'}
                </Button>
                <Button variant="outline" type="button" onClick={() => setPolicyDraft(emptyPolicyDraft())}>
                  초기화
                </Button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-100">
            <div className="grid grid-cols-[1fr_1fr_100px_100px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
              <span>대상</span>
              <span>근속 기준</span>
              <span>부여</span>
              <span className="text-right">관리</span>
            </div>
            <div className="divide-y divide-slate-100">
              {sortedLeavePolicies.map((policy) => (
                <div key={policy.id} className="grid grid-cols-[1fr_1fr_100px_100px] items-center gap-3 px-4 py-3 text-sm">
                  <div className="font-semibold text-slate-950">{policyPositionLabel[policy.position] ?? policy.position}</div>
                  <div className="text-slate-600">{rangeLabel(policy.minYears, policy.maxYears)}</div>
                  <div className="text-slate-600">{policy.grantedDays}일</div>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => editPolicy(policy)} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                      수정
                    </button>
                    <button type="button" onClick={() => requestRemovePolicy(policy)} className="rounded-md border border-rose-100 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              {sortedLeavePolicies.length === 0 ? <div className="px-4 py-8 text-center text-sm text-slate-500">등록된 연차 정책이 없습니다.</div> : null}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<ShieldCheck className="h-4 w-4" />} title="결재룰" description="결재 대기 현황과 운영 기준을 확인합니다." open={openSections.approvalRule} onToggle={() => toggleSection('approvalRule')}>
        <div className="grid gap-3 md:grid-cols-3">
          <RuleRow label="대기 결재" value={`${data.approvals.pendingSteps}건`} />
          <RuleRow label="출장여비 결재" value={`${data.approvals.tripExpenseSteps}건`} />
          <RuleRow label="근태 결재" value={`${data.approvals.leaveSteps}건`} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection icon={<KeyRound className="h-4 w-4" />} title="보안 / 알림" description="초기 비밀번호와 알림 상태를 확인합니다." open={openSections.security} onToggle={() => toggleSection('security')}>
        <div className="grid gap-3 md:grid-cols-3">
          <RuleRow label="초기 비밀번호" value="new123!@" />
          <RuleRow label="비밀번호 변경 필요" value={`${data.users.forcePasswordChange}명`} />
          <RuleRow label="전체 알림" value={`${data.notifications.total}건`} />
        </div>
      </CollapsibleSection>

      {delegationModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="권한 위임 등록 닫기" onClick={() => setDelegationModalOpen(false)} />
          <div className="relative z-10 flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">권한 위임 등록</h2>
                <p className="mt-1 text-sm text-slate-500">위임자, 대리자, 대상 팀과 기간을 선택해 주세요.</p>
              </div>
              <button type="button" onClick={() => setDelegationModalOpen(false)} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <section className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input value={delegationUserSearch} onChange={(event) => setDelegationUserSearch(event.target.value)} placeholder="이름, 이메일, 팀 검색" className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                  </div>
                  <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                    {delegationUsers.map((user) => {
                      const delegatorSelected = delegationDraft.delegatorUserId === user.id;
                      const delegateeSelected = delegationDraft.delegateeUserId === user.id;
                      return (
                        <div key={user.id} className="rounded-lg border border-slate-100 bg-white p-3">
                          <div className="font-semibold text-slate-950">{user.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{user.email}</div>
                          <div className="mt-1 text-xs text-slate-400">{user.teamName ?? '팀 미지정'} · {roleLabel(user.role)}</div>
                          <div className="mt-3 flex gap-2">
                            <SelectChipButton label="위임자" selected={delegatorSelected} onClick={() => setDelegationDraft((prev) => ({ ...prev, delegatorUserId: user.id }))} />
                            <SelectChipButton label="대리자" selected={delegateeSelected} onClick={() => setDelegationDraft((prev) => ({ ...prev, delegateeUserId: user.id }))} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-100 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input value={delegationTeamSearch} onChange={(event) => setDelegationTeamSearch(event.target.value)} placeholder="팀명, 팀장 검색" className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-sky-200 focus:ring-2 focus:ring-sky-100" />
                  </div>
                  <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
                    {delegationTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setDelegationDraft((prev) => ({ ...prev, teamId: team.id }))}
                        className={[
                          'rounded-lg border p-3 text-left transition',
                          delegationDraft.teamId === team.id ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-100 bg-white hover:border-sky-100 hover:bg-sky-50/60',
                        ].join(' ')}
                      >
                        <div className="font-semibold">{team.name}</div>
                        <div className="mt-1 text-xs text-slate-500">팀장 {team.headName ?? '미지정'}</div>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
                  <h3 className="text-sm font-semibold text-slate-950">선택 요약</h3>
                  <div className="mt-3 space-y-2">
                    <SummaryLine label="위임자" value={selectedDelegator ? `${selectedDelegator.name} · ${roleLabel(selectedDelegator.role)}` : '선택 필요'} />
                    <SummaryLine label="대리자" value={selectedDelegatee ? `${selectedDelegatee.name} · ${selectedDelegatee.email}` : '선택 필요'} />
                    <SummaryLine label="대상 팀" value={selectedTeam?.name ?? '선택 필요'} />
                  </div>
                </section>

                <section className="rounded-lg border border-slate-100 bg-white p-4">
                  <div className="space-y-3">
                    <SelectField label="위임 범위" value={delegationDraft.scope} onChange={(value) => setDelegationDraft((prev) => ({ ...prev, scope: value }))} disabled={delegationPending}>
                      {Object.entries(delegationScopeLabel).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                    <TextField type="date" label="시작일" value={delegationDraft.startsAt} onChange={(value) => setDelegationDraft((prev) => ({ ...prev, startsAt: value }))} disabled={delegationPending} />
                    <TextField type="date" label="종료일" value={delegationDraft.endsAt} onChange={(value) => setDelegationDraft((prev) => ({ ...prev, endsAt: value }))} disabled={delegationPending} />
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-slate-600">사유</span>
                      <textarea value={delegationDraft.reason} onChange={(event) => setDelegationDraft((prev) => ({ ...prev, reason: event.target.value }))} disabled={delegationPending} className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100" placeholder="휴가, 출장, 부재 대응" />
                    </label>
                  </div>
                </section>
              </aside>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">등록 즉시 설정 기간 동안 대리자에게 위임 권한이 반영됩니다.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setDelegationModalOpen(false)} disabled={delegationPending} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45">
                  취소
                </button>
                <button type="button" onClick={saveDelegation} disabled={delegationSaveDisabled} className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-45">
                  {delegationPending ? '등록 중' : '권한 위임 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? <ConfirmModal dialog={confirmDialog} pending={policyPending || delegationPending || sealPending} onClose={() => setConfirmDialog(null)} /> : null}
    </div>
  );
}

function Metric({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function CollapsibleSection({ action, children, description, icon, onToggle, open, title }: { action?: ReactNode; children: ReactNode; description: string; icon: ReactNode; onToggle: () => void; open: boolean; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-3 text-left">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500">{icon}</span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-slate-950">{title}</span>
            <span className="mt-1 block text-sm text-slate-500">{description}</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {action}
          <button type="button" onClick={onToggle} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50" aria-label={`${title} 열기 닫기`}>
            <ChevronDown className={['h-4 w-4 transition', open ? 'rotate-180' : ''].join(' ')} />
          </button>
        </div>
      </div>
      {open ? <div className="p-5">{children}</div> : null}
    </section>
  );
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition hover:bg-slate-50">
      <div className="text-sm font-semibold text-slate-950">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </Link>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function SelectChipButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md border px-2 py-1.5 text-xs font-semibold transition',
        selected ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700',
      ].join(' ')}
    >
      {selected ? '선택됨' : label}
    </button>
  );
}

function SelectField({ children, disabled, label, onChange, value }: { children: ReactNode; disabled?: boolean; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400">
        {children}
      </select>
    </label>
  );
}

function TextField({ disabled, label, onChange, placeholder, type = 'text', value }: { disabled?: boolean; label: string; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} disabled={disabled} placeholder={placeholder} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-400" />
    </label>
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
  const toneClass =
    status === 'ACTIVE'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : status === 'EXPIRED'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-rose-100 bg-rose-50 text-rose-700';

  return <span className={['rounded-full border px-2 py-0.5 text-[11px] font-semibold', toneClass].join(' ')}>{delegationStatusLabel[status] ?? status}</span>;
}

function SealInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 truncate font-medium text-slate-900">{value}</div>
    </div>
  );
}

function ConfirmModal({ dialog, onClose, pending }: { dialog: ConfirmDialog; onClose: () => void; pending: boolean }) {
  const danger = dialog.tone === 'danger';
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/35" aria-label="확인 팝업 닫기" onClick={onClose} />
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
              'rounded-md px-3 py-2 text-sm font-semibold shadow-sm transition disabled:pointer-events-none disabled:opacity-45',
              danger ? 'border border-rose-100 bg-rose-50 text-rose-700 hover:bg-rose-100' : 'border border-sky-100 bg-sky-50 text-sky-700 hover:bg-sky-100',
            ].join(' ')}
          >
            {pending ? '처리 중...' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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

function rangeLabel(minYears: number, maxYears: number | null) {
  if (maxYears == null) return `${minYears}년 이상`;
  if (minYears === maxYears) return `${minYears}년`;
  return `${minYears}-${maxYears}년`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
