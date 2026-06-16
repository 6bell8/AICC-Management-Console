# DB Deployment Environment

This project uses MySQL. Database credentials must be provided through
environment variables and must not be committed to source control.

## Local Development

Create `.env.local` in `aicc-console`.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database_name
AUTH_SESSION_SECRET=replace_with_a_long_random_secret
AUTH_HEAD_EMAIL=head@example.com
AUTH_HEAD_PASSWORD=replace_with_head_password
AUTH_HEAD_NAME=Head Admin
AUTH_GUEST_EMAIL=portfolio-guest@aicc.local
AUTH_GUEST_NAME=Portfolio Guest
```

The legacy `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and
`MYSQL_DATABASE` variables are still supported for existing local setups, but
new environments should use the `DB_*` names above.

If `AUTH_HEAD_EMAIL` and `AUTH_HEAD_PASSWORD` are set, `npm run db:setup` seeds
the HEAD administrator account. This account controls approval, rejection, role
changes, and user deletion from `/admin/users`.

## Vercel Deployment

Add these values in `Vercel Project Settings > Environment Variables`.

```txt
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

When using Railway MySQL, map Railway's `HOST`, `PORT`, `USER`, `PASSWORD`, and
`DATABASE` values to the `DB_*` variables above.

For Vercel or local machines outside Railway, use Railway's public TCP proxy
host and port. Do not use `mysql.railway.internal` outside Railway services.

```txt
DB_HOST=Railway_PUBLIC_HOST
DB_PORT=Railway_PUBLIC_PORT
DB_USER=Railway_USER
DB_PASSWORD=Railway_PASSWORD
DB_NAME=Railway_DATABASE
AUTH_SESSION_SECRET=long_random_production_secret
AUTH_HEAD_EMAIL=head@example.com
AUTH_HEAD_PASSWORD=production_head_password
AUTH_HEAD_NAME=Head Admin
AUTH_GUEST_EMAIL=portfolio-guest@aicc.local
AUTH_GUEST_NAME=Portfolio Guest
```

## Railway MySQL Migration Notes

Back up the local database from the machine where local MySQL is installed:

```bash
mysqldump -u root -p DB_NAME > backup.sql
```

Restore to Railway MySQL using the public Railway host and port:

```bash
mysql -h Railway_PUBLIC_HOST -P Railway_PUBLIC_PORT -u Railway_USER -p Railway_DATABASE < backup.sql
```

After restoring, point `.env.local` to Railway and verify the app can connect:

```bash
npm run db:check
npm run build
```

The DB health route can also be checked locally or after Vercel deploy:

```txt
GET /api/health/db
```

Expected result:

```json
{ "ok": true }
```

## Packaging For Restricted Networks

If GitHub access is blocked, package the project and upload it later from a
network where GitHub is available. Exclude dependency/build/cache files and
secret files.

Do not include:

- `.env.local`
- `.env`
- `backup.sql`
- `.next/`
- `node_modules/`
- `.mysql-data/`

Safe files to include:

- source files under `app/`
- `docs/`
- `scripts/`
- `.env.example`
- `package.json`
- `package-lock.json`

Before packaging, run:

```bash
npm run db:setup
npm run build
```
