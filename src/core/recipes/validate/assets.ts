/**
 * @file src/core/recipes/validate/assets.ts
 * @description Topes de los recursos embebidos de una receta (imágenes, SVG, modelos): base64 bien formado, bytes
 * decodificados por tipo (los del importador) y total por receta. En este lote no se decodifica el contenido.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { issue, joinPath, type RecipeIssue } from '../errors';
import { RECIPE_ASSET_MAX_BYTES, RECIPE_LIMITS } from '../limits';
import type { RecipeAsset } from '../schema/recipeSchema';

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Bytes que ocupa un base64 una vez decodificado (sin decodificarlo). */
export function base64Bytes(data: string): number {
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return (data.length / 4) * 3 - padding;
}

export function checkAssets(assets: readonly RecipeAsset[]): RecipeIssue[] {
  const out: RecipeIssue[] = [];
  let total = 0;
  assets.forEach((asset, k) => {
    const at = joinPath(joinPath('assets', k), 'data');
    if (asset.data.length === 0 || asset.data.length % 4 !== 0 || !BASE64.test(asset.data)) {
      out.push(issue('asset.badData', at));
      return;
    }
    const bytes = base64Bytes(asset.data);
    const max = RECIPE_ASSET_MAX_BYTES[asset.kind];
    if (bytes > max) out.push(issue('asset.tooLarge', at, { bytes, max }));
    total += bytes;
  });
  if (total > RECIPE_LIMITS.maxAssetsTotalBytes) out.push(issue('asset.totalTooLarge', 'assets', { bytes: total, max: RECIPE_LIMITS.maxAssetsTotalBytes }));
  return out;
}
