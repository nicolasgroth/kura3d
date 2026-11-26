/**
 * @file src/engine/threadPairFit.ts
 * @description Verificación de enroscado de una pareja de roscas métricas ISO (perno + tuerca, o agujero roscado +
 * perno) con la holgura pedida: arma en Z la rosca del perno y un anillo con la rosca interior (el mismo macho
 * negativo que usan la tuerca y el agujero), y mide con `screwFit.ts` el volumen de intersección y la holgura mínima
 * mientras se desenrosca una vuelta. La geometría es la misma que genera `createMetricThread`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { initManifoldEngine, meshDataToManifold } from './manifoldKernel';
import { checkScrewFitSolids, type ScrewFitReport } from './screwFit';
import { BOLT_PROFILE_BREAKS, buildHelicalThreadMesh, resolveThreadOptions, threadRadii, type ThreadRequest } from './threads';
import { withWasmScope } from './wasmScope';

/** Mide la pareja de `diameterMm`, `pitchMm`, `lengthMm` (largo enroscado) y `clearanceMm` (de la hembra). */
export async function isoThreadPairFit(request: Omit<ThreadRequest, 'kind' | 'includeHead'>, samples = 6): Promise<ScrewFitReport> {
  const spec = resolveThreadOptions({ ...request, kind: 'nut' });
  const wasm = await initManifoldEngine();
  const { boltMinor, boltMajor, tapMinor, tapMajor, tapBreaks } = threadRadii(spec);
  const P = spec.pitchMm;
  const L = spec.lengthMm;
  return withWasmScope((scope) => {
    const mesh = (rMin: number, rMaj: number, z0: number, z1: number, breaks: typeof tapBreaks) =>
      scope.track(meshDataToManifold(wasm, buildHelicalThreadMesh(rMin, rMaj, P, z0, z1, spec.columns, breaks)));
    const bolt = mesh(boltMinor, boltMajor, 0, L + 2 * P, BOLT_PROFILE_BREAKS);
    const ringR = tapMajor + Math.max(1.2, P);
    const ring = scope.track(scope.track(wasm.Manifold.cylinder(L, ringR, ringR, spec.columns, false)).translate([0, 0, P]));
    const tap = mesh(tapMinor, tapMajor, P - 1, P + L + 1, tapBreaks);
    const female = scope.track(ring.subtract(tap));
    return checkScrewFitSolids(wasm, bolt, female, { leadMm: P, turns: 1, samples, direction: 1 });
  });
}
