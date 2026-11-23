/**
 * @file src/core/recipes/__tests__/fixtures.ts
 * @description Recetas de prueba: los tres ejemplos del diseño (`examples/*.recipe.json`) y una receta mínima que
 * las pruebas hostiles modifican campo por campo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import caja from '../examples/caja-tapa.recipe.json';
import placa from '../examples/placa-enchufe.recipe.json';
import llavero from '../examples/llavero.recipe.json';

export const EXAMPLES = { caja, placa, llavero } as const;

/** Copia profunda editable (las pruebas mutan sin tocar el original). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Receta mínima válida: un parámetro, un derivado, una regla y un paso. */
export function minimal(): Record<string, unknown> {
  return {
    format: 'kura.recipe/1',
    id: 'test.minima',
    version: '1.0.0',
    title: 'Mínima',
    author: 'Pruebas',
    license: 'MIT',
    params: [{ id: 'w', type: 'number', unit: 'mm', min: 1, max: 100, default: 10, label: 'Ancho' }],
    derive: { half: '=p.w / 2' },
    rules: [{ level: 'warning', when: '=p.w < 2', message: 'Muy delgado' }],
    steps: [{ id: 'cube', op: 'create_primitive', args: { type: 'box', params: { width: '=p.w', depth: '=d.half', height: 5 } } }],
    outputs: [{ ref: '@cube', name: 'Cubo' }],
  };
}
