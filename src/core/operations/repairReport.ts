/**
 * @file src/core/operations/repairReport.ts
 * @description Respuesta pública (Command Bus y MCP sin interfaz, misma forma) de "Reparar malla" y
 * del diagnóstico: conteos de defectos antes y después, acciones hechas y agujeros (tamaño y centro en
 * ejes del usuario, coordenadas locales del objeto). Sin segmentos del visor ni datos internos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { MeshDiagnosisSummary, MeshHole, MeshRepairReport } from '../../engine';
import { toUserVector } from '../scene/displayAxes';

const MAX_REPORTED_HOLES = 10;
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

/** Agujero en ejes del usuario. */
export function holeToUser(h: MeshHole) {
  return { sizeMm: round(h.sizeMm), vertices: h.vertices, centerLocal: toUserVector(h.center).map((x) => round(x)) };
}

/** Diagnóstico en ejes del usuario. */
export function diagnosisToUser(d: MeshDiagnosisSummary) {
  return {
    closed: d.closed,
    clean: d.clean,
    triangles: d.triangles,
    holes: d.holeCount,
    openEdges: d.boundaryEdges,
    nonManifoldEdges: d.nonManifoldEdges,
    misorientedEdges: d.misorientedEdges,
    invertedShells: d.invertedShells,
    duplicateFaces: d.duplicateFaces,
    degenerateFaces: d.degenerateFaces,
    shells: d.shells,
    tinyShells: d.tinyShells,
    largestHoles: d.holes.slice(0, MAX_REPORTED_HOLES).map(holeToUser),
  };
}

/** Informe de reparación en ejes del usuario. */
export function repairReportToUser(r: MeshRepairReport) {
  return {
    changed: r.changed,
    before: diagnosisToUser(r.before),
    after: diagnosisToUser(r.after),
    actions: {
      mergedVertices: r.mergedVertices,
      removedDegenerateFaces: r.removedDegenerate,
      removedDuplicateFaces: r.removedDuplicate,
      splitNonManifoldVertices: r.splitVertices,
      droppedNonManifoldFaces: r.droppedFaces,
      flippedFaces: r.flippedFaces,
      filledHoles: r.filledHoles,
      addedTriangles: r.addedTriangles,
      removedShells: r.removedShells,
      reorientedShells: r.reorientedShells,
    },
    unfilledHoles: r.unfilledHoles.slice(0, MAX_REPORTED_HOLES).map(holeToUser),
  };
}
