'use client';

import { useMemo, useState } from 'react';
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Download, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { deleteBusinessLine, getBusinessLines, saveBusinessLine } from '@/app/lib/api/businessLines';
import type { BusinessLine, BusinessLineServiceType, BusinessLineStatus } from '@/app/lib/types/businessLine';
import { BUSINESS_LINE_SERVICE_TYPES, BUSINESS_LINE_STATUSES } from '@/app/lib/types/businessLine';
import type { AuthUser } from '@/app/lib/db/users';

const STATUS_LABEL: Record<BusinessLineStatus, string> = {
  DONE: '완료',
  CANCELLED: '취소',
  PENDING: '대기',
};

const emptyLine = (): BusinessLine => ({
  id: `line_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
  jiraKey: '',
  lineNumber: '',
  serviceType: 'STG',
  botName: '',
  botCode: '',
  requester: '',
  requestedAt: new Date().toISOString().slice(0, 10),
  endedAt: null,
  regiStatus: 'PENDING',
  memo: '',
});

function statusClass(status: BusinessLineStatus) {
  if (status === 'DONE') return 'bg-sky-50 text-sky-700 ring-1 ring-sky-200';
  if (status === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

export default function BusinessLinesClient() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [qText, setQText] = useState('');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState<BusinessLine | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['business-lines', page, qText, status, from, to],
    queryFn: () => getBusinessLines({ page, pageSize: 10, q: qText, status, from, to }),
  });

  const meQuery = useQuery<{ user: AuthUser | null }>({
    queryKey: ['auth-me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) return { user: null };
      return res.json();
    },
  });

  const rows = query.data?.items ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const canWrite = meQuery.data?.user ? meQuery.data.user.role !== 'VIEWER' : false;
  const metric = useMemo(
    () => ({
      total: query.data?.total ?? 0,
      done: rows.filter((row) => row.regiStatus === 'DONE').length,
      cancelled: rows.filter((row) => row.regiStatus === 'CANCELLED').length,
    }),
    [query.data?.total, rows],
  );

  async function saveCurrent() {
    if (!editing) return;
    if (!canWrite) {
      setMessage('게스트/VIEWER 권한은 사업용 회선 정보를 수정할 수 없습니다.');
      return;
    }

    setMessage(null);
    setPending(true);
    try {
      await saveBusinessLine(editing);
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ['business-lines'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사업용 회선 정보를 저장하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  async function removeLine(id: string) {
    if (!canWrite) {
      setMessage('게스트/VIEWER 권한은 사업용 회선 정보를 삭제할 수 없습니다.');
      return;
    }
    if (!confirm('이 회선 정보를 삭제하시겠습니까?')) return;

    setMessage(null);
    setPending(true);
    try {
      await deleteBusinessLine(id);
      await qc.invalidateQueries({ queryKey: ['business-lines'] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '사업용 회선 정보를 삭제하지 못했습니다.');
    } finally {
      setPending(false);
    }
  }

  function downloadCsv() {
    const header = ['JIRA', '회선번호', '사용서버', '봇명', '봇코드', '신청자', '요청일', '종료일', 'REGI상태', '메모'];
    const lines = rows.map((row) => [
      row.jiraKey,
      row.lineNumber,
      row.serviceType,
      row.botName,
      row.botCode,
      row.requester,
      row.requestedAt,
      row.endedAt,
      STATUS_LABEL[row.regiStatus],
      row.memo,
    ]);
    const csv = [header, ...lines].map((line) => line.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'business-lines.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-800" />
            <h1 className="text-xl font-semibold">사업용 회선 관리</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">사업용 전화 회선, 봇코드, 신청 이력과 REGI 상태를 관리합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setEditing(emptyLine())} disabled={!canWrite}>
            <Plus className="mr-2 h-4 w-4" />
            등록
          </Button>
          <Button type="button" variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            CSV 다운로드
          </Button>
        </div>
      </div>

      {!canWrite && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          게스트/VIEWER 권한은 조회만 가능합니다. 등록, 수정, 삭제는 HEAD/ADMIN/OPERATOR 계정으로 로그인해 주세요.
        </div>
      )}

      {message && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {message}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Metric label="검색 결과" value={metric.total} />
        <Metric label="현재 페이지 완료" value={metric.done} tone="dark" />
        <Metric label="현재 페이지 취소" value={metric.cancelled} tone="muted" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <span className="text-slate-400">~</span>
        <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
          <option value="ALL">전체</option>
          {BUSINESS_LINE_STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
        </select>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={qText}
            onChange={(e) => { setPage(1); setQText(e.target.value); }}
            placeholder="검색 키워드를 입력해주세요."
            className="h-10 w-full rounded-md border border-slate-200 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1660px] table-fixed text-sm">
            <colgroup>
              <col className="w-[64px]" />
              <col className="w-[132px]" />
              <col className="w-[148px]" />
              <col className="w-[100px]" />
              <col className="w-[360px]" />
              <col className="w-[180px]" />
              <col className="w-[110px]" />
              <col className="w-[116px]" />
              <col className="w-[116px]" />
              <col className="w-[116px]" />
              <col className="w-[260px]" />
              <col className="w-[110px]" />
            </colgroup>
            <thead className="bg-slate-700 text-white">
              <tr>
                {['NO', 'JIRA', '회선번호', '사용서버', '봇명', '봇코드', '신청자', '요청일', '종료일', 'REGI상태', '메모', '관리'].map((head) => (
                  <th key={head} className="px-4 py-3 text-left font-medium">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {query.isLoading ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">불러오는 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">등록된 회선이 없습니다.</td></tr>
              ) : rows.map((row, index) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">{(page - 1) * 10 + index + 1}</td>
                  <td className="truncate px-4 py-3">{row.jiraKey || '-'}</td>
                  <td className="truncate px-4 py-3 font-medium">{row.lineNumber}</td>
                  <td className="px-4 py-3">{row.serviceType}</td>
                  <td className="truncate px-4 py-3" title={row.botName}>{row.botName}</td>
                  <td className="truncate px-4 py-3" title={row.botCode}>{row.botCode}</td>
                  <td className="truncate px-4 py-3">{row.requester}</td>
                  <td className="px-4 py-3">{row.requestedAt}</td>
                  <td className="px-4 py-3">{row.endedAt || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={['inline-flex min-w-16 justify-center rounded-md px-3 py-1 text-xs font-semibold', statusClass(row.regiStatus)].join(' ')}>
                      {STATUS_LABEL[row.regiStatus]}
                    </span>
                  </td>
                  <td className="truncate px-4 py-3" title={row.memo || ''}>{row.memo || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button type="button" disabled={!canWrite} className="text-xs font-medium text-slate-800 hover:text-slate-950 disabled:text-slate-300" onClick={() => setEditing(row)}>수정</button>
                      <button type="button" disabled={!canWrite} className="text-xs text-slate-500 hover:text-slate-800 disabled:text-slate-300" onClick={() => removeLine(row.id)}><Trash2 className="inline h-3 w-3" /> 삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button type="button" disabled={page <= 1} onClick={() => setPage(1)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300">First</button>
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300">{'<'}</button>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm">{page}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300">{'>'}</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="h-10 rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300">Last</button>
      </div>

      {editing && (
        <BusinessLineModal
          line={editing}
          pending={pending}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveCurrent}
        />
      )}
    </div>
  );
}

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'dark' | 'muted' }) {
  const valueClass = tone === 'dark' ? 'text-slate-900' : tone === 'muted' ? 'text-slate-600' : 'text-slate-800';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={['mt-1 text-2xl font-semibold', valueClass].join(' ')}>{value}</div>
    </div>
  );
}

function BusinessLineModal({
  line,
  pending,
  onChange,
  onClose,
  onSave,
}: {
  line: BusinessLine;
  pending: boolean;
  onChange: (line: BusinessLine) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-base font-semibold">사업용 회선 등록/수정</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="JIRA"><input value={line.jiraKey ?? ''} onChange={(e) => onChange({ ...line, jiraKey: e.target.value })} /></Field>
          <Field label="회선번호"><input value={line.lineNumber} onChange={(e) => onChange({ ...line, lineNumber: e.target.value })} /></Field>
          <Field label="사용서버">
            <select value={line.serviceType} onChange={(e) => onChange({ ...line, serviceType: e.target.value as BusinessLineServiceType })}>
              {BUSINESS_LINE_SERVICE_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="REGI상태">
            <select value={line.regiStatus} onChange={(e) => onChange({ ...line, regiStatus: e.target.value as BusinessLineStatus })}>
              {BUSINESS_LINE_STATUSES.map((item) => <option key={item} value={item}>{STATUS_LABEL[item]}</option>)}
            </select>
          </Field>
          <Field label="봇명"><input value={line.botName} onChange={(e) => onChange({ ...line, botName: e.target.value })} /></Field>
          <Field label="봇코드"><input value={line.botCode} onChange={(e) => onChange({ ...line, botCode: e.target.value })} /></Field>
          <Field label="신청자"><input value={line.requester} onChange={(e) => onChange({ ...line, requester: e.target.value })} /></Field>
          <Field label="요청일"><input type="date" value={line.requestedAt} onChange={(e) => onChange({ ...line, requestedAt: e.target.value })} /></Field>
          <Field label="종료일"><input type="date" value={line.endedAt ?? ''} onChange={(e) => onChange({ ...line, endedAt: e.target.value || null })} /></Field>
          <Field label="메모"><input value={line.memo ?? ''} onChange={(e) => onChange({ ...line, memo: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>닫기</Button>
          <Button onClick={onSave} disabled={pending}>{pending ? '저장 중...' : '저장'}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactElement<{ className?: string }> }) {
  return (
    <label className="space-y-1 text-sm">
      <div className="text-xs text-slate-500">{label}</div>
      {React.cloneElement(children, {
        className: 'h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400',
      })}
    </label>
  );
}
