'use client';

import * as React from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import DashboardCharts from './DashboardCharts';
import { Badge } from '../../components/ui/badge'; // 경로는 프로젝트에 맞게 조정
import { getCampaigns } from '../../lib/api/campaigns'; //

type Campaign = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DONE' | string;
  updatedAt: string; // ISO 예상
};

function statusLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return '초안';
    case 'RUNNING':
      return '운영중';
    case 'PAUSED':
      return '중지';
    case 'ARCHIVED':
      return '보관';
    default:
      return status;
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    case 'RUNNING':
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    case 'PAUSED':
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'ARCHIVED':
      return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
    default:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
  }
}

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysDiff(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await getCampaigns();
        // ✅ res가 {items: []} 이든 [] 이든 대응
        const list = ((res as any)?.items ?? res ?? []) as Campaign[];

        if (mounted) setItems(list);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? '대시보드 데이터를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const kpi = useMemo(() => {
    const total = items.length;
    const draft = items.filter((c) => c.status === 'DRAFT').length;
    const running = items.filter((c) => c.status === 'RUNNING').length;
    const paused = items.filter((c) => c.status === 'PAUSED').length;
    const archived = items.filter((c) => c.status === 'ARCHIVED').length;

    const now = new Date();
    const updated7d = items.filter((c) => daysDiff(new Date(c.updatedAt), now) <= 7).length;

    return { total, draft, running, paused, archived, updated7d };
  }, [items]);

  const trend7d = useMemo(() => {
    const now = new Date();
    const keys = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      return toDateKey(d);
    });

    const bucket: Record<string, number> = {};
    keys.forEach((k) => (bucket[k] = 0));

    items.forEach((c) => {
      const key = toDateKey(new Date(c.updatedAt));
      if (key in bucket) bucket[key] += 1;
    });

    return keys.map((k) => ({ label: k.slice(5), value: bucket[k] }));
  }, [items]);

  const statusDist = useMemo(() => {
    return [
      { label: '초안', value: kpi.draft },
      { label: '운영중', value: kpi.running },
      { label: '중지', value: kpi.paused },
      { label: '보관', value: kpi.archived },
    ];
  }, [kpi]);

  const recent = useMemo(() => {
    return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10);
  }, [items]);

  return (
    <div className="space-y-6 mt-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">대시보드</h1>
          <p className="mt-1 text-sm text-slate-600">요약 지표와 최근 변경 사항을 빠르게 확인합니다.</p>
        </div>

        <div className="flex gap-2">
          <Link href="/campaigns" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
            캠페인으로 이동
          </Link>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</div> : null}

      {/* KPI */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">전체</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '—' : kpi.total}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">진행중</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '—' : kpi.running}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">일시정지</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '—' : kpi.paused}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">종료</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '—' : kpi.archived}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-600">최근 7일 업데이트</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '—' : kpi.updated7d}</div>
        </div>
      </section>

      {/* 차트 2개 활성화 ✅ */}
      <DashboardCharts trend={trend7d} statusDist={statusDist} />

      {/* 최근 변경 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">최근 변경 캠페인</h2>
          <Link href="/campaigns" className="text-sm text-slate-600 hover:underline">
            전체 보기
          </Link>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr className="border-b">
                <th className="py-2 pr-3">이름</th>
                <th className="py-2 pr-3">상태</th>
                <th className="py-2 pr-3">업데이트</th>
                <th className="py-2 pr-3">ID</th>
              </tr>
            </thead>

            <tbody>
              {!loading && recent.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-slate-500">
                    캠페인이 없습니다.
                  </td>
                </tr>
              ) : null}

              {recent.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    <Link href={`/campaigns/${encodeURIComponent(r.id)}`} className="font-medium text-slate-900 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Badge className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</Badge>
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{new Date(r.updatedAt).toLocaleString()}</td>
                  <td className="py-2 pr-3 text-slate-500">{r.id}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading ? <div className="py-6 text-center text-sm text-slate-500">불러오는 중…</div> : null}
        </div>
      </section>
    </div>
  );
}
