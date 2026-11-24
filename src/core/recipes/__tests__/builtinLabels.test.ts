/**
 * @file src/core/recipes/__tests__/builtinLabels.test.ts
 * @description Ninguna receta incorporada muestra dos parámetros con la misma etiqueta visible (en es y en).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPES } from '../builtin';

interface RecipeLike {
  id: string;
  params?: { id: string; label: string }[];
  strings?: Record<string, Record<string, string>>;
}

function labelOf(recipe: RecipeLike, raw: string, lang: string): string {
  if (!raw.startsWith('$t:')) return raw;
  const key = raw.slice(3);
  return recipe.strings?.[lang]?.[key] ?? recipe.strings?.en?.[key] ?? recipe.strings?.es?.[key] ?? raw;
}

describe('recetas incorporadas: etiquetas de parámetros', () => {
  for (const recipe of BUILTIN_RECIPES as RecipeLike[]) {
    for (const lang of ['es', 'en']) {
      it(`${recipe.id} (${lang}) no repite etiquetas`, () => {
        const labels = (recipe.params ?? []).map((p) => labelOf(recipe, p.label, lang).trim().toLocaleLowerCase(lang));
        const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
        expect(dupes).toEqual([]);
      });
    }
  }

  it('el selector Relieve/Grabado del llavero se llama «Acabado del texto» / «Text finish»', () => {
    const recipe = (BUILTIN_RECIPES as RecipeLike[]).find((r) => r.id === 'kura.llavero')!;
    const mode = recipe.params!.find((p) => p.id === 'mode')!;
    expect(labelOf(recipe, mode.label, 'es')).toBe('Acabado del texto');
    expect(labelOf(recipe, mode.label, 'en')).toBe('Text finish');
  });
});
