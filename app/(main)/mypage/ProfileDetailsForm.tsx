'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Award, BriefcaseBusiness, Camera, ChevronDown, FileBadge, GraduationCap, Home, IdCard, Plus, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';

import type { EmployeeProfileDetails } from '@/app/lib/db/profileDetails';

type ProfileFormState = Omit<EmployeeProfileDetails, 'userId' | 'updatedAt'>;
type DetailKey = 'education' | 'awards' | 'certifications';

const PROFILE_DETAILS_OPEN_KEY = 'aicc:mypage-profile-details-open';

const DETAIL_TABS: Array<{ key: DetailKey; label: string; icon: ReactNode; placeholder: string; guide: string }> = [
  {
    key: 'education',
    label: '학력',
    icon: <GraduationCap className="h-4 w-4" />,
    placeholder: '예: 2020.02 한국대학교 컴퓨터공학과 졸업',
    guide: '학교명, 전공, 졸업/수료 상태를 한 줄씩 추가해 주세요.',
  },
  {
    key: 'awards',
    label: '수상',
    icon: <Award className="h-4 w-4" />,
    placeholder: '예: 2024 사내 우수 프로젝트상',
    guide: '수상 연도와 수상명을 간단히 입력하면 증빙용 이력으로 보기 좋습니다.',
  },
  {
    key: 'certifications',
    label: '자격증',
    icon: <IdCard className="h-4 w-4" />,
    placeholder: '예: 정보처리기사, SQLD',
    guide: '자격증명 또는 발급기관이 필요하면 함께 입력해 주세요.',
  },
];

function splitItems(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinItems(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean).join('\n');
}

export default function ProfileDetailsForm({ profile, fallbackName }: { profile: EmployeeProfileDetails; fallbackName: string }) {
  const [open, setOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<DetailKey>('education');
  const [drafts, setDrafts] = useState<Record<DetailKey, string>>({ education: '', awards: '', certifications: '' });
  const [form, setForm] = useState<ProfileFormState>({
    displayName: profile.displayName,
    residentNumberMasked: profile.residentNumberMasked,
    address: profile.address,
    certificatePurpose: profile.certificatePurpose,
    education: profile.education,
    awards: profile.awards,
    certifications: profile.certifications,
    photoUrl: profile.photoUrl,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const displayName = useMemo(() => form.displayName.trim() || fallbackName, [fallbackName, form.displayName]);
  const filledCount = [
    form.displayName,
    form.residentNumberMasked,
    form.address,
    form.certificatePurpose,
    form.education,
    form.awards,
    form.certifications,
    form.photoUrl,
  ].filter((value) => value.trim()).length;
  const activeTab = DETAIL_TABS.find((tab) => tab.key === activeDetail) ?? DETAIL_TABS[0];
  const activeItems = splitItems(form[activeDetail]);

  useEffect(() => {
    const saved = window.localStorage.getItem(PROFILE_DETAILS_OPEN_KEY);
    if (saved === '0') setOpen(false);
    if (saved === '1') setOpen(true);
  }, []);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      window.localStorage.setItem(PROFILE_DETAILS_OPEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const updateField = (key: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const addDetailItem = (key: DetailKey) => {
    const value = drafts[key].trim();
    if (!value) return;
    const nextItems = [...splitItems(form[key]), value];
    updateField(key, joinItems(nextItems));
    setDrafts((current) => ({ ...current, [key]: '' }));
  };

  const removeDetailItem = (key: DetailKey, index: number) => {
    const nextItems = splitItems(form[key]).filter((_, itemIndex) => itemIndex !== index);
    updateField(key, joinItems(nextItems));
  };

  const onDetailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addDetailItem(activeDetail);
  };

  const onPhotoFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 900_000) {
      setMessage('사진은 900KB 이하 이미지만 등록해 주세요.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateField('photoUrl', String(reader.result ?? ''));
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/profile/details', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || '프로필을 저장하지 못했습니다.');
      setMessage('프로필이 저장되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <button type="button" onClick={toggleOpen} className="group flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-slate-500 transition group-hover:border-sky-100 group-hover:bg-sky-50 group-hover:text-sky-600">
            <ChevronDown className={['h-4 w-4 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90'].join(' ')} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold text-slate-950">프로필 상세 정보</span>
            <span className="mt-1 block truncate text-sm text-slate-500">재직증명서 기재 항목, 사진, 학력, 수상, 자격증 관리</span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">입력 {filledCount}/8</span>
          <Link
            href="/mypage/certificate"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
          >
            <FileBadge className="h-4 w-4" />
            재직증명서
          </Link>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100 p-4">
          <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="mx-auto h-24 w-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {form.photoUrl ? (
                  <Image src={form.photoUrl} alt={`${displayName} 프로필 사진`} width={96} height={96} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
                    <Camera className="h-7 w-7" />
                  </div>
                )}
              </div>
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
                <Camera className="h-3.5 w-3.5" />
                사진 선택
                <input type="file" accept="image/*" className="sr-only" onChange={onPhotoFile} />
              </label>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border border-sky-100 bg-sky-50/40 p-3">
                <div className="mb-3 flex items-center gap-2">
                  <FileBadge className="h-4 w-4 text-sky-600" />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">재직증명서 기재 항목</h3>
                    <p className="mt-0.5 text-xs text-slate-500">성명, 소속, 계약형태, 직위, 직책, 재직기간은 승인된 계정/인사 정보에서 자동 반영됩니다.</p>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <Field label="성명" icon={<IdCard className="h-4 w-4" />}>
                    <input value={fallbackName} readOnly className="profile-input bg-slate-50 text-slate-500" />
                  </Field>
                  <Field label="주민등록번호(표시용)" icon={<IdCard className="h-4 w-4" />}>
                    <input
                      value={form.residentNumberMasked}
                      onChange={(event) => updateField('residentNumberMasked', event.target.value)}
                      placeholder="예: 900101-1******"
                      className="profile-input"
                    />
                  </Field>
                  <Field label="주소" icon={<Home className="h-4 w-4" />}>
                    <input value={form.address} onChange={(event) => updateField('address', event.target.value)} placeholder="주소를 입력해 주세요." className="profile-input" />
                  </Field>
                  <Field label="용도" icon={<BriefcaseBusiness className="h-4 w-4" />}>
                    <input
                      value={form.certificatePurpose}
                      onChange={(event) => updateField('certificatePurpose', event.target.value)}
                      placeholder="예: 금융권 제출, 회사 제출"
                      className="profile-input"
                    />
                  </Field>
                </div>
              </div>

              <Field label="사진 URL" icon={<Camera className="h-4 w-4" />}>
                <input
                  value={form.photoUrl}
                  onChange={(event) => updateField('photoUrl', event.target.value)}
                  placeholder="이미지 URL 또는 선택한 사진 데이터"
                  className="profile-input text-xs"
                />
              </Field>

              <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveDetail(tab.key)}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold transition',
                        activeDetail === tab.key ? 'border-sky-100 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <span className="text-slate-400">{tab.icon}</span>
                      {tab.label}
                      <span className="text-[11px] opacity-70">{splitItems(form[tab.key]).length}</span>
                    </button>
                  ))}
                </div>

                <p className="mb-2 text-xs text-slate-500">{activeTab.guide}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={drafts[activeDetail]}
                    onChange={(event) => setDrafts((current) => ({ ...current, [activeDetail]: event.target.value }))}
                    onKeyDown={onDetailKeyDown}
                    placeholder={activeTab.placeholder}
                    className="profile-input min-h-10 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => addDetailItem(activeDetail)}
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
                  >
                    <Plus className="h-4 w-4" />
                    추가
                  </button>
                </div>

                <div className="mt-3 min-h-10 rounded-md border border-dashed border-slate-200 bg-white p-2">
                  {activeItems.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {activeItems.map((item, index) => (
                        <span key={`${item}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                          <span className="max-w-[280px] truncate">{item}</span>
                          <button type="button" onClick={() => removeDetailItem(activeDetail, index)} className="rounded-full text-slate-400 transition hover:text-rose-500" aria-label={`${item} 삭제`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="px-2 py-2 text-xs text-slate-400">아직 추가한 항목이 없습니다. 한 줄 입력 후 추가를 눌러주세요.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">재직증명서 기재 항목은 증명서 출력 화면에 우선 반영됩니다.</p>
            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="inline-flex w-fit items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중' : '저장'}
            </button>
          </div>

          {message ? <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <span className="text-slate-400">{icon}</span>
        {label}
      </span>
      {children}
    </label>
  );
}
