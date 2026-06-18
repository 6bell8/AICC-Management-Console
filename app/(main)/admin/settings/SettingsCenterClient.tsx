'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Bell, Building2, ClipboardCheck, KeyRound, Settings, ShieldCheck, Stamp, Trash2, Upload, UsersRound } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import type { AuthUser } from '@/app/lib/db/users';
import type { getSettingsCenterData } from '@/app/lib/db/settingsCenter';

type SettingsData = Awaited<ReturnType<typeof getSettingsCenterData>>;
type LeavePolicy = SettingsData['leavePolicies'][number];
type DocumentSeal = SettingsData['documentSeal'];
type LeavePolicyDraft = {
  id?: string;
  position: string;
  minYears: string;
  maxYears: string;
  grantedDays: string;
  effectiveFrom: string;
  effectiveTo: string;
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
  const [pending, setPending] = useState(false);
  const [policyPending, setPolicyPending] = useState(false);
  const [sealPending, setSealPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canEdit = currentUser.role === 'HEAD';

  const teamHeadCount = useMemo(() => data.teams.filter((team) => team.headUserId).length, [data.teams]);
  const sortedLeavePolicies = useMemo(() => sortPolicies(data.leavePolicies), [data.leavePolicies]);

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

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Stamp className="h-4 w-4 text-sky-600" />
            <h2 className="text-base font-semibold text-slate-950">문서 / 증명서 설정</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">재직증명서에 사용할 전자직인을 관리합니다. 운영 전환 시 파일은 별도 저장소에 보관하고 DB에는 경로만 저장합니다.</p>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-[260px_1fr]">
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
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-950">연차 정책</h2>
            <p className="mt-1 text-sm text-slate-500">정규직은 근속연수 기준, 계약직은 입사 후 만근 월 기준으로 잔여 연차를 계산합니다.</p>
          </div>
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
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-950">결재 룰</h2>
            </div>
            <div className="mt-4 space-y-2">
              <RuleRow label="연차 / 반차" value="팀장 또는 HEAD 승인" />
              <RuleRow label="출장여비" value="팀장 승인 후 인사팀 최종 승인" />
              <RuleRow label="대기 결재 단계" value={`${data.approvals.pendingSteps}건`} />
            </div>
            <Link href="/approvals" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              결재함으로 이동
            </Link>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-950">보안 / 알림</h2>
            </div>
            <div className="mt-4 space-y-2">
              <RuleRow label="초기화 비밀번호" value="new123!@" />
              <RuleRow label="비밀번호 변경 대기" value={`${data.users.forcePasswordChange}명`} />
              <RuleRow label="읽지 않은 알림" value={`${data.notifications.unread}건`} />
            </div>
            <Link href="/notifications" className="mt-4 inline-flex rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              알림함으로 이동
            </Link>
          </section>
        </div>
      </section>
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
