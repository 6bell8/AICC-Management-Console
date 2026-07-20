import { NextResponse } from 'next/server';

import { getCurrentUser } from '@/app/lib/auth/session';
import { getPost, getTemplateByPostId } from '@/app/lib/dynnode/store';
import { getDynnodeTemplateObject } from '@/app/lib/storage/railwayBucket';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const templateFile = await getTemplateByPostId(id);
  if (!templateFile) return NextResponse.json({ message: '첨부된 소스/예시 파일이 없습니다.' }, { status: 404 });

  const object = await getDynnodeTemplateObject(templateFile.storageKey);
  const filename = encodeURIComponent(templateFile.originalName);
  const body = new Blob([object.bytes.slice().buffer as ArrayBuffer], { type: templateFile.mimeType || object.contentType });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': templateFile.mimeType || object.contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
