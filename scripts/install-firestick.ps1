param(
  [string]$FirestickIP,
  [string]$ApkPath
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sdkRoot = Join-Path $repoRoot '.android-local\sdk'
$adbPath = Join-Path $sdkRoot 'platform-tools\adb.exe'

if (-not (Test-Path $adbPath)) {
  throw "Local adb was not found at $adbPath. Build the Android toolchain first."
}

if (-not $ApkPath) {
  $ApkPath = Join-Path $repoRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
}

if (-not (Test-Path $ApkPath)) {
  throw "APK not found at $ApkPath. Run npm run android:build:debug first."
}

if ($FirestickIP) {
  & $adbPath connect "$FirestickIP`:5555"
}

& $adbPath devices
& $adbPath install -r $ApkPath

Write-Host ""
Write-Host "Installed APK:"
Write-Host $ApkPath
