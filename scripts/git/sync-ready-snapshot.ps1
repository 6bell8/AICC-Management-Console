param(
  [string]$SourcePath,
  [string]$BranchName,
  [string]$CommitMessage,
  [switch]$Push,
  [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'

function Resolve-RepoRoot {
  $root = git rev-parse --show-toplevel
  if (-not $root) {
    throw 'This script must be run inside the AICC console Git repository.'
  }
  return $root.Trim()
}

function Get-DefaultSnapshotPath {
  $stamp = Get-Date -Format 'yyyyMMdd'
  return Join-Path $env:USERPROFILE "Desktop\aicc-console-git-ready-$stamp"
}

function Get-DefaultBranchName([string]$source) {
  return Split-Path $source -Leaf
}

function Assert-CleanWorktree {
  if ($AllowDirty) {
    return
  }

  $status = git status --porcelain
  if ($status) {
    throw 'Working tree is not clean. Commit, stash, or rerun with -AllowDirty after reviewing local changes.'
  }
}

function Invoke-RobocopySnapshot([string]$source, [string]$destination) {
  $excludedDirs = @(
    '.git',
    '.mysql-data',
    'node_modules',
    '.next',
    'out',
    'build',
    'coverage',
    '.vercel'
  )

  $excludedFiles = @(
    '.env',
    '.env.local',
    '.mysql.pid',
    '.next-dev.pid',
    'backup.sql',
    'tsconfig.tsbuildinfo',
    '*.zip'
  )

  robocopy $source $destination /E /XD $excludedDirs /XF $excludedFiles
  $code = $LASTEXITCODE
  if ($code -ge 8) {
    throw "robocopy failed with exit code $code."
  }
}

$repoRoot = Resolve-RepoRoot
if (-not $SourcePath) {
  $SourcePath = Get-DefaultSnapshotPath
}

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not (Test-Path -LiteralPath $SourcePath -PathType Container)) {
  throw "Snapshot folder not found: $SourcePath"
}

if (-not $BranchName) {
  $BranchName = Get-DefaultBranchName $SourcePath
}

if (-not $CommitMessage) {
  $CommitMessage = "Import $BranchName"
}

Set-Location $repoRoot
Assert-CleanWorktree

$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne $BranchName) {
  $exists = git branch --list $BranchName
  if ($exists) {
    git switch $BranchName
  } else {
    git switch -c $BranchName
  }
}

Invoke-RobocopySnapshot $SourcePath $repoRoot

git add .

$pending = git diff --cached --name-only
if (-not $pending) {
  Write-Host 'No Git changes detected after snapshot sync.'
  exit 0
}

git commit -m $CommitMessage

if ($Push) {
  git push -u origin $BranchName
}

Write-Host "Snapshot synced on branch: $BranchName"
