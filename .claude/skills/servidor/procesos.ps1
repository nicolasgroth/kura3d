# @file .claude/skills/servidor/procesos.ps1
# @description Lista (y con -Cerrar, termina) los procesos de desarrollo de Kura3D que quedan vivos: servidores
#   Vite, corridas de Playwright, navegadores de prueba y vitest. No toca los conectores MCP de la app de Claude.
# @author Nicolás Groth <ngroth@gmail.com>
# @organization ISGROTH — Innovación y Soluciones GROTH
# @license MIT
#
# Uso:
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1            # solo lista
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar    # termina lo listado
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar -Conservar 5189   # deja ese puerto

param(
  [switch]$Cerrar,
  [int[]]$Conservar = @()
)

$propios = 'vite(\.js)?["'' ]+.*--port|playwright[\\/](test|lib)|@playwright[\\/]test|ms-playwright|vitest'
$ajenos = '@playwright[\\/]mcp|server-pdf|codex'

$escuchas = @{}
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -ge 5100 -and $_.LocalPort -le 5400 -and $_.OwningProcess -ne 4 } |
  ForEach-Object { $escuchas[[int]$_.OwningProcess] = $_.LocalPort }

$procesos = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match '^(node|chrome|chrome-headless-shell|esbuild)\.exe$' } |
  Where-Object { ($_.CommandLine -match $propios -or $escuchas.ContainsKey([int]$_.ProcessId)) -and $_.CommandLine -notmatch $ajenos }

if (-not $procesos) {
  Write-Output 'Limpio: no hay servidores ni corridas de prueba de Kura3D vivos.'
  exit 0
}

$filas = foreach ($p in $procesos) {
  $puerto = $escuchas[[int]$p.ProcessId]
  if (-not $puerto -and $p.CommandLine -match '--port[ =](\d+)') { $puerto = [int]$Matches[1] }
  $cmd = ($p.CommandLine -replace '"', '')
  if ($cmd.Length -gt 90) { $cmd = '...' + $cmd.Substring($cmd.Length - 90) }
  [pscustomobject]@{
    PID = $p.ProcessId
    Puerto = $puerto
    Inicio = $p.CreationDate.ToString('dd HH:mm')
    MB = [int]($p.WorkingSetSize / 1MB)
    Comando = $cmd
  }
}
$filas | Sort-Object Inicio | Format-Table -AutoSize | Out-String -Width 200 | Write-Output

if ($Cerrar) {
  foreach ($f in $filas) {
    if ($f.Puerto -and $Conservar -contains $f.Puerto) { continue }
    & taskkill /PID $f.PID /F /T 2>$null | Out-Null
  }
  Start-Sleep -Seconds 1
  $quedan = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 5100 -and $_.LocalPort -le 5400 -and $_.OwningProcess -ne 4 -and $Conservar -notcontains $_.LocalPort }
  if ($quedan) {
    Write-Output ('Siguen abiertos: ' + (($quedan | ForEach-Object { $_.LocalPort }) -join ', '))
    exit 1
  }
  Write-Output 'Cerrado. Puertos 5100 a 5400 libres (salvo los conservados).'
}
