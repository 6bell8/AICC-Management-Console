import { NextResponse } from 'next/server';

import { requireWriteAccess } from '@/app/lib/auth/permissions';
import { deleteTemplateFile, getPost, getTemplateByPostId, saveTemplateFile } from '@/app/lib/dynnode/store';
import { validateDynnodeTemplateZip } from '@/app/lib/dynnode/templateZip';
import { deleteBucketObject, uploadDynnodeTemplate } from '@/app/lib/storage/railwayBucket';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const templateFile = await getTemplateByPostId(id);
  return NextResponse.json({ templateFile }, { status: 200 });
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;
  const post = await getPost(id);
  if (!post) return NextResponse.json({ message: 'not found' }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: '소스/예시 파일 ZIP을 선택해 주세요.' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  let manifest;
  try {
    manifest = validateDynnodeTemplateZip(bytes, file.name || 'template.zip');
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'ZIP 파일을 확인할 수 없습니다.' }, { status: 400 });
  }

  const previous = await getTemplateByPostId(id);
  const uploaded = await uploadDynnodeTemplate({ postId: id, file });
  const templateFile = await saveTemplateFile({
    postId: id,
    originalName: uploaded.originalFilename,
    storageKey: uploaded.storageKey,
    fileSize: uploaded.fileSize,
    mimeType: uploaded.mimeType,
    manifest,
  });

  if (previous?.storageKey) {
    await deleteBucketObject(previous.storageKey).catch(() => undefined);
  }

  return NextResponse.json({ templateFile }, { status: 201 });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireWriteAccess();
  if (denied) return denied;

  const { id } = await params;
  const removed = await deleteTemplateFile(id);
  if (!removed) return NextResponse.json({ message: '첨부된 소스/예시 파일이 없습니다.' }, { status: 404 });

  await deleteBucketObject(removed.storageKey).catch(() => undefined);
  return NextResponse.json({ ok: true, templateFile: removed }, { status: 200 });
}
