import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getTripExpenseAttachmentForUser } from '@/app/lib/db/tripExpenses';
import { getTripExpenseAttachmentObject } from '@/app/lib/storage/railwayBucket';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { attachmentId } = await params;
  const attachment = await getTripExpenseAttachmentForUser(user, attachmentId);
  if (!attachment) return NextResponse.json({ message: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });

  const object = await getTripExpenseAttachmentObject(attachment.storageKey);
  const filename = encodeURIComponent(attachment.originalFilename);
  const body = new Blob([object.bytes.slice().buffer as ArrayBuffer], { type: attachment.mimeType || object.contentType });
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType || object.contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
