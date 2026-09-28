param(
    [Parameter(Mandatory=$true)][string]$Archive,
    [Parameter(Mandatory=$true)][string]$InstallRoot,
    [Parameter(Mandatory=$true)][string]$Plan,
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][int]$ProcessId
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Test-SafeRelative([string]$Relative) {
    if ([string]::IsNullOrWhiteSpace($Relative)) { return $false }
    $r = $Relative.Replace('\','/')
    if ([IO.Path]::IsPathRooted($r)) { return $false }
    if ($r -eq '..' -or $r.StartsWith('../') -or $r.Contains('/../') -or $r.EndsWith('/..')) { return $false }
    if ($r.StartsWith('Saved/', [StringComparison]::OrdinalIgnoreCase) -or $r.IndexOf('/Saved/', [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $false }
    return $true
}

function Assert-UnderRoot([string]$Path, [string]$Root) {
    $full = [IO.Path]::GetFullPath($Path)
    $base = [IO.Path]::GetFullPath($Root).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($base, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Ruta fuera de la instalacion: $full"
    }
    return $full
}

$Archive = [IO.Path]::GetFullPath($Archive)
$InstallRoot = [IO.Path]::GetFullPath($InstallRoot)
$Plan = [IO.Path]::GetFullPath($Plan)
$Executable = [IO.Path]::GetFullPath($Executable)
if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw 'No existe el archivo de actualizacion.' }
if (-not (Test-Path -LiteralPath $Plan -PathType Leaf)) { throw 'No existe el plan de actualizacion.' }
if (-not (Test-Path -LiteralPath $InstallRoot -PathType Container)) { throw 'La raiz de instalacion no existe.' }
$Executable = Assert-UnderRoot $Executable $InstallRoot

$logDir = Split-Path -Parent $Plan
$log = Join-Path $logDir 'apply.log'
"[$([DateTime]::UtcNow.ToString('o'))] Esperando al proceso $ProcessId" | Set-Content -LiteralPath $log -Encoding UTF8

for ($i=0; $i -lt 600; $i++) {
    $p = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($null -eq $p) { break }
    Start-Sleep -Milliseconds 500
}
if ($null -ne (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { throw 'FNOP no se cerro a tiempo; actualizacion cancelada.' }

$expanded = Join-Path $logDir 'expanded'
$rollback = Join-Path $logDir ('rollback_' + [DateTime]::UtcNow.ToString('yyyyMMdd_HHmmss'))
if (Test-Path -LiteralPath $expanded) { Remove-Item -LiteralPath $expanded -Recurse -Force }
New-Item -ItemType Directory -Path $expanded -Force | Out-Null
New-Item -ItemType Directory -Path $rollback -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::ExtractToDirectory($Archive, $expanded)
$filesRoot = Join-Path $expanded 'files'
if (-not (Test-Path -LiteralPath $filesRoot -PathType Container)) { throw 'El paquete FNOP no contiene files/.' }

# Validate the complete plan before touching the installed game.
$rootPrefix = [IO.Path]::GetFullPath($filesRoot).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar
$payload = @()
foreach ($file in (Get-ChildItem -LiteralPath $filesRoot -File -Recurse -Force)) {
    $fullSource = [IO.Path]::GetFullPath($file.FullName)
    if (-not $fullSource.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Entrada ZIP fuera de files/.' }
    $relative = $fullSource.Substring($rootPrefix.Length).Replace('\','/')
    if (-not (Test-SafeRelative $relative)) { throw "Ruta insegura en el parche: $relative" }
    $dest = Assert-UnderRoot (Join-Path $InstallRoot $relative) $InstallRoot
    $payload += [PSCustomObject]@{ Source=$fullSource; Relative=$relative; Destination=$dest }
}

$planData = Get-Content -LiteralPath $Plan -Raw | ConvertFrom-Json
$deletions = @()
foreach ($item in @($planData.deleted)) {
    $relative = [string]$item
    if (-not (Test-SafeRelative $relative)) { throw "Ruta de borrado insegura: $relative" }
    $dest = Assert-UnderRoot (Join-Path $InstallRoot $relative) $InstallRoot
    $deletions += [PSCustomObject]@{ Relative=$relative; Destination=$dest }
}

$created = New-Object System.Collections.ArrayList
$backed = @{}
function Backup-InstalledFile([string]$Relative, [string]$Destination) {
    $key = $Relative.ToLowerInvariant()
    if ($backed.ContainsKey($key)) { return }
    if (Test-Path -LiteralPath $Destination -PathType Container) { throw "Se esperaba un archivo y existe una carpeta: $Relative" }
    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        $backupFile = Join-Path $rollback $Relative
        $parent = Split-Path -Parent $backupFile
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $Destination -Destination $backupFile -Force
        $backed[$key] = $Relative
    } else {
        $created.Add($Relative) | Out-Null
        $backed[$key] = $null
    }
}

try {
    foreach ($entry in $payload) {
        Backup-InstalledFile $entry.Relative $entry.Destination
        $parent = Split-Path -Parent $entry.Destination
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $entry.Source -Destination $entry.Destination -Force
    }

    foreach ($entry in $deletions) {
        if (Test-Path -LiteralPath $entry.Destination -PathType Container) { throw "La eliminacion publicada apunta a una carpeta: $($entry.Relative)" }
        if (Test-Path -LiteralPath $entry.Destination -PathType Leaf) {
            Backup-InstalledFile $entry.Relative $entry.Destination
            Remove-Item -LiteralPath $entry.Destination -Force
        }
    }

    "[$([DateTime]::UtcNow.ToString('o'))] Actualizacion aplicada: $($planData.version)" | Add-Content -LiteralPath $log -Encoding UTF8
}
catch {
    "[$([DateTime]::UtcNow.ToString('o'))] ERROR; iniciando rollback: $($_.Exception.Message)" | Add-Content -LiteralPath $log -Encoding UTF8
    foreach ($relative in $created) {
        try {
            $dest = Assert-UnderRoot (Join-Path $InstallRoot $relative) $InstallRoot
            if (Test-Path -LiteralPath $dest -PathType Leaf) { Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue }
        } catch { }
    }
    foreach ($backupFile in (Get-ChildItem -LiteralPath $rollback -File -Recurse -Force -ErrorAction SilentlyContinue)) {
        try {
            $relative = $backupFile.FullName.Substring(([IO.Path]::GetFullPath($rollback).TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar).Length).Replace('\','/')
            if (-not (Test-SafeRelative $relative)) { continue }
            $dest = Assert-UnderRoot (Join-Path $InstallRoot $relative) $InstallRoot
            $parent = Split-Path -Parent $dest
            if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            Copy-Item -LiteralPath $backupFile.FullName -Destination $dest -Force
        } catch { }
    }
    "[$([DateTime]::UtcNow.ToString('o'))] Rollback terminado." | Add-Content -LiteralPath $log -Encoding UTF8
    throw
}

try { Remove-Item -LiteralPath $expanded -Recurse -Force -ErrorAction SilentlyContinue } catch { }
try { Remove-Item -LiteralPath $rollback -Recurse -Force -ErrorAction SilentlyContinue } catch { }
try { Remove-Item -LiteralPath $Archive -Force -ErrorAction SilentlyContinue } catch { }
try { Remove-Item -LiteralPath $Plan -Force -ErrorAction SilentlyContinue } catch { }

if (Test-Path -LiteralPath $Executable -PathType Leaf) {
    Start-Process -FilePath $Executable -WorkingDirectory (Split-Path -Parent $Executable)
}
