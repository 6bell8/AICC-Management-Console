import { Archive, CalendarClock, Download, FileCheck2, KeyRound, ShieldCheck, Upload } from 'lucide-react';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/app/lib/auth/session';
import { listOperationalAssetAccessLogs, listOperationalAssets, type OperationalAssetStatus } from '@/app/lib/db/operationalAssets';

const STATUS_LABEL: Record<OperationalAssetStatus, string> = {
  ACTIVE: '정상',
  EXPIRING_SOON: '만료 예정',
  EXPIRED: '만료',
  REVIEW: '검토 중',
};

const ACTION_LABEL: Record<string, string> = {
  DOWNLOAD: '다운로드',
  UPLOAD: '업로드',
  VIEW: '열람',
  DELETE: '삭제',
};

export const dynamic = 'force-dynamic';

export default async function LicenseAssetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/assets/licenses');

  const [assets, accessLogs] = await Promise.all([listOperationalAssets(), listOperationalAssetAccessLogs()]);
  const files = assets.flatMap((asset) => asset.files);
  const expiringCount = assets.filter((asset) => asset.status === 'EXPIRING_SOON').length;
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

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="운영 자산" value={`${assets.length}건`} tone="sky" />
        <SummaryTile label="첨부 파일" value={`${files.length}건`} tone="emerald" />
        <SummaryTile label="만료 예정" value={`${expiringCount}건`} tone="amber" />
        <SummaryTile label="접근 로그" value={`${accessLogs.length}건`} tone="slate" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="soft-panel p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">운영 자산 목록</h2>
              <p className="mt-1 text-xs text-slate-500">파일은 다운로드 API를 통해서만 접근하고, 접근 이력은 감사 로그에 남깁니다.</p>
            </div>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">MySQL 연동</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-100">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-3 py-2 text-left font-semibold">제품/자산</th>
                  <th className="px-3 py-2 text-left font-semibold">공급사</th>
                  <th className="px-3 py-2 text-left font-semibold">만료일</th>
                  <th className="px-3 py-2 text-left font-semibold">담당</th>
                  <th className="px-3 py-2 text-left font-semibold">상태</th>
                  <th className="px-3 py-2 text-left font-semibold">첨부 파일</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-slate-100 align-top last:border-b-0 hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{asset.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{asset.memo ?? '운영 자산'}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{asset.vendor}</td>
                    <td className="px-3 py-3 text-slate-600">{asset.expiresAt ?? '-'}</td>
                    <td className="px-3 py-3 text-slate-600">{asset.ownerName ?? asset.teamName ?? '운영 담당'}</td>
                    <td className="px-3 py-3">
                      <span className={['inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', statusTone(asset.status)].join(' ')}>{STATUS_LABEL[asset.status]}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-2">
                        {asset.files.map((file) => (
                          <div key={file.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-semibold text-slate-800">{file.originalName}</div>
                              <div className="mt-0.5 text-[11px] text-slate-400">{file.fileType} · {formatBytes(file.fileSize)}</div>
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
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="soft-panel p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-950">권한 정책</h2>
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <PolicyRow label="총괄 관리자 / 관리자" value="등록, 수정, 파일 관리" />
              <PolicyRow label="운영 담당자" value="조회, 다운로드" />
              <PolicyRow label="조회 사용자" value="민감정보 제외 조회" />
            </div>
          </div>

          <div className="soft-panel p-4">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-950">최근 파일 접근</h2>
            </div>
            <div className="mt-3 space-y-2">
              {accessLogs.length > 0 ? (
                accessLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{ACTION_LABEL[log.action] ?? log.action}</span>
                      <span className="text-[11px] text-slate-400">{formatDate(log.createdAt)}</span>
                    </div>
                    <div className="mt-2 truncate font-semibold text-slate-800">{log.fileName}</div>
                    <div className="mt-0.5 truncate text-xs text-slate-500">{log.actorName} · {log.assetName}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">아직 파일 접근 이력이 없습니다.</div>
              )}
            </div>
          </div>

          <div className="soft-panel p-4">
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
        </aside>
      </section>
    </div>
  );
}

function SummaryTile({ label, value, tone }: { label: string; value: string; tone: 'sky' | 'emerald' | 'amber' | 'slate' }) {
  const icon = {
    sky: <FileCheck2 className="h-4 w-4" />,
    emerald: <ShieldCheck className="h-4 w-4" />,
    amber: <CalendarClock className="h-4 w-4" />,
    slate: <Archive className="h-4 w-4" />,
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

function toneClass(tone: string) {
  const tones: Record<string, string> = {
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return tones[tone] ?? tones.slate;
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
