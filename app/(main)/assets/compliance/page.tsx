'use client';

import { useMemo, useState } from 'react';
import { BookOpenCheck, CalendarClock, Download, ExternalLink, FileText, Landmark, Search, ShieldCheck } from 'lucide-react';

import { Input } from '@/app/components/ui/input';

type ComplianceCategory = 'ALL' | '전자금융' | '개인정보' | '위탁/계약' | '내부통제' | '인사규정';
type ComplianceTone = 'sky' | 'emerald' | 'amber' | 'slate' | 'violet';

const COMPLIANCE_DOCS: Array<{
  id: string;
  title: string;
  category: Exclude<ComplianceCategory, 'ALL'>;
  owner: string;
  reviewCycle: string;
  status: string;
  tone: ComplianceTone;
  note: string;
  revisedAt: string;
  nextReviewAt: string;
}> = [
  {
    id: 'electronic_finance',
    title: '전자금융 운영 기준',
    category: '전자금융',
    owner: '정보보호팀',
    reviewCycle: '반기',
    status: '검토 예정',
    tone: 'amber',
    note: 'AICC 운영망, 접근권한, 로그 보관 기준',
    revisedAt: '2026-06-01',
    nextReviewAt: '2026-12-01',
  },
  {
    id: 'privacy_policy',
    title: '개인정보 처리 기준',
    category: '개인정보',
    owner: 'AICC 운영팀',
    reviewCycle: '분기',
    status: '정상',
    tone: 'emerald',
    note: '상담 이력, 녹취, 고객 식별정보 처리 기준',
    revisedAt: '2026-05-20',
    nextReviewAt: '2026-08-20',
  },
  {
    id: 'outsourcing_checklist',
    title: '위탁 운영 점검표',
    category: '위탁/계약',
    owner: '운영관리팀',
    reviewCycle: '월간',
    status: '진행 중',
    tone: 'sky',
    note: '외주/협력사 운영 점검 및 증빙 문서 관리',
    revisedAt: '2026-06-10',
    nextReviewAt: '2026-07-10',
  },
  {
    id: 'internal_control',
    title: '내부통제 체크리스트',
    category: '내부통제',
    owner: '총괄 관리자',
    reviewCycle: '월간',
    status: '정상',
    tone: 'slate',
    note: '권한 변경, 승인 이력, 다운로드 로그 점검',
    revisedAt: '2026-05-31',
    nextReviewAt: '2026-06-30',
  },
  {
    id: 'hr_policy',
    title: '인사규정',
    category: '인사규정',
    owner: '인사관리팀',
    reviewCycle: '반기',
    status: '정상',
    tone: 'violet',
    note: '근태, 연차, 휴가, 직무 운영 기준',
    revisedAt: '2026-04-15',
    nextReviewAt: '2026-10-15',
  },
  {
    id: 'attendance_policy',
    title: '근태 운영 기준',
    category: '인사규정',
    owner: '인사관리팀',
    reviewCycle: '분기',
    status: '정상',
    tone: 'emerald',
    note: '연차, 반차, 병가, 출장 신청 처리 기준',
    revisedAt: '2026-06-05',
    nextReviewAt: '2026-09-05',
  },
];

const CATEGORIES: Array<{ key: ComplianceCategory; label: string }> = [
  { key: 'ALL', label: '전체' },
  { key: '전자금융', label: '전자금융' },
  { key: '개인정보', label: '개인정보' },
  { key: '위탁/계약', label: '위탁/계약' },
  { key: '내부통제', label: '내부통제' },
  { key: '인사규정', label: '인사규정' },
];

export default function ComplianceAssetsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ComplianceCategory>('ALL');

  const filteredDocs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return COMPLIANCE_DOCS.filter((doc) => {
      const matchesCategory = category === 'ALL' || doc.category === category;
      const matchesQuery =
        !normalized ||
        [doc.title, doc.category, doc.owner, doc.status, doc.note, doc.reviewCycle]
          .join(' ')
          .toLowerCase()
          .includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const normalCount = COMPLIANCE_DOCS.filter((doc) => doc.status === '정상').length;
  const reviewCount = COMPLIANCE_DOCS.length - normalCount;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <Landmark className="h-3.5 w-3.5" />
            Compliance Library
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">법규 / 규정 문서</h1>
          <p className="mt-1 text-sm text-slate-500">AICC 운영에 필요한 규정 문서를 분류하고 검색해서 확인합니다.</p>
        </div>
        <button
          type="button"
          className="soft-interactive inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-45"
          disabled
        >
          <FileText className="h-4 w-4" />
          문서 등록 준비중
        </button>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="전체 문서" value={`${COMPLIANCE_DOCS.length}건`} tone="sky" />
        <SummaryTile label="정상" value={`${normalCount}건`} tone="emerald" />
        <SummaryTile label="검토 필요" value={`${reviewCount}건`} tone="amber" />
        <SummaryTile label="분류" value={`${CATEGORIES.length - 1}개`} tone="slate" />
      </section>

      <section className="soft-panel p-3">
        <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">규정 문서 목록</h2>
            <p className="mt-1 text-xs text-slate-500">문서명, 담당, 상태, 메모 기준으로 검색할 수 있습니다.</p>
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="문서명, 담당, 키워드 검색"
              className="border-slate-200 bg-white pl-9 text-slate-700 shadow-sm transition placeholder:text-slate-400 hover:border-sky-200 focus-visible:border-sky-300 focus-visible:ring-sky-100"
            />
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setCategory(item.key)}
              className={[
                'soft-interactive rounded-full border px-3 py-1 text-xs font-semibold',
                category === item.key ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-500',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2 text-left font-semibold">문서명</th>
                <th className="px-3 py-2 text-left font-semibold">분류</th>
                <th className="px-3 py-2 text-left font-semibold">담당</th>
                <th className="px-3 py-2 text-left font-semibold">개정일</th>
                <th className="px-3 py-2 text-left font-semibold">다음 검토</th>
                <th className="px-3 py-2 text-left font-semibold">상태</th>
                <th className="px-3 py-2 text-left font-semibold">운영 메모</th>
                <th className="px-3 py-2 text-left font-semibold">문서</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                  <td className="px-3 py-3 font-semibold text-slate-900">{doc.title}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full border border-slate-100 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{doc.category}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{doc.owner}</td>
                  <td className="px-3 py-3 text-slate-600">{doc.revisedAt}</td>
                  <td className="px-3 py-3 text-slate-600">{doc.nextReviewAt}</td>
                  <td className="px-3 py-3">
                    <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', toneClass(doc.tone)].join(' ')}>{doc.status}</span>
                  </td>
                  <td className="max-w-[320px] px-3 py-3 text-slate-500">{doc.note}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/assets/compliance/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
                        aria-label={`${doc.title} 보기`}
                        title="보기"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={`/api/assets/compliance/${doc.id}?mode=download`}
                        className="soft-interactive inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
                        aria-label={`${doc.title} 다운로드`}
                        title="다운로드"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredDocs.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500" colSpan={8}>
                    검색 조건에 맞는 문서가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: ComplianceTone }) {
  const icon = {
    sky: <Landmark className="h-4 w-4" />,
    emerald: <ShieldCheck className="h-4 w-4" />,
    amber: <CalendarClock className="h-4 w-4" />,
    slate: <BookOpenCheck className="h-4 w-4" />,
    violet: <BookOpenCheck className="h-4 w-4" />,
  }[tone];

  return (
    <div className={['soft-interactive rounded-lg border p-3', toneClass(tone)].join(' ')}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold">{label}</div>
        <span className="opacity-80">{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function toneClass(tone: ComplianceTone) {
  const tones: Record<ComplianceTone, string> = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
  };
  return tones[tone];
}
