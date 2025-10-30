# SSH调试脚本

Write-Host "=== SSH Configuration Check ===" -ForegroundColor Green

Write-Host "`n1. Checking SSH keys..." -ForegroundColor Yellow
if (Test-Path "$env:USERPROFILE\.ssh\id_rsa") {
    Write-Host "   Private key exists: YES" -ForegroundColor Green
} else {
    Write-Host "   Private key exists: NO" -ForegroundColor Red
}

if (Test-Path "$env:USERPROFILE\.ssh\id_rsa.pub") {
    Write-Host "   Public key exists: YES" -ForegroundColor Green
} else {
    Write-Host "   Public key exists: NO" -ForegroundColor Red
}

Write-Host "`n2. SSH Key Fingerprint:" -ForegroundColor Yellow
$sshFingerprint = ssh-keygen -lf "$env:USERPROFILE\.ssh\id_rsa.pub" 2>$null
if ($sshFingerprint) {
    Write-Host "   $sshFingerprint" -ForegroundColor Green
} else {
    Write-Host "   Could not retrieve fingerprint" -ForegroundColor Red
}

Write-Host "`n3. Known Hosts for GitHub:" -ForegroundColor Yellow
$githubKnownHosts = Get-Content "$env:USERPROFILE\.ssh\known_hosts" | Select-String "github.com"
if ($githubKnownHosts) {
    Write-Host "   GitHub entries found:" -ForegroundColor Green
    $githubKnownHosts | ForEach-Object { Write-Host "   $_" -ForegroundColor Cyan }
} else {
    Write-Host "   No GitHub entries found" -ForegroundColor Red
}

Write-Host "`n4. Testing SSH Connection to GitHub..." -ForegroundColor Yellow
Try {
    $sshResult = ssh -T -o ConnectTimeout=10 git@github.com 2>&1
    if ($LASTEXITCODE -eq 1) {  # SSH连接成功，但GitHub拒绝shell访问
        Write-Host "   Connection successful: YES" -ForegroundColor Green
        Write-Host "   Authentication: SUCCESSFUL" -ForegroundColor Green
    } else {
        Write-Host "   Connection result: $sshResult" -ForegroundColor Red
        Write-Host "   Exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} Catch {
    Write-Host "   Connection failed: $_" -ForegroundColor Red
}

Write-Host "`n5. Current Git Remote URL:" -ForegroundColor Yellow
$gitDir = "D:\WPy64-31241\scripts\coder_resp\cloudpan-nuxt"
if (Test-Path $gitDir) {
    Set-Location $gitDir
    $remoteUrl = git remote get-url origin 2>$null
    if ($remoteUrl) {
        Write-Host "   Remote URL: $remoteUrl" -ForegroundColor Cyan
    } else {
        Write-Host "   Could not get remote URL" -ForegroundColor Red
    }
} else {
    Write-Host "   Cloudpan-nuxt directory not found at $gitDir" -ForegroundColor Red
}

Write-Host "`n=== Check Complete ===" -ForegroundColor Green