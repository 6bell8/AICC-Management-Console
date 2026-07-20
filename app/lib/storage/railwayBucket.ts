import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for Railway bucket upload`);
  return value;
}

function getBucketClient() {
  return new S3Client({
    region: process.env.RAILWAY_BUCKET_REGION || 'auto',
    endpoint: requiredEnv('RAILWAY_BUCKET_ENDPOINT'),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requiredEnv('RAILWAY_BUCKET_ACCESS_KEY'),
      secretAccessKey: requiredEnv('RAILWAY_BUCKET_SECRET_KEY'),
    },
  });
}

function sanitizeFilename(name: string) {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

export async function uploadTripExpenseAttachment(input: {
  tripExpenseRequestId: string;
  file: File;
  keyPrefix?: string;
}) {
  const bucket = requiredEnv('RAILWAY_BUCKET_NAME');
  const safeName = sanitizeFilename(input.file.name || 'attachment');
  const key = `${input.keyPrefix ?? 'trip-expenses'}/${input.tripExpenseRequestId}/${crypto.randomUUID()}-${safeName}`;
  const body = Buffer.from(await input.file.arrayBuffer());

  await getBucketClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: input.file.type || 'application/octet-stream',
    }),
  );

  return {
    storageProvider: 'RAILWAY_BUCKET' as const,
    storageKey: key,
    originalFilename: input.file.name || safeName,
    mimeType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
  };
}

export async function uploadDynnodeTemplate(input: {
  postId: string;
  file: File;
  keyPrefix?: string;
}) {
  const bucket = requiredEnv('RAILWAY_BUCKET_NAME');
  const safeName = sanitizeFilename(input.file.name || 'template.zip');
  const key = `${input.keyPrefix ?? 'dynnode-templates'}/${input.postId}/${crypto.randomUUID()}-${safeName}`;
  const body = Buffer.from(await input.file.arrayBuffer());

  await getBucketClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: input.file.type || 'application/zip',
    }),
  );

  return {
    storageProvider: 'RAILWAY_BUCKET' as const,
    storageKey: key,
    originalFilename: input.file.name || safeName,
    mimeType: input.file.type || 'application/zip',
    fileSize: input.file.size,
  };
}

export async function getTripExpenseAttachmentObject(storageKey: string) {
  const bucket = requiredEnv('RAILWAY_BUCKET_NAME');
  const response = await getBucketClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );

  if (!response.Body) throw new Error('첨부파일을 불러오지 못했습니다.');
  const bytes = await response.Body.transformToByteArray();
  return {
    bytes,
    contentType: response.ContentType || 'application/octet-stream',
  };
}

export async function getDynnodeTemplateObject(storageKey: string) {
  const bucket = requiredEnv('RAILWAY_BUCKET_NAME');
  const response = await getBucketClient().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );

  if (!response.Body) throw new Error('template file body is empty');
  const bytes = await response.Body.transformToByteArray();
  return {
    bytes,
    contentType: response.ContentType || 'application/zip',
  };
}

export async function deleteBucketObject(storageKey: string) {
  const bucket = requiredEnv('RAILWAY_BUCKET_NAME');
  await getBucketClient().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );
}
