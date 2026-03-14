param()

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$jdkRoot = Join-Path $repoRoot '.android-local\jdk'
$sdkRoot = Join-Path $repoRoot '.android-local\sdk'
$androidDir = Join-Path $repoRoot 'android'

$jdk = Get-ChildItem $jdkRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $jdk) {
  throw "No local JDK found under $jdkRoot. Recreate the local Android toolchain first."
}

if (-not (Test-Path (Join-Path $sdkRoot 'platform-tools\adb.exe'))) {
  throw "No local Android SDK platform-tools found under $sdkRoot. Recreate the local Android toolchain first."
}

$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot

Push-Location $repoRoot
try {
  npm run build
  npx cap sync android

  Push-Location $androidDir
  try {
    .\gradlew.bat assembleDebug
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$apkPath = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path $apkPath)) {
  throw "Build finished but the debug APK was not found at $apkPath."
}

Write-Host ""
Write-Host "Debug APK ready:"
Write-Host $apkPath
