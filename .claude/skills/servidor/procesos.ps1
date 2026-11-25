# @file .claude/skills/servidor/procesos.ps1
# @description Lista (y con -Cerrar, termina) los procesos de desarrollo de Kurra Studio que quedan vivos: servidores
#   Vite, corridas de Playwright, navegadores de prueba, vitest y bucles de espera de shell que llevan más de 20 minutos
#   (un `until ...; do sleep; done` que quedó esperando un archivo que nunca llegó). No toca los conectores MCP de la app de Claude.
# @author Nicolás Groth <ngroth@gmail.com>
# @organization ISGROTH — Innovación y Soluciones GROTH
# @license MIT
#
# Uso:
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1            # solo lista
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar    # termina lo listado
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar -Conservar 5189   # deja ese puerto
#   powershell -NoProfile -File .claude/skills/servidor/procesos.ps1 -Cerrar -Solo 5291        # cierra solo ese servidor
#
# -Cerrar nunca termina corridas de vitest (pueden ser de otro agente): se listan y se cierran a mano por PID.
# -Cerrar (sin -Solo) sí termina los bucles de espera de más de 20 minutos: ninguna espera legítima dura tanto.

param(
  [switch]$Cerrar,
  [int[]]$Conservar = @(),
  [int[]]$Solo = @()
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

# Bucles de espera de shell: un `until`/`while` con `sleep` que lleva más de 20 minutos vivo es casi seguro un huérfano.
$limiteEspera = (Get-Date).AddMinutes(-20)
$esperas = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'bash.exe' -and $_.CommandLine -match '(until|while) .*sleep \d' -and $_.CreationDate -lt $limiteEspera }
$procesos = @($procesos) + @($esperas) | Where-Object { $_ }

if (-not $procesos) {
  Write-Output 'Limpio: no hay servidores ni corridas de prueba de Kurra Studio vivos.'
  exit 0
}

$filas = foreach ($p in $procesos) {
  $puerto = $escuchas[[int]$p.ProcessId]
  if (-not $puerto -and $p.CommandLine -match '--port[ =](\d+)') { $puerto = [int]$Matches[1] }
  $tipo = if ($p.Name -eq 'bash.exe') { 'espera' } elseif ($p.CommandLine -match 'vitest') { 'vitest' } elseif ($puerto) { 'servidor' } else { 'playwright' }
  $cmd = ($p.CommandLine -replace '"', '')
  if ($cmd.Length -gt 90) { $cmd = '...' + $cmd.Substring($cmd.Length - 90) }
  [pscustomobject]@{
    PID = $p.ProcessId
    Puerto = $puerto
    Tipo = $tipo
    Inicio = $p.CreationDate.ToString('dd HH:mm')
    MB = [int]($p.WorkingSetSize / 1MB)
    Comando = $cmd
  }
}
$filas | Sort-Object Inicio | Format-Table -AutoSize | Out-String -Width 200 | Write-Output

if ($Cerrar) {
  foreach ($f in $filas) {
    if ($f.Tipo -eq 'vitest') { continue }
    if ($f.Tipo -eq 'espera' -and $Solo.Count -gt 0) { continue }
    if ($f.Tipo -ne 'espera' -and $Solo.Count -gt 0 -and $Solo -notcontains $f.Puerto) { continue }
    if ($f.Puerto -and $Conservar -contains $f.Puerto) { continue }
    & taskkill /PID $f.PID /F /T 2>$null | Out-Null
  }
  Start-Sleep -Seconds 1
  $quedan = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 5100 -and $_.LocalPort -le 5400 -and $_.OwningProcess -ne 4 -and $Conservar -notcontains $_.LocalPort -and ($Solo.Count -eq 0 -or $Solo -contains $_.LocalPort) }
  if ($quedan) {
    Write-Output ('Siguen abiertos: ' + (($quedan | ForEach-Object { $_.LocalPort }) -join ', '))
    exit 1
  }
  Write-Output 'Cerrado. Sin servidores en los puertos pedidos (5100 a 5400, salvo los conservados).'
}
