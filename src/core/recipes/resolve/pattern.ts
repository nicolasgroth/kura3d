/**
 * @file src/core/recipes/resolve/pattern.ts
 * @description Expansión acotada de `pattern` (linear, grid, circular, corners, points) en instancias con sus
 * variables `i`, `n`, `x`, `y`, `z`. La cantidad se evalúa primero y se compara con `max` antes de generar nada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { RecipeError, joinPath } from '../errors';
import type { ExprLocal } from '../expression/compile';
import type { RecipeStep } from '../schema/recipeSchema';

export type PatternLocals = Readonly<Record<ExprLocal, number>>;
type Pattern = NonNullable<RecipeStep['pattern']>;
type NumOrExpr = number | string;

/** Evalúa un campo numérico del patrón (literal o expresión) con su ruta. */
export type NumberAt = (value: NumOrExpr, path: string, locals?: PatternLocals) => number;

function countOf(value: number, path: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RecipeError('pattern.count', path, { detail: value });
  return value;
}

function checkMax(count: number, max: number, path: string): void {
  if (count > max) throw new RecipeError('pattern.overMax', path, { count, max });
}


/** Sin `-0`: las instancias se comparan y se guardan como JSON. */
const zero = (v: number) => (v === 0 ? 0 : v);

export function expandPattern(pattern: Pattern, num: NumberAt, base: string): PatternLocals[] {
  return rawInstances(pattern, num, base).map((l) => ({ i: l.i, n: l.n, x: zero(l.x), y: zero(l.y), z: zero(l.z) }));
}

function rawInstances(pattern: Pattern, num: NumberAt, base: string): PatternLocals[] {
  const at = (field: string) => joinPath(base, field);
  switch (pattern.kind) {
    case 'linear': {
      const n = countOf(num(pattern.count, at('count')), at('count'));
      checkMax(n, pattern.max, at('count'));
      const step = pattern.step.map((v, k) => num(v, joinPath(at('step'), k)));
      const shift = pattern.centered ? (n - 1) / 2 : 0;
      return Array.from({ length: n }, (_, i) => ({ i, n, x: (i - shift) * step[0], y: (i - shift) * step[1], z: (i - shift) * step[2] }));
    }
    case 'grid': {
      const nx = countOf(num(pattern.nx, at('nx')), at('nx'));
      const ny = countOf(num(pattern.ny, at('ny')), at('ny'));
      const n = nx * ny;
      checkMax(n, pattern.max, at('nx'));
      const dx = num(pattern.dx, at('dx'));
      const dy = num(pattern.dy, at('dy'));
      const sx = pattern.centered ? (nx - 1) / 2 : 0;
      const sy = pattern.centered ? (ny - 1) / 2 : 0;
      return Array.from({ length: n }, (_, i) => ({ i, n, x: ((i % nx) - sx) * dx, y: (Math.floor(i / nx) - sy) * dy, z: 0 }));
    }
    case 'circular': {
      const n = countOf(num(pattern.count, at('count')), at('count'));
      checkMax(n, pattern.max, at('count'));
      const radius = num(pattern.radius, at('radius'));
      const start = pattern.startDeg === undefined ? 0 : num(pattern.startDeg, at('startDeg'));
      return Array.from({ length: n }, (_, i) => {
        const angle = ((start + (i * 360) / n) * Math.PI) / 180;
        const snap = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
        return { i, n, x: snap(radius * Math.cos(angle)), y: snap(radius * Math.sin(angle)), z: 0 };
      });
    }
    case 'corners': {
      checkMax(4, pattern.max, at('max'));
      const hw = num(pattern.width, at('width')) / 2;
      const hd = num(pattern.depth, at('depth')) / 2;
      const signs: ReadonlyArray<readonly [number, number]> = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      return signs.map(([sx, sy], i) => ({ i, n: 4, x: sx * hw, y: sy * hd, z: 0 }));
    }
    case 'points': {
      const n = pattern.points.length;
      checkMax(n, pattern.max, at('points'));
      return pattern.points.map((point, i) => {
        const p = joinPath(at('points'), i);
        return { i, n, x: num(point[0], joinPath(p, 0)), y: num(point[1], joinPath(p, 1)), z: num(point[2], joinPath(p, 2)) };
      });
    }
  }
}
