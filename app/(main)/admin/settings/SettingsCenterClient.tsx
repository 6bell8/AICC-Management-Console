'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, ChevronDown, ClipboardCheck, KeyRound, Search, Settings, ShieldCheck, Stamp, Trash2, Upload, UserCog, UsersRound, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import type { AuthUser } from '@/app/lib/db/users';
import type { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

type SettingsData = Awaited<ReturnType<typeof getSettingsCenterData>>;
type LeavePolicy = SettingsData['leavePolicies'][number];
type DocumentSeal = SettingsData['documentSeal'];
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

type Props = {
  initialData: SettingsData;
  currentUser: AuthUser;
};

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

const SETTINGS_PERMISSION_DELEGATION_OPEN_KEY = 'aicc:settings-permission-delegation-open';
const SETTINGS_DOCUMENT_SEAL_OPEN_KEY = 'aicc:settings-document-seal-open';
const SETTINGS_LEAVE_POLICY_OPEN_KEY = 'aicc:settings-leave-policy-open';
const SETTINGS_APPROVAL_RULE_OPEN_KEY = 'aicc:settings-approval-rule-open';
const SETTINGS_SECURITY_NOTICE_OPEN_KEY = 'aicc:settings-security-notice-open';

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

function rangeLabel(minYears: number, maxYears: number | null) {
  if (maxYears == null) return `${minYears}년 이상`;
  if (minYears === maxYears) return `${minYears}년`;
  return `${minYears}-${maxYears}년`;
}

function sortPolicies(policies: LeavePolicy[]) {
  return [...policies].sort((a, b) => {
    if (a.position !== b.position) return a.position.localeCompare(b.position);
    if (a.minYears !== b.minYears) return a.minYears - b.minYears;
    return (a.effectiveFrom ?? '').localeCompare(b.effectiveFrom ?? '');
  });
}

export default function SettingsCenterClient({ initialData, currentUser }: Props) {
  const [data, setData] = useState(initialData);
  const [rootName, setRootName] = useState(initialData.organization.rootName);
  const [policyDraft, setPolicyDraft] = useState<LeavePolicyDraft>(emptyPolicyDraft);
  const [delegationDraft, setDelegationDraft] = useState<DelegationDraft>(emptyDelegationDraft);
  const [delegationModalOpen, setDelegationModalOpen] = useState(false);
  const [delegationUserSearch, setDelegationUserSearch] = useState('');
  const [delegationTeamSearch, setDelegationTeamSearch] = useState('');
  const [delegationTeamFilter, setDelegationTeamFilter] = useState('ALL');
  const [delegationSectionOpen, setDelegationSectionOpen] = useState(true);
  const [documentSectionOpen, setDocumentSectionOpen] = useState(true);
  const [leavePolicySectionOpen, setLeavePolicySectionOpen] = useState(true);
  const [approvalRuleSectionOpen, setApprovalRuleSectionOpen] = useState(true);
  const [securityNoticeSectionOpen, setSecurityNoticeSectionOpen] = useState(true);
  const [pending, setPending] = useState(false);
  const [policyPending, setPolicyPending] = useState(false);
  const [delegationPending, setDelegationPending] = useState(false);
  const [sealPending, setSealPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canEdit = currentUser.role === 'HEAD';

  const teamHeadCount = useMemo(() => data.teams.filter((team) => team.headUserId).length, [data.teams]);
  const sortedLeavePolicies = useMemo(() => sortPolicies(data.leavePolicies), [data.leavePolicies]);
  const activeDelegationCount = useMemo(() => data.permissionDelegations.filter((item) => item.status === 'ACTIVE').length, [data.permissionDelegations]);
  const delegationUsers = useMemo(() => {
    const keyword = delegationUserSearch.trim().toLowerCase();
    const scopedUsers = data.approvedUsers.filter((user) => {
      if (delegationTeamFilter === 'ALL') return true;
      if (delegationTeamFilter === 'UNASSIGNED') return !user.teamId;
      return user.teamId === delegationTeamFilter;
    });
    if (!keyword) return scopedUsers;
    return scopedUsers.filter((user) => `${user.name} ${user.email} ${user.teamName ?? '팀 미지정'} ${roleLabel(user.role)}`.toLowerCase().includes(keyword));
  }, [data.approvedUsers, delegationTeamFilter, delegationUserSearch]);
  const delegationTeams = useMemo(() => {
    const keyword = delegationTeamSearch.trim().toLowerCase();
    if (!keyword) return data.teams;
    return data.teams.filter((team) => `${team.name} ${team.headName ?? ''}`.toLowerCase().includes(keyword));
  }, [data.teams, delegationTeamSearch]);
  const selectedDelegator = data.approvedUsers.find((user) => user.id === delegationDraft.delegatorUserId);
  const selectedDelegatee = data.approvedUsers.find((user) => user.id === delegationDraft.delegateeUserId);
  const selectedTeam = data.teams.find((team) => team.id === delegationDraft.teamId);

  useEffect(() => {
    const delegationSaved = window.localStorage.getItem(SETTINGS_PERMISSION_DELEGATION_OPEN_KEY);
    const documentSaved = window.localStorage.getItem(SETTINGS_DOCUMENT_SEAL_OPEN_KEY);
    const leavePolicySaved = window.localStorage.getItem(SETTINGS_LEAVE_POLICY_OPEN_KEY);
    const approvalRuleSaved = window.localStorage.getItem(SETTINGS_APPROVAL_RULE_OPEN_KEY);
    const securityNoticeSaved = window.localStorage.getItem(SETTINGS_SECURITY_NOTICE_OPEN_KEY);
    if (delegationSaved === '0') setDelegationSectionOpen(false);
    if (delegationSaved === '1') setDelegationSectionOpen(true);
    if (documentSaved === '0') setDocumentSectionOpen(false);
    if (documentSaved === '1') setDocumentSectionOpen(true);
    if (leavePolicySaved === '0') setLeavePolicySectionOpen(false);
    if (leavePolicySaved === '1') setLeavePolicySectionOpen(true);
    if (approvalRuleSaved === '0') setApprovalRuleSectionOpen(false);
    if (approvalRuleSaved === '1') setApprovalRuleSectionOpen(true);
    if (securityNoticeSaved === '0') setSecurityNoticeSectionOpen(false);
    if (securityNoticeSaved === '1') setSecurityNoticeSectionOpen(true);
  }, []);

  const toggleDelegationSection = () => {
    setDelegationSectionOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SETTINGS_PERMISSION_DELEGATION_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const toggleDocumentSection = () => {
    setDocumentSectionOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SETTINGS_DOCUMENT_SEAL_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const toggleLeavePolicySection = () => {
    setLeavePolicySectionOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SETTINGS_LEAVE_POLICY_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const toggleApprovalRuleSection = () => {
    setApprovalRuleSectionOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SETTINGS_APPROVAL_RULE_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const toggleSecurityNoticeSection = () => {
    setSecurityNoticeSectionOpen((current) => {
      const next = !current;
      window.localStorage.setItem(SETTINGS_SECURITY_NOTICE_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

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
    setMessage(null);
  }

  function resetPolicyDraft() {
    setPolicyDraft(emptyPolicyDraft());
    setMessage(null);
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

  async function removePolicy(policy: LeavePolicy) {
    if (!canEdit) return;
    if (!window.confirm(`${policyPositionLabel[policy.position] ?? policy.position} ${rangeLabel(policy.minYears, policy.maxYears)} 정책을 삭제할까요?`)) return;

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
      setMessage('전자직인은 900KB 이하 PNG 파일을 권장합니다.');
      return;
    }

    setSealPending(true);
    setMessage(null);
    try {
      const imageUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/admin/settings/document-seal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          fileName: file.name,
          storageKey: null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '전자직인을 저장하지 못했습니다.');
      setData((prev) => ({ ...prev, documentSeal: body.seal as DocumentSeal }));
      setMessage('전자직인을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '전자직인을 저장하지 못했습니다.');
    } finally {
      setSealPending(false);
    }
  }

  async function removeDocumentSeal() {
    if (!canEdit) return;
    if (!window.confirm('등록된 전자직인을 삭제할까요?')) return;

    setSealPending(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings/document-seal', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '전자직인을 삭제하지 못했습니다.');
      setData((prev) => ({ ...prev, documentSeal: body.seal as DocumentSeal }));
      setMessage('전자직인을 삭제했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '전자직인을 삭제하지 못했습니다.');
    } finally {
      setSealPending(false);
    }
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
      setDelegationUserSearch('');
      setDelegationTeamSearch('');
      setDelegationTeamFilter('ALL');
      setDelegationModalOpen(false);
      setMessage('권한 위임을 저장했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '권한 위임을 저장하지 못했습니다.');
    } finally {
      setDelegationPending(false);
    }
  }

  async function cancelDelegation(delegation: PermissionDelegation) {
    if (!canEdit) return;
    if (!window.confirm(`${delegation.delegateeName}님의 ${delegationScopeLabel[delegation.scope] ?? delegation.scope} 위임을 취소할까요?`)) return;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-950">
            <Settings className="h-5 w-5" />
            <h1 className="text-xl font-semibold">설정 센터</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">조직, 권한, 연차 정책, 결재와 알림 기준을 한 곳에서 점검합니다.</p>
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

      <section className="hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <button type="button" onClick={toggleDelegationSection} className="group flex min-w-0 flex-1 items-start gap-2 text-left" aria-expanded={delegationSectionOpen}>
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600">
              <ChevronDown className={['h-4 w-4 transition-transform duration-200', delegationSectionOpen ? 'rotate-0' : '-rotate-90'].join(' ')} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-sky-600" />
                <span className="text-base font-semibold text-slate-950">권한 위임 관리</span>
              </span>
              <span className="mt-1 block text-sm text-slate-500">팀장 부재 기간 동안 대리자에게 팀장 권한을 임시로 부여합니다.</span>
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex w-fit rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              활성 {activeDelegationCount}건
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setDelegationModalOpen(true)}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
              >
                <UserCog className="h-4 w-4" />
                권한 위임 등록
              </button>
            ) : null}
          </div>
        </div>

        {delegationSectionOpen ? <div className="p-5">
          <div className="overflow-hidden rounded-lg border border-slate-100">
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
                    <div className="font-semibold text-slate-950">{delegation.delegatorName} → {delegation.delegateeName}</div>
                    <div className="mt-1 text-xs text-slate-500">{delegationScopeLabel[delegation.scope] ?? delegation.scope}</div>
                    {delegation.reason ? <div className="mt-1 line-clamp-1 text-xs text-slate-400">{delegation.reason}</div> : null}
                  </div>
                  <div className="text-slate-600">{delegation.teamName}</div>
                  <div className="text-xs text-slate-500">{delegation.startsAt} ~ {delegation.endsAt}</div>
                  <div className="flex items-center justify-start gap-2 lg:justify-end">
                    <DelegationStatusBadge status={delegation.status} />
                    {canEdit && delegation.status === 'ACTIVE' ? (
                      <button
                        type="button"
                        onClick={() => void cancelDelegation(delegation)}
                        disabled={delegationPending}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-45"
                      >
                        취소
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {data.permissionDelegations.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">등록된 권한 위임이 없습니다.</div>
              ) : null}
            </div>
          </div>
        </div> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <button type="button" onClick={toggleDocumentSection} className="group flex w-full items-start gap-2 text-left" aria-expanded={documentSectionOpen}>
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600">
              <ChevronDown className={['h-4 w-4 transition-transform duration-200', documentSectionOpen ? 'rotate-0' : '-rotate-90'].join(' ')} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <Stamp className="h-4 w-4 text-sky-600" />
                <span className="text-base font-semibold text-slate-950">문서 / 증명서 설정</span>
              </span>
              <span className="mt-1 block text-sm text-slate-500">재직증명서에 사용할 전자직인을 관리합니다. 운영 전환 시 파일은 별도 저장소에 보관하고 DB에는 경로만 저장합니다.</span>
            </span>
          </button>
        </div>
        {documentSectionOpen ? <div className="grid gap-4 p-5 lg:grid-cols-[260px_1fr]">
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4">
            {data.documentSeal.sealImageUrl ? (
              <img src={data.documentSeal.sealImageUrl} alt="등록된 전자직인" className="max-h-36 max-w-full object-contain" />
            ) : (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400">
                  <Stamp className="h-7 w-7" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700">전자직인 미등록</div>
                <div className="mt-1 text-xs text-slate-400">투명 PNG 권장</div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <SealInfo label="파일명" value={data.documentSeal.sealFileName || '-'} />
              <SealInfo label="업데이트" value={data.documentSeal.sealUpdatedAt ? formatDateTime(data.documentSeal.sealUpdatedAt) : '-'} />
              <SealInfo label="저장 방식" value={data.documentSeal.sealStorageKey ? '파일 저장소' : data.documentSeal.sealImageUrl ? '임시 DB 저장' : '-'} />
              <SealInfo label="권장 형식" value="PNG / 투명 배경 / 900KB 이하" />
            </div>

            <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-800">
              현재는 개발 단계라 이미지 데이터를 DB에 임시 저장합니다. Vercel Blob, S3, Railway Bucket 연결 후에는 이 API에서 업로드 후 storage key만 저장하면 됩니다.
            </div>

            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  'inline-flex cursor-pointer items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100',
                  !canEdit || sealPending ? 'pointer-events-none opacity-50' : '',
                ].join(' ')}
              >
                <Upload className="h-4 w-4" />
                직인 이미지 업로드
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!canEdit || sealPending} onChange={(event) => void uploadDocumentSeal(event.target.files?.[0] ?? null)} />
              </label>
              <button
                type="button"
                onClick={removeDocumentSeal}
                disabled={!canEdit || sealPending || !data.documentSeal.sealImageUrl}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-700 disabled:pointer-events-none disabled:opacity-45"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </button>
            </div>
          </div>
        </div> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white">
          <button type="button" onClick={toggleLeavePolicySection} className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50/70">
            <div>
            <h2 className="text-base font-semibold text-slate-950">연차 정책</h2>
            <p className="mt-1 text-sm text-slate-500">정규직은 근속연수 기준, 계약직은 입사 후 만근 월 기준으로 잔여 연차를 계산합니다.</p>
            </div>
            <ChevronDown className={['h-4 w-4 shrink-0 text-slate-400 transition', leavePolicySectionOpen ? 'rotate-180' : ''].join(' ')} />
          </button>
          {leavePolicySectionOpen ? <>
          <div className="border-b border-slate-100 bg-slate-50/40 p-5">
            {canEdit ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    대상
                    <select
                      value={policyDraft.position}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, position: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    >
                      {policyPositions.map((position) => (
                        <option key={position} value={position}>
                          {policyPositionLabel[position]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    최소 근속연수
                    <input
                      type="number"
                      min="0"
                      value={policyDraft.minYears}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, minYears: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    최대 근속연수
                    <input
                      type="number"
                      min="0"
                      placeholder="상한 없음"
                      value={policyDraft.maxYears}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, maxYears: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    부여일
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={policyDraft.grantedDays}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, grantedDays: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    적용 시작
                    <input
                      type="date"
                      value={policyDraft.effectiveFrom}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, effectiveFrom: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-500">
                    적용 종료
                    <input
                      type="date"
                      value={policyDraft.effectiveTo}
                      onChange={(event) => setPolicyDraft((prev) => ({ ...prev, effectiveTo: event.target.value }))}
                      disabled={policyPending}
                      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">최대 근속연수와 적용 종료일을 비우면 제한 없이 적용됩니다.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetPolicyDraft}
                      disabled={policyPending}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      초기화
                    </button>
                    <button
                      type="button"
                      onClick={savePolicy}
                      disabled={policyPending || !policyDraft.effectiveFrom}
                      className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
                    >
                      {policyDraft.id ? '정책 수정' : '정책 등록'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">연차 정책 등록, 수정, 삭제는 HEAD 계정만 가능합니다.</p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">대상</th>
                  <th className="px-4 py-3 font-medium">근속 구간</th>
                  <th className="px-4 py-3 font-medium">부여일</th>
                  <th className="px-4 py-3 font-medium">적용 시작</th>
                  <th className="px-4 py-3 font-medium">적용 종료</th>
                  {canEdit ? <th className="px-4 py-3 text-right font-medium">관리</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedLeavePolicies.map((policy) => (
                  <tr key={policy.id}>
                    <td className="px-4 py-3">{policyPositionLabel[policy.position] ?? policy.position}</td>
                    <td className="px-4 py-3 text-slate-600">{rangeLabel(policy.minYears, policy.maxYears)}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{policy.grantedDays}일</td>
                    <td className="px-4 py-3 text-slate-500">{policy.effectiveFrom ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{policy.effectiveTo ?? '-'}</td>
                    {canEdit ? (
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editPolicy(policy)}
                            disabled={policyPending}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => removePolicy(policy)}
                            disabled={policyPending}
                            className="rounded-md border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {sortedLeavePolicies.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={canEdit ? 6 : 5}>
                      등록된 연차 정책이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
            현재 정책 {data.leavePolicies.length}개가 등록되어 있습니다. 정책 변경은 감사 로그에 설정 변경 이력으로 남습니다.
          </div>
          </> : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-950">운영 정책</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">결재 흐름과 보안 알림 기준을 간단히 확인합니다.</p>
          </div>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={toggleApprovalRuleSection} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50/70" aria-expanded={approvalRuleSectionOpen}>
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-sky-600" />
                <span className="text-base font-semibold text-slate-950">결재 룰</span>
              </span>
              <ChevronDown className={['h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', approvalRuleSectionOpen ? 'rotate-180' : ''].join(' ')} />
            </button>
            {approvalRuleSectionOpen ? <div className="space-y-2 border-t border-slate-100 bg-slate-50/30 p-5">
              <RuleRow label="연차 / 반차" value="팀장 또는 HEAD 승인" />
              <RuleRow label="출장여비" value="팀장 승인 후 인사팀 최종 승인" />
              <RuleRow label="대기 결재 단계" value={`${data.approvals.pendingSteps}건`} />
              <Link href="/approvals" className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                결재함으로 이동
              </Link>
            </div> : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button type="button" onClick={toggleSecurityNoticeSection} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50/70" aria-expanded={securityNoticeSectionOpen}>
              <span className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-sky-600" />
                <span className="text-base font-semibold text-slate-950">보안 / 알림</span>
              </span>
              <ChevronDown className={['h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200', securityNoticeSectionOpen ? 'rotate-180' : ''].join(' ')} />
            </button>
            {securityNoticeSectionOpen ? <div className="space-y-2 border-t border-slate-100 bg-slate-50/30 p-5">
              <RuleRow label="초기화 비밀번호" value="new123!@" />
              <RuleRow label="비밀번호 변경 대기" value={`${data.users.forcePasswordChange}명`} />
              <RuleRow label="읽지 않은 알림" value={`${data.notifications.unread}건`} />
              <Link href="/notifications" className="mt-2 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                알림함으로 이동
              </Link>
            </div> : null}
          </section>
        </div>
      </section>

      {delegationModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/40" aria-label="권한 위임 등록 닫기" onClick={() => setDelegationModalOpen(false)} />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-sky-600" />
                  <h2 className="text-base font-semibold text-slate-950">권한 위임 등록</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">검색 후 대상을 클릭해 위임 정보를 구성합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setDelegationModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <section className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">사용자 선택</h3>
                        <p className="mt-0.5 text-xs text-slate-500">위임자와 대리자를 각각 선택합니다.</p>
                      </div>
                      <div className="relative w-full max-w-[280px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={delegationUserSearch}
                          onChange={(event) => setDelegationUserSearch(event.target.value)}
                          placeholder="이름, 이메일, 권한 검색"
                          className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                    <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
                      <span className="shrink-0 text-xs font-semibold text-slate-500">팀별 보기</span>
                      <TeamFilterChip label="전체" selected={delegationTeamFilter === 'ALL'} onClick={() => setDelegationTeamFilter('ALL')} />
                      <TeamFilterChip label="팀 미지정" selected={delegationTeamFilter === 'UNASSIGNED'} onClick={() => setDelegationTeamFilter('UNASSIGNED')} />
                      {data.teams.map((team) => (
                        <TeamFilterChip key={team.id} label={team.name} selected={delegationTeamFilter === team.id} onClick={() => setDelegationTeamFilter(team.id)} />
                      ))}
                    </div>
                    <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {delegationUsers.map((user) => (
                        <div key={user.id} className="rounded-md border border-slate-100 bg-slate-50/50 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-950">{user.name}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-500">{user.email}</div>
                              <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{user.teamName ?? '팀 미지정'} · {roleLabel(user.role)}</div>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <SelectChipButton
                              label="위임자"
                              selected={delegationDraft.delegatorUserId === user.id}
                              onClick={() => setDelegationDraft((prev) => ({ ...prev, delegatorUserId: user.id }))}
                            />
                            <SelectChipButton
                              label="대리자"
                              selected={delegationDraft.delegateeUserId === user.id}
                              onClick={() => setDelegationDraft((prev) => ({ ...prev, delegateeUserId: user.id }))}
                            />
                          </div>
                        </div>
                      ))}
                      {delegationUsers.length === 0 ? <div className="col-span-full px-3 py-8 text-center text-sm text-slate-500">검색된 사용자가 없습니다.</div> : null}
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">팀 선택</h3>
                        <p className="mt-0.5 text-xs text-slate-500">위임 권한이 적용될 팀을 선택합니다.</p>
                      </div>
                      <div className="relative w-full max-w-[260px]">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={delegationTeamSearch}
                          onChange={(event) => setDelegationTeamSearch(event.target.value)}
                          placeholder="팀명, 팀장 검색"
                          className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                    <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {delegationTeams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setDelegationDraft((prev) => ({ ...prev, teamId: team.id }))}
                          className={[
                            'rounded-md border p-3 text-left transition',
                            delegationDraft.teamId === team.id ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-slate-100 bg-slate-50/60 text-slate-700 hover:border-sky-100 hover:bg-sky-50/60',
                          ].join(' ')}
                        >
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
                    <h3 className="text-sm font-semibold text-slate-950">선택 요약</h3>
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
                        <select
                          value={delegationDraft.scope}
                          onChange={(event) => setDelegationDraft((prev) => ({ ...prev, scope: event.target.value }))}
                          disabled={delegationPending}
                          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                        >
                          {Object.entries(delegationScopeLabel).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">시작일</span>
                          <input
                            type="date"
                            value={delegationDraft.startsAt}
                            onChange={(event) => setDelegationDraft((prev) => ({ ...prev, startsAt: event.target.value }))}
                            disabled={delegationPending}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-600">종료일</span>
                          <input
                            type="date"
                            value={delegationDraft.endsAt}
                            onChange={(event) => setDelegationDraft((prev) => ({ ...prev, endsAt: event.target.value }))}
                            disabled={delegationPending}
                            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                          />
                        </label>
                      </div>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-slate-600">사유</span>
                        <textarea
                          value={delegationDraft.reason}
                          onChange={(event) => setDelegationDraft((prev) => ({ ...prev, reason: event.target.value }))}
                          disabled={delegationPending}
                          className="min-h-24 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                          placeholder="예: 팀장 휴가, 출장, 부재 대응"
                        />
                      </label>
                    </div>
                  </section>
                </aside>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">등록 즉시 설정 기간 동안 대리자에게 위임 권한이 반영됩니다.</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDelegationModalOpen(false)}
                  disabled={delegationPending}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-45"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveDelegation}
                  disabled={delegationPending || !delegationDraft.delegatorUserId || !delegationDraft.delegateeUserId || !delegationDraft.teamId || !delegationDraft.startsAt || !delegationDraft.endsAt}
                  className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-45"
                >
                  {delegationPending ? '등록 중' : '권한 위임 등록'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
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

function TeamFilterChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
        selected ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50/70 hover:text-sky-700',
      ].join(' ')}
    >
      {label}
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
  const toneClass =
    status === 'ACTIVE'
      ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
      : status === 'EXPIRED'
        ? 'border-slate-200 bg-slate-50 text-slate-600'
        : 'border-rose-100 bg-rose-50 text-rose-700';

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

function SealInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 truncate font-medium text-slate-900">{value}</div>
    </div>
  );
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
