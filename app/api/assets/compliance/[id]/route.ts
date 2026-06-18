import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { createSecurityAuditLog } from '@/app/lib/db/securityAudit';

export const runtime = 'nodejs';

const DOCUMENTS: Record<string, { title: string; category: string; filename: string }> = {
  electronic_finance: {
    title: '전자금융 운영 기준',
    category: '전자금융',
    filename: 'electronic-finance-operation-standard.pdf',
  },
  privacy_policy: {
    title: '개인정보 처리 기준',
    category: '개인정보',
    filename: 'privacy-processing-standard.pdf',
  },
  outsourcing_checklist: {
    title: '위탁 운영 점검표',
    category: '위탁/계약',
    filename: 'outsourcing-operation-checklist.pdf',
  },
  internal_control: {
    title: '내부통제 체크리스트',
    category: '내부통제',
    filename: 'internal-control-checklist.pdf',
  },
  hr_policy: {
    title: '인사규정',
    category: '인사규정',
    filename: 'hr-policy.pdf',
  },
  attendance_policy: {
    title: '근태 운영 기준',
    category: '인사규정',
    filename: 'attendance-operation-standard.pdf',
  },
};

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const document = DOCUMENTS[id];
  if (!document) return NextResponse.json({ message: '문서를 찾을 수 없습니다.' }, { status: 404 });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') === 'download' ? 'download' : 'view';
  if (mode === 'download') {
    await createSecurityAuditLog({
      actorId: user.id,
      targetUserId: null,
      action: 'COMPLIANCE_DOCUMENT_DOWNLOADED',
      details: {
        documentId: id,
        title: document.title,
        category: document.category,
        filename: document.filename,
      },
    });
  }

  const body = [
    document.title,
    '',
    `분류: ${document.category}`,
    '문서 유형: PDF 규정 문서',
    '',
    '현재 응답은 PDF 스토리지 연결 전의 데모 문서입니다.',
    '실제 운영에서는 Railway Bucket, S3, Vercel Blob 등에 저장된 PDF를 권한 확인 후 스트리밍합니다.',
  ].join('\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `${mode === 'download' ? 'attachment' : 'inline'}; filename="${document.filename.replace(/\.pdf$/, '.txt')}"`,
    },
  });
}
