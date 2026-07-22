param(
    [string]$Event = "unknown"
)

# Check if we're in a git repo
$gitRepo = git rev-parse --is-inside-work-tree 2>$null
if (-not $gitRepo) {
    Write-Host "[specify] Warning: Not a git repository; skipped auto-commit"
    exit 0
}

# Check if there are changes to commit
$status = git status --porcelain
if (-not $status) {
    Write-Host "[specify] No changes to commit; skipped auto-commit"
    exit 0
}

$configFile = ".specify/extensions/git/git-config.yml"
$message = "[Spec Kit] Auto-commit ($Event)"

if (Test-Path $configFile) {
    $config = Get-Content $configFile -Raw
    $eventKey = "after_$($Event -replace '^after_', '')"
    if ($config -match "$eventKey\s*:\s*\n\s+enabled:\s*true\s*\n\s+message:\s*""([^""]+)""") {
        $message = "[Spec Kit] $($matches[1])"
    }
}

git add .
git commit -m $message
Write-Host "[specify] Auto-commit: $message"
