/**
 * @file src/utils/aiToolLabels.test.ts
 * @description Cada herramienta del catálogo IA tiene texto natural en los 6 idiomas y nunca expone su identificador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { KURA_TOOL_SCHEMAS } from '../ai/toolSchemas';
import { SUPPORTED_LANGUAGES } from '../types/kura';
import { toolLabel, toolLabelKey } from './aiToolLabels';

describe('etiquetas de herramientas del chat', () => {
  it('mapea todas las herramientas del catálogo sin caer en la genérica', () => {
    for (const schema of KURA_TOOL_SCHEMAS) {
      expect(toolLabelKey(schema.name), schema.name).not.toBe('ai.tool.unknown');
    }
  });

  it('no muestra identificadores internos en ningún idioma', () => {
    const languages = SUPPORTED_LANGUAGES.map((entry) => entry.code);
    expect(languages.length).toBe(6);
    for (const language of languages) {
      for (const schema of KURA_TOOL_SCHEMAS) {
        const text = toolLabel(language, schema.name);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toContain('_');
      }
    }
  });

  it('usa un texto genérico para herramientas desconocidas', () => {
    expect(toolLabelKey('algo_raro')).toBe('ai.tool.unknown');
    expect(toolLabelKey('__proto__')).toBe('ai.tool.unknown');
    expect(toolLabelKey(undefined)).toBe('ai.tool.unknown');
  });
});
