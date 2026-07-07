import { Archive, ChevronRight, Download, FileCheck2, KeyRound, Search, ShieldCheck, Upload } from 'lucide-react';
import { redirect } from 'next/navigation';

import { RichSelect } from '@/app/components/ui/select';
import { getCurrentUser } from '@/app/lib/auth/session';
import {
  listOperationalAssetAccessLogs,
  listOperationalAssets,
  type OperationalAssetStatus,
  type OperationalAssetType,
} from '@/app/lib/db/operationalAssets';

const STATUS_LABEL: Record<OperationalAssetStatus, string> = {
  ACTIVE: '정상',
  EXPIRING_SOON: '만료 예정',
  EXPIRED: '만료',
  REVIEW: '검토 중',
};

const TYPE_LABEL: Record<OperationalAssetType, string> = {
  LICENSE: '라이선스',
  CONTRACT: '계약서',
  CERTIFICATE: '인증서',
  SECURITY_DOC: '보안문서',
  ETC: '기타',
};

const ACTION_LABEL: Record<string, string> = {
  DOWNLOAD: '다운로드',
  UPLOAD: '업로드',
  VIEW: '열람',
  DELETE: '삭제',
};

const TYPE_OPTIONS: Array<'ALL' | OperationalAssetType> = ['ALL', 'LICENSE', 'CONTRACT', 'CERTIFICATE', 'SECURITY_DOC', 'ETC'];
const STATUS_OPTIONS: Array<'ALL' | OperationalAssetStatus> = ['ALL', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'REVIEW'];

export const dynamic = 'force-dynamic';

export default async function LicenseAssetsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/assets/licenses');

  const params = (await searchParams) ?? {};
  const query = getParam(params.q).trim();
  const selectedType = normalizeType(getParam(params.type));
  const selectedStatus = normalizeStatus(getParam(params.status));

  const [assets, accessLogs] = await Promise.all([listOperationalAssets(), listOperationalAssetAccessLogs()]);
  const filteredAssets = assets.filter((asset) => {
    const haystack = [
      asset.name,
      asset.vendor,
      asset.ownerName,
      asset.teamName,
      asset.memo,
      TYPE_LABEL[asset.type],
      STATUS_LABEL[asset.status],
      ...asset.files.flatMap((file) => [file.originalName, file.fileType, file.uploadedByName]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesType = selectedType === 'ALL' || asset.type === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || asset.status === selectedStatus;
    return matchesQuery && matchesType && matchesStatus;
  });

  const canDownload = user.role !== 'VIEWER';

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
            <KeyRound className="h-3.5 w-3.5" />
            Operational Assets
          </div>
          <h1 className="mt-3 text-xl font-semibold text-slate-950">라이선스 파일</h1>
          <p className="mt-1 text-sm text-slate-500">운영 자산과 라이선스 증빙 파일을 권한과 이력 기준으로 관리합니다.</p>
        </div>
        <button
          type="button"
          className="soft-interactive inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:pointer-events-none disabled:opacity-45"
          disabled
        >
          <Upload className="h-4 w-4" />
          파일 등록 준비중
        </button>
      </div>

      <details className="group soft-panel overflow-hidden p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50/70 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-white">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-950">운영 기준</span>
              <span className="block truncate text-xs text-slate-500">권한 정책, 최근 파일 접근, 관리 기준을 한 번에 확인합니다.</span>
            </span>
          </span>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition group-open:rotate-90 group-open:border-sky-100 group-open:bg-sky-50 group-open:text-sky-700">
            <ChevronRight className="h-4 w-4" />
          </span>
        </summary>
        <div className="grid gap-3 border-t border-slate-100 p-4 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-950">권한 정책</h2>
            </div>
            <div className="mt-3 space-y-2">
              <PolicyRow label="총괄 관리자 / 관리자" value="등록, 수정, 파일 관리" />
              <PolicyRow label="운영 담당자" value="조회, 다운로드" />
              <PolicyRow label="조회 사용자" value="민감정보 제외 조회" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-950">최근 파일 접근</h2>
            </div>
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {accessLogs.length > 0 ? (
                accessLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{ACTION_LABEL[log.action] ?? log.action}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="mt-2 truncate font-semibold text-slate-800">{log.fileName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">
                      {log.actorName} · {log.assetName}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">아직 파일 접근 이력이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 bg-white p-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-950">관리 기준</h2>
            </div>
            <div className="mt-3 space-y-2">
              {['파일 원본은 스토리지, 메타데이터는 MySQL 관리', '다운로드는 API를 거쳐 권한 확인 후 기록', '중요 이벤트는 시스템 관리 감사 로그에도 기록'].map((text) => (
                <div key={text} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm text-slate-600">
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <section>
        <div className="soft-panel p-3">
          <div className="mb-3 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">운영 자산 목록</h2>
                <p className="mt-1 text-xs text-slate-500">자산명, 공급사, 담당자, 파일명 기준으로 검색하고 분류별로 확인합니다.</p>
              </div>
              <span className="w-fit rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                {filteredAssets.length} / {assets.length}건
              </span>
            </div>

            <form className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_160px_150px_auto_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="자산명, 공급사, 담당자, 파일명 검색"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-200 focus:ring-2 focus:ring-sky-100"
                />
              </label>
              <RichSelect
                name="type"
                value={selectedType}
                onChange={() => undefined}
                options={TYPE_OPTIONS.map((type) => ({ value: type, label: type === 'ALL' ? '카테고리 전체' : TYPE_LABEL[type] }))}
                buttonClassName="min-h-10 rounded-lg border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-sky-200 focus:ring-sky-100"
              />
              <RichSelect
                name="status"
                value={selectedStatus}
                onChange={() => undefined}
                options={STATUS_OPTIONS.map((status) => ({ value: status, label: status === 'ALL' ? '상태 전체' : STATUS_LABEL[status] }))}
                buttonClassName="min-h-10 rounded-lg border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-sky-200 focus:ring-sky-100"
              />
              <button type="submit" className="soft-interactive h-10 rounded-lg border border-sky-100 bg-sky-50 px-4 text-sm font-semibold text-sky-700 hover:bg-sky-100">
                검색
              </button>
              <a href="/assets/licenses" className="soft-interactive inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                초기화
              </a>
            </form>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[1080px] table-fixed text-sm">
              <colgroup>
                <col className="w-[32%]" />
                <col className="w-[20%]" />
                <col className="w-[18%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-left font-semibold">운영 자산</th>
                  <th className="px-4 py-2.5 text-left font-semibold">공급 / 담당</th>
                  <th className="px-4 py-2.5 text-left font-semibold">계약 기간</th>
                  <th className="px-4 py-2.5 text-left font-semibold">첨부 파일</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 text-sky-700">
                          <FileCheck2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate font-semibold text-slate-950">{asset.name}</div>
                            <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{TYPE_LABEL[asset.type]}</span>
                            <span className={['rounded-full border px-2 py-0.5 text-[11px] font-semibold', statusTone(asset.status)].join(' ')}>
                              {STATUS_LABEL[asset.status]}
                            </span>
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{asset.memo ?? '운영 자산'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <InfoStack label="공급사" value={asset.vendor} />
                        <InfoStack label="담당" value={asset.ownerName ?? asset.teamName ?? '운영 담당'} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <InfoStack label="시작일" value={asset.startsAt ?? '-'} />
                        <InfoStack label="만료일" value={asset.expiresAt ?? '-'} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        {asset.files.length > 0 ? (
                          asset.files.map((file) => (
                            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm shadow-slate-100/60">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-slate-800">{file.originalName}</div>
                                <div className="mt-0.5 text-[11px] text-slate-400">
                                  {file.fileType} · {formatBytes(file.fileSize)}
                                </div>
                              </div>
                              {canDownload ? (
                                <a
                                  href={`/api/assets/files/${file.id}/download`}
                                  className="soft-interactive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-sky-100 hover:bg-sky-50 hover:text-sky-700"
                                  aria-label={`${file.originalName} 다운로드`}
                                  title="다운로드"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-400">제한</span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center text-xs text-slate-500">등록된 파일이 없습니다.</div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">
                      검색 조건에 맞는 운영 자산이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function getParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function normalizeType(value: string): 'ALL' | OperationalAssetType {
  return TYPE_OPTIONS.includes(value as 'ALL' | OperationalAssetType) ? (value as 'ALL' | OperationalAssetType) : 'ALL';
}

function normalizeStatus(value: string): 'ALL' | OperationalAssetStatus {
  return STATUS_OPTIONS.includes(value as 'ALL' | OperationalAssetStatus) ? (value as 'ALL' | OperationalAssetStatus) : 'ALL';
}

function InfoStack({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-right text-xs font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function statusTone(status: OperationalAssetStatus) {
  const tones: Record<OperationalAssetStatus, string> = {
    ACTIVE: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    EXPIRING_SOON: 'border-amber-100 bg-amber-50 text-amber-800',
    EXPIRED: 'border-slate-200 bg-slate-50 text-slate-600',
    REVIEW: 'border-sky-100 bg-sky-50 text-sky-700',
  };
  return tones[status];
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
