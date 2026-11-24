/**
 * @file src/core/recipes/__tests__/builtinLabels.test.ts
 * @description Recetas incorporadas en los 6 idiomas: ningún formulario repite etiquetas, cada idioma trae las
 * mismas claves que el español con sus {marcadores}, y el texto es propio (no el respaldo en inglés), salvo nombres
 * propios y palabras que de verdad se escriben igual.
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

const LANGS = ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const;
/** Textos que en ese idioma se escriben igual que en inglés (nombres propios, préstamos, siglas). */
const SAME_AS_EN: Record<string, readonly string[]> = {
  de: ['Text', 'Logo (SVG)', 'Chile', 'USA', 'Box'],
  fr: ['Logo (SVG)', 'Dimensions', 'Modules'],
  hi: [],
  zh: [],
};

function labelOf(recipe: RecipeLike, raw: string, lang: string): string {
  if (!raw.startsWith('$t:')) return raw;
  const key = raw.slice(3);
  return recipe.strings?.[lang]?.[key] ?? recipe.strings?.en?.[key] ?? recipe.strings?.es?.[key] ?? raw;
}

const marks = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

describe('recetas incorporadas: textos en los 6 idiomas', () => {
  for (const recipe of BUILTIN_RECIPES as RecipeLike[]) {
    for (const lang of LANGS) {
      it(`${recipe.id} (${lang}) no repite etiquetas`, () => {
        const labels = (recipe.params ?? []).map((p) => labelOf(recipe, p.label, lang).trim().toLocaleLowerCase(lang));
        const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
        expect(dupes).toEqual([]);
      });

      it(`${recipe.id} (${lang}) trae las mismas claves que el español, con sus marcadores`, () => {
        const es = recipe.strings?.es ?? {};
        const own = recipe.strings?.[lang] ?? {};
        expect(Object.keys(own).sort()).toEqual(Object.keys(es).sort());
        for (const key of Object.keys(es)) {
          expect(own[key].trim().length, `${lang}:${key} vacío`).toBeGreaterThan(0);
          expect(marks(own[key]), `${lang}:${key} marcadores`).toEqual(marks(es[key]));
        }
      });

      if (lang !== 'es' && lang !== 'en') {
        it(`${recipe.id} (${lang}) tiene texto propio, no el respaldo en inglés`, () => {
          const en = recipe.strings?.en ?? {};
          const own = recipe.strings?.[lang] ?? {};
          const copied = Object.keys(en).filter((k) => own[k] === en[k] && !SAME_AS_EN[lang].includes(en[k]));
          expect(copied).toEqual([]);
        });
      }
    }
  }

  it('el selector Relieve/Grabado del llavero se llama «Acabado del texto» / «Text finish»', () => {
    const recipe = (BUILTIN_RECIPES as RecipeLike[]).find((r) => r.id === 'kura.llavero')!;
    const mode = recipe.params!.find((p) => p.id === 'mode')!;
    expect(labelOf(recipe, mode.label, 'es')).toBe('Acabado del texto');
    expect(labelOf(recipe, mode.label, 'en')).toBe('Text finish');
  });
});
