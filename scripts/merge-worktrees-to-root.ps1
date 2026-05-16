# Merge Claude worktree copies into project root (newer file wins).
$ErrorActionPreference = 'Stop'

$Root = 'C:\Users\jwill\Desktop\Developer\Clone\PEMABU_PLATFORM_NEW'
$Sources = @(
    (Join-Path $Root '.claude\worktrees\great-meninsky-e187af'),
    (Join-Path $Root '.claude\worktrees\infallible-golick-748777')
)

$ExcludeRelative = @(
    '.git',
    'node_modules',
    '.claude'
)

$stats = @{
    Copied   = 0
    SkippedOlder = 0
    SkippedExcluded = 0
    Errors   = @()
}

function Test-ExcludedRelativePath {
    param([string]$Rel)
    foreach ($ex in $ExcludeRelative) {
        if ($Rel -eq $ex -or $Rel.StartsWith("$ex\", [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

function Merge-SourceIntoRoot {
    param([string]$SourceRoot)

    if (-not (Test-Path -LiteralPath $SourceRoot)) {
        Write-Warning "Source missing: $SourceRoot"
        return
    }

    Write-Host "Merging from: $SourceRoot"

    Get-ChildItem -LiteralPath $SourceRoot -Force -Recurse -File | ForEach-Object {
        $rel = $_.FullName.Substring($SourceRoot.Length).TrimStart('\', '/')
        if (Test-ExcludedRelativePath -Rel $rel) {
            $script:stats.SkippedExcluded++
            return
        }

        $dest = Join-Path $Root $rel
        $destDir = Split-Path -Parent $dest
        if ($destDir -and -not (Test-Path -LiteralPath $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        if (Test-Path -LiteralPath $dest) {
            $destItem = Get-Item -LiteralPath $dest -Force
            if ($destItem.LastWriteTimeUtc -ge $_.LastWriteTimeUtc) {
                $script:stats.SkippedOlder++
                return
            }
        }

        try {
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
            $script:stats.Copied++
        }
        catch {
            $script:stats.Errors += "$rel : $($_.Exception.Message)"
        }
    }
}

foreach ($src in $Sources) {
    Merge-SourceIntoRoot -SourceRoot $src
}

Write-Host ''
Write-Host '=== Merge summary ==='
Write-Host "Copied (newer or new): $($stats.Copied)"
Write-Host "Skipped (dest newer):    $($stats.SkippedOlder)"
Write-Host "Skipped (excluded):      $($stats.SkippedExcluded)"
if ($stats.Errors.Count -gt 0) {
    Write-Host "Errors: $($stats.Errors.Count)"
    $stats.Errors | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" }
}

# Remove merged worktree contents (keep empty dirs for user to delete)
foreach ($src in $Sources) {
    if (-not (Test-Path -LiteralPath $src)) { continue }
    Write-Host "Cleaning worktree: $src"
    Get-ChildItem -LiteralPath $src -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
Write-Host '=== Verification ==='
foreach ($label in @('A', 'B')) {
    $p = if ($label -eq 'A') { $Sources[0] } else { $Sources[1] }
    $remaining = @(Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue)
    Write-Host "Worktree $label remaining items: $($remaining.Count)"
}

$core = @('package.json', 'app', 'components', 'lib', 'public', 'scripts', 'services', 'supabase')
Write-Host 'Core paths at root:'
foreach ($c in $core) {
    $p = Join-Path $Root $c
    $ok = Test-Path -LiteralPath $p
    Write-Host "  $c : $ok"
}

$rootFiles = (Get-ChildItem -LiteralPath $Root -Force -File).Count
$rootDirs = (Get-ChildItem -LiteralPath $Root -Force -Directory).Count
Write-Host "Root top-level: $rootFiles files, $rootDirs directories"
