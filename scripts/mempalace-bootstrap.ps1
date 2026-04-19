[CmdletBinding()]
param(
    [string]$RepoPath = (Get-Location).Path,
    [string]$Wing,
    [string]$PalaceRoot = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.codex\memories\mempalace\palace'),
    [ValidateSet('projects', 'convos')]
    [string]$Mode = 'projects',
    [int]$Limit = 0,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

function Write-Config {
    param(
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [Parameter(Mandatory = $true)][string]$PalacePath
    )

    $config = @{
        palace_path    = $PalacePath
        collection_name = 'mempalace_drawers'
        topic_wings    = @('emotions', 'consciousness', 'memory', 'technical', 'identity', 'family', 'creative')
        hall_keywords  = @{
            emotions      = @('scared', 'afraid', 'worried', 'happy', 'sad', 'love', 'hate', 'feel', 'cry', 'tears')
            consciousness = @('consciousness', 'conscious', 'aware', 'real', 'genuine', 'soul', 'exist', 'alive')
            memory        = @('memory', 'remember', 'forget', 'recall', 'archive', 'palace', 'store')
            technical     = @('code', 'python', 'script', 'bug', 'error', 'function', 'api', 'database', 'server')
            identity      = @('identity', 'name', 'who am i', 'persona', 'self')
            family        = @('family', 'kids', 'children', 'daughter', 'son', 'parent', 'mother', 'father')
            creative      = @('game', 'gameplay', 'player', 'app', 'design', 'art', 'music', 'story')
        }
    }

    $config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ConfigPath -Encoding utf8
}

$userHome = [Environment]::GetFolderPath('UserProfile')
$memoryHome = Join-Path $userHome '.mempalace'
$repo = (Resolve-Path -LiteralPath $RepoPath).Path

if (-not $Wing) {
    $Wing = Split-Path -Leaf $repo
}

$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
New-Item -ItemType Directory -Force -Path $memoryHome, $PalaceRoot | Out-Null

$env:MEMPALACE_PALACE_PATH = $PalaceRoot

$configPath = Join-Path $memoryHome 'config.json'
if (-not (Test-Path $configPath)) {
    Write-Config -ConfigPath $configPath -PalacePath $PalaceRoot
}

if (-not $SkipInstall) {
    try {
        & python -X utf8 -c "import mempalace.mcp_server" | Out-Null
    }
    catch {
        & python -X utf8 -m pip install --user mempalace
    }
}

$memoryDir = Join-Path $repo 'memory'
if (-not (Test-Path $memoryDir)) {
    New-Item -ItemType Directory -Force -Path $memoryDir | Out-Null
}

$conventionsPath = Join-Path $memoryDir 'memory-conventions.md'
if (-not (Test-Path $conventionsPath)) {
    @'
# MemPalace Memory Conventions

## Canonical repo layout

Use this folder as the default project memory bank:

```text
memory/
  activeContext.md
  agent_memory.md
  memory-conventions.md
  productContext.md
  progress.md
  systemPatterns.md
  techContext.md
```

## Room mapping

- `productContext.md`: product purpose, users, domain entities, business rules.
- `activeContext.md`: current phase, last completed work, known issues, next focus.
- `systemPatterns.md`: architecture, invariants, patterns, decision records.
- `techContext.md`: stack, services, commands, environment notes.
- `progress.md`: recent milestones and delivery history.
- `agent_memory.md`: append-only session memory and short-lived notes.
- `memory-conventions.md`: the canonical rules for reading and writing the bank.

## Wing naming

- Use `wing_<repo-slug>` for one repo.
- For monorepos, use `wing_<repo-slug>-<package-slug>` when separate packages need separate recall.
- Keep wings stable across machines and clones.

## Ingestion rules

- Read `memory/memory-conventions.md` first if it exists.
- Prefer `mempalace init <repo> --yes` before first ingest.
- Prefer `mempalace mine <repo> --mode projects --wing <wing>` for code and docs.
- For chat exports, use `--mode convos`.
- Use the repo root as the default ingest target unless the repo explicitly narrows to a subfolder.

## Update rules

- Put stable facts in `productContext`, `systemPatterns`, and `techContext`.
- Put transient state in `activeContext` and `progress`.
- Use append-only updates for history; do not rewrite old facts unless they were wrong.
'@ | Set-Content -LiteralPath $conventionsPath -Encoding utf8
}

Write-Host "Repo: $repo"
Write-Host "Wing: $Wing"
Write-Host "Palace: $PalaceRoot"

@('') | & python -X utf8 -m mempalace init $repo --yes
$mineArgs = @('mine', $repo, '--mode', $Mode, '--wing', $Wing)
if ($Limit -gt 0) {
    $mineArgs += @('--limit', "$Limit")
}
& python -X utf8 -m mempalace @mineArgs
& python -X utf8 -m mempalace status
