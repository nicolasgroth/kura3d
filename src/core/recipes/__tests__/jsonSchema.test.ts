/**
 * @file src/core/recipes/__tests__/jsonSchema.test.ts
 * @description El JSON Schema publicado en `docs/recetas/` coincide con el que genera el esquema zod (si cambia el
 * esquema, hay que correr `npm run recetas:schema`), es estricto y exige `max` en cada patrón.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { recipeJsonSchema, recipeJsonSchemaText } from '../schema/jsonSchema';

const FILES = import.meta.glob('../../../../docs/recetas/kura.recipe-1.schema.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('JSON Schema de kura.recipe/1', () => {
  it('el archivo publicado está al día (npm run recetas:schema)', () => {
    const files = Object.values(FILES);
    expect(files).toHaveLength(1);
    const published = files[0].replace(/\r\n/g, '\n');
    expect(published).toBe(recipeJsonSchemaText());
  });

  it('es estricto, exige format/id/version y max en cada patrón', () => {
    const schema = recipeJsonSchema() as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining(['format', 'id', 'version', 'title', 'author', 'license']));
    const patterns = schema.properties.steps.items.properties.pattern.oneOf ?? schema.properties.steps.items.properties.pattern.anyOf;
    expect(patterns).toHaveLength(5);
    for (const variant of patterns) {
      expect(variant.required).toContain('max');
      expect(variant.properties.max.maximum).toBe(256);
      expect(variant.additionalProperties).toBe(false);
    }
  });
});
