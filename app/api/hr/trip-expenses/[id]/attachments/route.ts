import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { addTripExpenseAttachment } from '@/app/lib/db/tripExpenses';
import { uploadTripExpenseAttachment } from '@/app/lib/storage/railwayBucket';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 5;

function isAllowedFile(file: File) {
  return file.type.startsWith('image/') || file.type === 'application/pdf';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (user.role === 'VIEWER') return NextResponse.json({ message: '게스트 권한은 첨부파일을 등록할 수 없습니다.' }, { status: 403 });

  const { id } = await params;
  const formData = await req.formData();
  const files = formData.getAll('files').filter((value): value is File => value instanceof File);

  if (files.length === 0) return NextResponse.json({ message: '첨부파일을 선택해 주세요.' }, { status: 400 });
  if (files.length > MAX_FILE_COUNT) return NextResponse.json({ message: `첨부파일은 최대 ${MAX_FILE_COUNT}개까지 등록할 수 있습니다.` }, { status: 400 });

  try {
    const uploaded = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) return NextResponse.json({ message: '첨부파일은 10MB 이하만 등록할 수 있습니다.' }, { status: 400 });
      if (!isAllowedFile(file)) return NextResponse.json({ message: '이미지 또는 PDF만 업로드할 수 있습니다.' }, { status: 400 });

      const meta = await uploadTripExpenseAttachment({ tripExpenseRequestId: id, file });
      const attachmentId = await addTripExpenseAttachment({ user, tripExpenseRequestId: id, ...meta });
      uploaded.push({ id: attachmentId, ...meta });
    }

    return NextResponse.json({ items: uploaded }, { status: 201 });
  } catch (error) {
    console.error('[trip-expense-attachments] upload failed', error);
    const message = error instanceof Error ? error.message : '증빙 자료를 업로드하지 못했습니다.';
    return NextResponse.json({ message }, { status: 500 });
  }
}
