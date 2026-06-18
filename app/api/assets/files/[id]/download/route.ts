import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { recordOperationalAssetDownload } from '@/app/lib/db/operationalAssets';

export const runtime = 'nodejs';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '조회 권한 계정은 파일을 다운로드할 수 없습니다.' }, { status: 403 });

  const { id } = await context.params;
  const file = await recordOperationalAssetDownload({
    user,
    fileId: id,
    ipAddress: req.headers.get('x-forwarded-for'),
    userAgent: req.headers.get('user-agent'),
  });
  if (!file) return NextResponse.json({ message: '파일을 찾을 수 없습니다.' }, { status: 404 });

  const body = [
    'AICC Operational Asset File',
    `Asset: ${file.assetName}`,
    `File: ${file.originalName}`,
    `Type: ${file.fileType}`,
    '',
    'This demo download records access logs in MySQL.',
    'Connect storageKey to Railway Bucket, S3, or Vercel Blob for the actual binary file.',
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName.replace(/\.[^.]+$/, ''))}-download-log.txt"`,
    },
  });
}
