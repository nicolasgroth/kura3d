/**
 * @file src/components/__tests__/AssistantsParity.test.ts
 * @description Paridad del formulario de Asistentes con las recetas incorporadas: el modelo se genera para las tres
 * en los 6 idiomas y con cada variante, sin parámetros de tipo desconocido ni etiquetas vacías, y cada campo visible
 * corresponde a un parámetro de la receta en su orden. Cubre también los textos de interfaz del panel (6 idiomas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { BUILTIN_RECIPE_IDS } from '../../core/recipes/builtin';
import { TRANSLATIONS_ES } from '../../i18n/translations';
import { SUPPORTED_LANGUAGES } from '../../types/kura';
import { assistantRecipes, buildFormModel, recipeCard } from '../assistants/recipeFormModel';

const KNOWN_TYPES = new Set(['number', 'integer', 'boolean', 'choice', 'text', 'file', 'object']);
const LANGS = SUPPORTED_LANGUAGES.map((s) => s.code);

describe('Asistentes: paridad con las recetas incorporadas', () => {
  it('todas las recetas incorporadas son válidas y se listan', () => {
    expect(assistantRecipes().map((r) => r.id)).toEqual([...BUILTIN_RECIPE_IDS]);
  });

  for (const entry of assistantRecipes()) {
    describe(entry.id, () => {
      const params = entry.validated.recipe.params ?? [];

      it.each(LANGS)('el formulario se genera en %s sin tipos desconocidos ni etiquetas vacías', (language) => {
        const model = buildFormModel(entry, { answers: {}, language });
        const fields = model.groups.flatMap((g) => g.fields);
        expect(model.canCreate).toBe(true);
        expect(fields.length).toBeGreaterThan(0);
        for (const f of fields) {
          expect(KNOWN_TYPES.has(f.type), `${entry.id}.${f.id}: tipo ${f.type}`).toBe(true);
          expect(f.label.trim().length, `${entry.id}.${f.id}: etiqueta vacía`).toBeGreaterThan(0);
          expect(f.label.startsWith('$t:'), `${entry.id}.${f.id}: texto sin resolver`).toBe(false);
          if (f.type === 'choice') expect(f.options?.length).toBeGreaterThan(0);
        }
        const card = recipeCard(entry, language);
        expect(card.title.length).toBeGreaterThan(0);
        expect(card.title.startsWith('$t:')).toBe(false);
      });

      it('los campos siguen el orden de la receta y solo faltan los parámetros ocultos', () => {
        const model = buildFormModel(entry, { answers: {}, language: 'es' });
        const shown = model.groups.flatMap((g) => g.fields.map((f) => f.id));
        const order = params.map((p) => p.id).filter((id) => shown.includes(id));
        // Cada grupo conserva el orden relativo de la receta.
        for (const group of model.groups) {
          const ids = group.fields.map((f) => f.id);
          expect(ids).toEqual(order.filter((id) => ids.includes(id)));
        }
        const hidden = model.result.params.filter((p) => !p.visible).map((p) => p.id);
        expect([...shown].sort()).toEqual(params.map((p) => p.id).filter((id) => !hidden.includes(id)).sort());
      });

      it('cada variante genera un formulario con los valores de la variante', () => {
        for (const preset of entry.validated.recipe.presets ?? []) {
          const model = buildFormModel(entry, { answers: {}, variant: preset.id, language: 'es' });
          for (const [id, value] of Object.entries(preset.values)) {
            const f = model.groups.flatMap((g) => g.fields).find((x) => x.id === id);
            if (f) expect(f.value, `${entry.id}/${preset.id}.${id}`).toEqual(value);
          }
        }
      });
    });
  }

  it('los textos de interfaz de Asistentes existen en español y se usan en los 6 idiomas (paridad la verifica src/i18n)', () => {
    const keys = Object.keys(TRANSLATIONS_ES).filter((k) => k.startsWith('asis.'));
    expect(keys.length).toBeGreaterThan(30);
  });
});
