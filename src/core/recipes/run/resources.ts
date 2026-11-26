/**
 * @file src/core/recipes/run/resources.ts
 * @description Contenido de recursos embebidos (`$asset:id`) y de archivos elegidos (`file`) para un paso. Se
 * decodifica con los mismos topes del formato (`RECIPE_ASSET_MAX_BYTES`, `maxBytes` del parámetro) y como UTF-8
 * estricto; el SVG resultante pasa después por el mismo lector del motor que una importación (`import_svg`). En esta
 * versión solo un SVG tiene una operación que lo use: los demás tipos son error tipado, no se leen.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { RecipeError } from '../errors';
import { RECIPE_ASSET_MAX_BYTES } from '../limits';
import type { Recipe } from '../schema/recipeSchema';
import { base64Bytes } from '../validate/assets';
import type { FileAnswer } from '../resolve/types';
import type { ResolvedParam } from '../resolve/types';

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function decodeBase64(data: string, at: string): Uint8Array {
  if (data.length === 0 || data.length % 4 !== 0 || !BASE64.test(data)) throw new RecipeError('run.asset', at, { detail: 'base64' });
  try {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    throw new RecipeError('run.asset', at, { detail: 'base64' });
  }
}

function utf8(bytes: Uint8Array, at: string, code: 'run.asset' | 'run.file', detail: string): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new RecipeError(code, at, { detail });
  }
}

/** Texto SVG de un recurso embebido, decodificado y acotado. */
export function assetSvgText(recipe: Recipe, id: string, at: string): string {
  const asset = recipe.assets?.find((a) => a.id === id);
  if (!asset) throw new RecipeError('ref.unknownAsset', at, { detail: id });
  if (asset.kind !== 'svg') throw new RecipeError('run.asset', at, { detail: `${asset.kind} is not usable here` });
  // Se revisa el tamaño antes de decodificar: un base64 gigante nunca llega a `atob`.
  const max = RECIPE_ASSET_MAX_BYTES.svg;
  if (base64Bytes(asset.data) > max) throw new RecipeError('asset.tooLarge', at, { bytes: base64Bytes(asset.data), max });
  return utf8(decodeBase64(asset.data, at), at, 'run.asset', 'utf-8');
}

/** Texto SVG del archivo elegido para un parámetro `file` (tipo y tamaño revisados contra el parámetro). */
export function fileSvgText(
  recipe: Recipe,
  params: readonly ResolvedParam[],
  files: Readonly<Record<string, string | Uint8Array>> | undefined,
  paramId: string,
  at: string,
): string {
  const param = recipe.params?.find((p) => p.id === paramId);
  const answer = params.find((p) => p.id === paramId)?.value as FileAnswer | null | undefined;
  const content = files && Object.prototype.hasOwnProperty.call(files, paramId) ? files[paramId] : undefined;
  if (!param || param.type !== 'file' || !answer || content === undefined) throw new RecipeError('run.file', at, { detail: paramId });
  if (answer.kind !== 'svg') throw new RecipeError('run.file', at, { detail: paramId });
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  if (bytes.byteLength > param.maxBytes || bytes.byteLength > RECIPE_ASSET_MAX_BYTES.svg) {
    throw new RecipeError('param.fileTooLarge', at, { bytes: bytes.byteLength, max: Math.min(param.maxBytes, RECIPE_ASSET_MAX_BYTES.svg) });
  }
  return typeof content === 'string' ? content : utf8(content, at, 'run.file', paramId);
}
