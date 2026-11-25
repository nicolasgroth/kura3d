/**
 * @file src/store/smoothCommandSchemas.ts
 * @description Esquema del comando `smooth_mesh` («Suavizar malla»): lee intensidad (fuerza 0,1–1), pasadas,
 * protección de aristas vivas con su ángulo y la zona opcional por color pintado, con los rangos de `SMOOTH_RANGES`,
 * y da forma al informe (volúmenes en mundo, intensidad efectiva y su cobertura, vértices protegidos por aristas vivas
 * y por daño). Lo comparten el Command Bus de
 * la app y el MCP sin interfaz: mismos parámetros del motor y misma respuesta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { CommandError } from '../core/bus/commandErrors';
import { readBoolean, readColor, readRange, type RawParams } from '../core/bus/commandValidation';
import { SMOOTH_DEFAULTS, SMOOTH_RANGES, type SmoothReport } from '../engine/smooth';
import type { MeshData } from '../types/kura';
import { paintedColors, SMOOTH_UI_DEFAULTS, unpaintedZoneError, type SmoothParams } from './smoothParams';

/** Parámetros de la interfaz para el comando (la intensidad llega como fuerza 0,1–1 y se guarda en %). */
export function parseSmoothMesh(p: RawParams, mesh: MeshData): SmoothParams {
  const strength = readRange(p, SMOOTH_RANGES.strength, 'strength') ?? SMOOTH_DEFAULTS.strength;
  const zoneColor = readColor(p, 'zoneColor')?.toLowerCase() ?? null;
  if (zoneColor && !paintedColors(mesh).includes(zoneColor)) throw unpaintedZoneError();
  if (!zoneColor && p.falloffRings !== undefined) {
    // Sin zona no hay transición: aceptarlo callado haría creer que se suavizó solo una zona.
    throw new CommandError('invalid-params', 'bus.error.invalidParam', { param: 'falloffRings', expected: 'only with zoneColor' });
  }
  return {
    ...SMOOTH_UI_DEFAULTS,
    intensityPct: strength * 100,
    iterations: readRange(p, SMOOTH_RANGES.iterations, 'iterations') ?? SMOOTH_DEFAULTS.iterations,
    keepSharpEdges: readBoolean(p, 'preserveSharpEdges') ?? SMOOTH_DEFAULTS.preserveSharpEdges,
    sharpAngleDeg: readRange(p, SMOOTH_RANGES.sharpAngleDeg, 'sharpAngleDeg') ?? SMOOTH_DEFAULTS.sharpAngleDeg,
    zoneMode: zoneColor ? 'color' : 'all',
    zoneColor,
    falloffRings: readRange(p, SMOOTH_RANGES.falloffRings, 'falloffRings') ?? SMOOTH_DEFAULTS.falloffRings,
  };
}

const r = (v: number, digits = 4) => Math.round(v * 10 ** digits) / 10 ** digits + 0;

/** Informe del suavizado para el comando (sin malla). `applied` es false si no había vértices que mover. */
export function smoothReportToUser(report: SmoothReport, applied: boolean) {
  return {
    applied,
    iterations: report.iterations,
    requestedStrength: r(report.requestedStrength),
    appliedStrength: r(report.appliedStrength),
    movedVertices: report.movedVertices,
    protectedVertices: report.lockedVertices,
    weldedVertices: report.weldedVertices,
    volumeBeforeMm3: r(report.volumeBeforeMm3, 3),
    volumeAfterMm3: r(report.volumeAfterMm3, 3),
    volumeChangePct: r(report.volumeChangePct),
    maxDisplacementMm: r(report.maxDisplacementMm),
    /** Vértices que las opciones dejan mover (base de la cobertura). */
    movableVertices: report.movableVertices,
    /** Vértices fijados o amortiguados por la protección local ante daño (triángulos que se invertían o cortaban). */
    damageProtectedVertices: report.damageProtectedVertices,
    /** % de los movibles suavizados con al menos el 80 % de la intensidad pedida. */
    strengthCoveragePct: r(100 * report.strengthCoverage, 2),
    /** Rondas extra por daño (protección local y, como último recurso, fuerza a la mitad); 0 = salió al primer intento. */
    reducedAttempts: Math.max(0, report.attempts.length - 1),
  };
}
