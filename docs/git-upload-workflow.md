# AICC Console Git Upload Workflow

This PC is the Git upload hub for the AICC console project.

## Standard Flow

1. Export or copy the finished project folder from the work computer.
2. Place it on this PC's Desktop with a name like `aicc-console-git-ready-YYYYMMDD`.
3. Open PowerShell in `C:\Users\JS\Documents\aicc console`.
4. Run the sync script.
5. Check the Vercel Preview deployment.
6. Merge to `master` only after the Preview is verified.

## Recommended Command

```powershell
.\scripts\git\sync-ready-snapshot.ps1 -SourcePath "$env:USERPROFILE\Desktop\aicc-console-git-ready-20260609" -BranchName "aicc-console-git-ready-20260609" -CommitMessage "Import AICC console ready snapshot" -Push
```

If the folder name uses today's date, this shorter form can be used:

```powershell
.\scripts\git\sync-ready-snapshot.ps1 -Push
```

## What The Script Excludes

The script copies source files and project configuration, but excludes local-only artifacts:

- `.env`, `.env.local`
- `.mysql-data/`
- `.mysql.pid`, `.next-dev.pid`
- `node_modules/`
- `.next/`, `out/`, `build/`, `coverage/`
- `.vercel/`
- `backup.sql`
- `tsconfig.tsbuildinfo`
- `*.zip`

## Vercel Checks

After push, Vercel should create a Preview deployment for the pushed branch.

If login fails, check runtime logs first. Common causes:

- Missing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Missing Railway-style values: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`
- Missing `AUTH_SESSION_SECRET`
- Vercel Deployment Protection returning `401 Unauthorized` before the app is reached

## Production Rule

Do not push snapshots directly to `master`.

Use a dated branch first, verify Preview, then merge to `master` for Production deployment.
