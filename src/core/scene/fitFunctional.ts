/**
 * @file src/core/scene/fitFunctional.ts
 * @description Chequeo tras reescalar ("Ajustar a la impresora"): detecta las partes con medida
 * funcional que hoy se conocen en la escena y que un escalado deja fuera de su medida: roscas ISO
 * generadas (siguen paramétricas), conectores guardados por Dividir para imprimir, lotes de tarugos
 * sueltos y primitivas con parámetros. No adivina medidas en mallas importadas: lo que no tiene
 * metadatos no se detecta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { FitWarning, FunctionalFeature } from '../../engine/fitToBed';
import type { SceneObject } from '../../types/kura';
import { parametricStateOf } from './parametric';

const fmt = (v: number) => String(+v.toFixed(2));

/** Partes funcionales del bloque. `keepApart` solo es posible si el bloque tiene más de un objeto. */
export function detectFunctionalFeatures(objects: readonly SceneObject[]): FunctionalFeature[] {
  const keepApart: FunctionalFeature['keepApart'] =
    objects.length > 1 ? { available: true } : { available: false, reason: 'onlyObject' };
  const out: FunctionalFeature[] = [];
  for (const obj of objects) {
    const state = parametricStateOf(obj);
    if (state.status === 'thread') {
      const t = state.options;
      out.push({ objectId: obj.id, kind: 'thread', label: `M${fmt(t.diameterMm)}x${fmt(t.pitchMm)}`, nominalMm: t.diameterMm, keepApart });
    } else if (state.status === 'primitive') {
      const p = state.params;
      const nominal = p.radius ?? p.width ?? p.height ?? p.depth;
      out.push({ objectId: obj.id, kind: 'parametricPrimitive', label: state.type, ...(nominal !== undefined ? { nominalMm: nominal } : {}), keepApart });
    }
    const joints = obj.metadata?.split?.joints ?? [];
    const withConnector = joints.find((j) => (j.kind === 'connector' || j.kind === 'socket') && j.connector);
    if (withConnector?.connector) {
      const c = withConnector.connector;
      // Un conector se funde en la malla de la pieza: no se puede sacar del escalado.
      out.push({
        objectId: obj.id, kind: 'splitConnector', label: `${c.type} ${fmt(c.size)}`, nominalMm: c.size,
        keepApart: { available: false, reason: 'mergedInMesh' },
      });
    }
    const dowel = obj.metadata?.splitDowel;
    if (dowel) {
      out.push({ objectId: obj.id, kind: 'splitDowel', label: `dowel ${fmt(dowel.diameterMm)}x${fmt(dowel.lengthMm)}`, nominalMm: dowel.diameterMm, keepApart });
    }
  }
  return out;
}

/** Avisos `FIT_FUNCTIONAL_SCALED` de un factor (vacío si no escala). */
export function functionalWarnings(features: readonly FunctionalFeature[], factor: number): FitWarning[] {
  if (!(factor < 1)) return [];
  // Las primitivas con parámetros se informan en `functional`, pero no como aviso: toda primitiva lo es
  // y el tamaño resultante ya se muestra. El aviso queda para medidas que dejan de ser estándar.
  return features.filter((f) => f.kind !== 'parametricPrimitive').map((f) => ({
    code: 'FIT_FUNCTIONAL_SCALED' as const,
    params: {
      objectId: f.objectId, feature: f.kind, label: f.label, factor,
      ...(f.nominalMm !== undefined ? { nominalMm: f.nominalMm, scaledMm: +(f.nominalMm * factor).toFixed(2) } : {}),
    },
  }));
}
