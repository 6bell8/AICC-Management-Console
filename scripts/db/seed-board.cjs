const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const { getMysqlConfig, loadLocalEnv } = require('./env.cjs');

const ROOT_DIR = path.resolve(__dirname, '..', '..');

function readJson(fileName, fallback) {
  const filePath = path.join(ROOT_DIR, 'data', fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function toMysqlDateTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 23).replace('T', ' ');
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

function uniqueId(rawId, seen, fallbackPrefix, index) {
  const base = String(rawId || `${fallbackPrefix}_${index + 1}`).trim();
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }

  let suffix = 2;
  let next = `${base}_${suffix}`;
  while (seen.has(next)) {
    suffix += 1;
    next = `${base}_${suffix}`;
  }
  seen.add(next);
  return next;
}

async function seedNotices(connection) {
  const notices = readJson('notice.json', []);
  const items = Array.isArray(notices) ? notices : [];
  const seen = new Set();

  for (const [index, raw] of items.entries()) {
    const id = uniqueId(raw.id, seen, 'notice', index);
    await connection.execute(
      `
        INSERT INTO notices (id, title, content, pinned, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          content = VALUES(content),
          pinned = VALUES(pinned),
          status = VALUES(status),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)
      `,
      [
        id,
        String(raw.title || '').trim() || 'Untitled notice',
        String(raw.content || '').trim() || 'No content',
        raw.pinned === true,
        raw.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        toMysqlDateTime(raw.createdAt),
        toMysqlDateTime(raw.updatedAt),
      ],
    );
  }

  console.log(`Seeded ${items.length} notices.`);
}

async function seedAuthorGuides(connection) {
  const guides = readJson('authorGuide.json', []);
  const items = Array.isArray(guides) ? guides : [];
  const seen = new Set();

  for (const [index, raw] of items.entries()) {
    const id = uniqueId(raw.id, seen, 'author_guide', index);
    await connection.execute(
      `
        INSERT INTO author_guides (id, title, content, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          content = VALUES(content),
          status = VALUES(status),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)
      `,
      [
        id,
        String(raw.title || '').trim() || 'Untitled guide',
        String(raw.content || '').trim() || 'No content',
        raw.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        toMysqlDateTime(raw.createdAt),
        toMysqlDateTime(raw.updatedAt),
      ],
    );
  }

  console.log(`Seeded ${items.length} author guides.`);
}

async function seedDynnodePosts(connection) {
  const store = readJson('dynnode.json', { items: [] });
  const items = Array.isArray(store.items) ? store.items : [];
  const seen = new Set();

  for (const [index, raw] of items.entries()) {
    const id = uniqueId(raw.id, seen, 'dynnode', index);
    await connection.execute(
      `
        INSERT INTO dynnode_posts (id, title, summary, code, sample_ctx, ctx_key, tags, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          summary = VALUES(summary),
          code = VALUES(code),
          sample_ctx = VALUES(sample_ctx),
          ctx_key = VALUES(ctx_key),
          tags = VALUES(tags),
          status = VALUES(status),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)
      `,
      [
        id,
        String(raw.title || '').trim() || 'Untitled post',
        raw.summary == null ? null : String(raw.summary),
        String(raw.code || ''),
        String(raw.sampleCtx || '{\n  \n}\n'),
        String(raw.ctxKey || 'api:API01').trim() || 'api:API01',
        JSON.stringify(Array.isArray(raw.tags) ? raw.tags.filter((tag) => typeof tag === 'string') : []),
        raw.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
        toMysqlDateTime(raw.createdAt),
        toMysqlDateTime(raw.updatedAt),
      ],
    );
  }

  console.log(`Seeded ${items.length} dynnode posts.`);
}

async function main() {
  loadLocalEnv(ROOT_DIR);
  const connection = await mysql.createConnection(getMysqlConfig());

  try {
    await connection.beginTransaction();
    await seedNotices(connection);
    await seedAuthorGuides(connection);
    await seedDynnodePosts(connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to seed board data.');
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
