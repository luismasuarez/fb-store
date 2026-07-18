param(
    [Parameter(Mandatory=$true)]
    [string]$Event
)

$configPath = ".specify/extensions/git/git-config.yml"
if (-not (Test-Path $configPath)) {
    Write-Host "[git-extension] Config not found at $configPath — skipping"
    exit 0
}

# Check git
try {
    $null = git rev-parse --git-dir 2>&1
} catch {
    Write-Host "[git-extension] Not a git repository — skipping"
    exit 0
}

# Check for changes
$status = git status --porcelain
if (-not $status) {
    Write-Host "[git-extension] No changes to commit — skipping"
    exit 0
}

# Parse config (simple regex-based)
$content = Get-Content $configPath -Raw

function Is-Enabled($eventName) {
    $pattern = "(?s)auto_commit:\s*\n(?:.*\n)*?  $eventName:\s*\n(?:.*\n)*?  enabled:\s*(true|false)"
    if ($content -match $pattern) {
        return $matches[1] -eq "true"
    }
    # Fall back to default
    if ($content -match "default:\s*(true|false)") {
        return $matches[1] -eq "true"
    }
    return $false
}

function Get-Message($eventName) {
    $pattern = "(?s)  $eventName:\s*\n(?:.*\n)*?  message:\s*""([^""]+)"""
    if ($content -match $pattern) {
        return $matches[1]
    }
    return "[Spec Kit] Auto-commit ($eventName)"
}

if (Is-Enabled $Event) {
    $message = Get-Message $Event
    Write-Host "[git-extension] Auto-committing after $Event..."
    git add .
    git commit -m $message
    Write-Host "[git-extension] Committed: $message"
} else {
    Write-Host "[git-extension] Auto-commit disabled for event: $Event"
}
