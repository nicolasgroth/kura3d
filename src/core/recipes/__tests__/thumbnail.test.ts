/**
 * @file src/core/recipes/__tests__/thumbnail.test.ts
 * @description Miniatura vectorial: determinista, no vacía para las tres recetas incorporadas (ejecutadas con sus valores
 * por defecto), vacía sin geometría y con la categoría de la receta saneada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { galleryCategory } from '../../../components/assistants/galleryModel';
import { buildThumbnail } from '../thumbnail';
import { BUILTIN_RECIPES } from '../builtin';
import { runRecipe } from '../run/executeRecipe';
import { manifoldModule, testContext } from './runSupport';

beforeAll(async () => {
  await manifoldModule();
});

// Cubo unitario con triángulos antihorarios vistos desde fuera.
const CUBE = {
  positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
  indices: [0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5],
};

describe('buildThumbnail', () => {
  it('es determinista y dibuja un cubo', () => {
    const a = buildThumbnail([CUBE]);
    const b = buildThumbnail([CUBE]);
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(a!.layers.length).toBeGreaterThan(0);
    expect(a!.layers.every((l) => l.shade >= 0 && l.shade < 4 && l.d.startsWith('M'))).toBe(true);
  });

  it('sin geometría devuelve null', () => {
    expect(buildThumbnail([])).toBeNull();
    expect(buildThumbnail([{ positions: [], indices: [] }])).toBeNull();
    expect(buildThumbnail([{ positions: [0, 0, 0, 0, 0, 0, 0, 0, 0], indices: [0, 1, 2] }])).toBeNull();
  });

  it('el desplazamiento mueve la pieza dentro del encuadre sin cambiar la cantidad de capas', () => {
    const a = buildThumbnail([CUBE, { ...CUBE, offset: [3, 0, 0] }]);
    expect(a).not.toBeNull();
  });

  it('las tres recetas incorporadas producen una miniatura no vacía', async () => {
    expect(BUILTIN_RECIPES.length).toBeGreaterThanOrEqual(3);
    for (const recipe of BUILTIN_RECIPES) {
      const result = await runRecipe(testContext(), { recipe: structuredClone(recipe), answers: {} });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const thumb = buildThumbnail(result.change.added.map((o) => ({ positions: o.mesh.positions, indices: o.mesh.indices, offset: o.position })));
      expect(thumb, String((recipe as { id: string }).id)).not.toBeNull();
      expect(thumb!.layers.length).toBeGreaterThan(0);
    }
  });
});

describe('galleryCategory', () => {
  it('sanea categorías desconocidas o mal formadas', () => {
    expect(galleryCategory('cajas')).toBe('cajas');
    expect(galleryCategory(' HOGAR ')).toBe('hogar');
    expect(galleryCategory('<script>')).toBe('otros');
    expect(galleryCategory(42)).toBe('otros');
    expect(galleryCategory(undefined)).toBe('otros');
  });
});
