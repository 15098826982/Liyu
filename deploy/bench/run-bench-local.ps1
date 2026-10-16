# 本地压测编排：启动应用 -> 拿 token -> 跑场景 -> 停应用
# 用法：pwsh -File deploy/bench/run-bench-local.ps1
param([string]$Base = 'http://127.0.0.1:8080', [string]$Code = 'bench1')
$ErrorActionPreference = 'Continue'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$serverDir = Join-Path $root 'server'

Write-Host '== 1. 启动应用（local profile）=='
Set-Location $serverDir
$log = Join-Path $serverDir 'target\bench-app.log'
Remove-Item $log -ErrorAction SilentlyContinue
$proc = Start-Process -FilePath 'mvn.cmd' `
  -ArgumentList '-o','-B','spring-boot:run','-Dspring-boot.run.profiles=local' `
  -RedirectStandardOutput $log -RedirectStandardError (Join-Path $serverDir 'target\bench-app.err') `
  -PassThru -NoNewWindow

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 3
  try { Invoke-WebRequest -Uri "$Base/ping" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true; break }
  catch { if ($proc.HasExited) { break } }
}
if (-not $ready) {
  Write-Host 'FAILED: app did not start'
  Get-Content $log -Tail 30
  taskkill /F /T /PID $proc.Id | Out-Null
  exit 1
}
Write-Host '   app ready'

Write-Host '== 2. 登录拿 token =='
$login = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -ContentType 'application/json' -Body ("{""code"":""$Code""}") -TimeoutSec 10
$token = $login.data.token
Write-Host ("   userId=" + $login.data.userId + "  familyId=" + $login.data.familyId)

Set-Location $root
$lt = 'deploy/bench/loadtest.mjs'
node $lt --url $Base --path /ping       -c 20 -d 10 --warmup 3                    --label 'A. /ping      (web layer only)'
node $lt --url $Base --path /user/me    -c 20 -d 10 --warmup 3 --token $token     --label 'B. /user/me   (1 MySQL query each)'
node $lt --url $Base --path /dish/list  -c 20 -d 10 --warmup 3 --token $token     --label 'C. /dish/list (Redis cache, 50 rows)'
node $lt --url $Base --path /memo/list  -c 20 -d 10 --warmup 3 --token $token     --label 'D. /memo/list (NO cache, 50 rows)'
foreach ($c in 5,10,25,50,100) {
  node $lt --url $Base --path /dish/list -c $c -d 8 --warmup 2 --token $token --label ("E. /dish/list ramp c=" + $c)
}

Write-Host '== 3. 停止应用 =='
taskkill /F /T /PID $proc.Id | Out-Null
Write-Host '   done'
