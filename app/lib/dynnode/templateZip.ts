import type { DynNodeTemplateFile } from '../types/dynnode';

const MAX_TEMPLATE_SIZE = 30 * 1024 * 1024;
const MAX_UNCOMPRESSED_SIZE = 80 * 1024 * 1024;
const MAX_FILE_COUNT = 300;
const FORBIDDEN_EXTENSIONS = new Set(['.bat', '.cmd', '.com', '.dll', '.exe', '.msi', '.ps1', '.scr', '.sh']);

export type ZipManifest = DynNodeTemplateFile['manifest'];

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

function getExtension(path: string) {
  const last = path.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot >= 0 ? last.slice(dot).toLowerCase() : '';
}

function isUnsafePath(path: string) {
  const normalized = normalizeZipPath(path);
  if (!normalized || normalized.startsWith('../') || normalized.includes('/../')) return true;
  if (/^[a-zA-Z]:\//.test(normalized)) return true;
  return false;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === 0x06054b50) return offset;
  }
  return -1;
}

export function validateDynnodeTemplateZip(buffer: Buffer, filename: string): ZipManifest {
  if (!filename.toLowerCase().endsWith('.zip')) throw new Error('ZIP 파일만 업로드할 수 있습니다.');
  if (buffer.length === 0) throw new Error('빈 ZIP 파일은 업로드할 수 없습니다.');
  if (buffer.length > MAX_TEMPLATE_SIZE) throw new Error('템플릿 ZIP은 30MB 이하만 업로드할 수 있습니다.');

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error('ZIP 파일 구조를 확인할 수 없습니다.');

  const entryCount = readUInt16(buffer, eocdOffset + 10);
  const centralDirectorySize = readUInt32(buffer, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(buffer, eocdOffset + 16);
  if (entryCount <= 0) throw new Error('ZIP 안에 파일이 없습니다.');
  if (entryCount > MAX_FILE_COUNT) throw new Error(`ZIP 내부 파일은 최대 ${MAX_FILE_COUNT}개까지 허용됩니다.`);
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) throw new Error('ZIP 중앙 디렉터리가 손상되었습니다.');

  const files: ZipManifest['files'] = [];
  const rejectedFiles: string[] = [];
  let offset = centralDirectoryOffset;
  let totalSize = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) throw new Error('ZIP 파일 목록을 읽을 수 없습니다.');

    const uncompressedSize = readUInt32(buffer, offset + 24);
    const nameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const rawName = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    const normalizedPath = normalizeZipPath(rawName);

    offset += 46 + nameLength + extraLength + commentLength;

    if (!normalizedPath || normalizedPath.endsWith('/')) continue;
    totalSize += uncompressedSize;

    if (isUnsafePath(normalizedPath) || FORBIDDEN_EXTENSIONS.has(getExtension(normalizedPath))) {
      rejectedFiles.push(normalizedPath);
      continue;
    }

    files.push({ path: normalizedPath, size: uncompressedSize });
  }

  if (files.length === 0) throw new Error('업로드 가능한 파일이 ZIP 안에 없습니다.');
  if (rejectedFiles.length > 0) throw new Error(`허용되지 않는 파일이 포함되어 있습니다: ${rejectedFiles.slice(0, 5).join(', ')}`);
  if (totalSize > MAX_UNCOMPRESSED_SIZE) throw new Error('ZIP 해제 후 총 용량은 80MB 이하만 허용됩니다.');

  const paths = new Set(files.map((file) => file.path));
  const entryCandidates = ['README.md', 'readme.md', 'package.json', 'src/index.js', 'index.js'].filter((path) => paths.has(path));

  return { files, entryCandidates };
}
