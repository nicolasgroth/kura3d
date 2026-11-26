/**
 * @file src/ai/toolValidation.test.ts
 * @description Pruebas de la lista permitida de herramientas IA y de la validación de parámetros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { KURA_TOOL_SCHEMAS } from './toolSchemas';
import { validateToolCall } from './toolValidation';

describe('validateToolCall', () => {
  it('accepts every declared tool with empty or valid arguments', () => {
    for (const schema of KURA_TOOL_SCHEMAS) {
      if (schema.parameters.required?.length) continue;
      expect(validateToolCall(schema.name, {}).ok, schema.name).toBe(true);
    }
    const result = validateToolCall('create_primitive', {
      type: 'box', width: 20, height: 10, depth: 5, color: '#aabbcc', name: 'Caja',
    });
    expect(result).toEqual({
      ok: true,
      request: {
        command: 'create_primitive',
        params: { type: 'box', width: 20, height: 10, depth: 5, color: '#aabbcc', name: 'Caja' },
      },
    });
  });

  it('rejects commands that exist on the command bus but are not exposed to providers', () => {
    for (const name of ['import_svg', 'set_printer_profile', 'capture_viewport', 'eval', '', 42, null]) {
      expect(validateToolCall(name, {}).ok, String(name)).toBe(false);
    }
  });

  it('parses JSON string arguments and rejects malformed JSON instead of running with defaults', () => {
    expect(validateToolCall('hollow_object', '{"wallThickness":2}').ok).toBe(true);
    expect(validateToolCall('delete_object', '').ok).toBe(true);
    expect(validateToolCall('hollow_object', '{wallThickness:2').ok).toBe(false);
    expect(validateToolCall('delete_object', '[]').ok).toBe(false);
    expect(validateToolCall('delete_object', 'null').ok).toBe(false);
  });

  it('rejects undeclared parameters, including prototype keys', () => {
    expect(validateToolCall('delete_object', { id: 'a', force: true }).ok).toBe(false);
    expect(validateToolCall('delete_object', JSON.parse('{"__proto__":{"x":1}}')).ok).toBe(false);
    expect(validateToolCall('delete_object', { constructor: 'x' }).ok).toBe(false);
  });

  it('enforces types, enums, ranges and required parameters', () => {
    const bad: Array<[string, unknown]> = [
      ['create_primitive', {}],
      ['create_primitive', { type: 'pyramid' }],
      ['create_primitive', { type: 'box', width: -1 }],
      ['create_primitive', { type: 'box', width: Number.POSITIVE_INFINITY }],
      ['create_primitive', { type: 'box', width: 1e9 }],
      ['create_primitive', { type: 'box', width: '20' }],
      ['create_primitive', { type: 'box', color: 'red' }],
      ['create_primitive', { type: 'text', text: 'x'.repeat(501) }],
      ['transform_object', { position: [1, 2] }],
      ['transform_object', { position: [1, 2, 'x'] }],
      ['transform_object', { dropToBed: 'yes' }],
      ['boolean_operation', { op: 'xor' }],
      ['plane_cut', { connectorCount: 2.5 }],
      ['plane_cut', { connectorCount: 1000 }],
      ['plane_cut', { tolerance: -0.1 }],
      ['hollow_object', { wallThickness: 0 }],
      ['apply_texture', { pattern: 'fuzzy', scale: Number.NaN }],
    ];
    for (const [name, args] of bad) {
      expect(validateToolCall(name, args).ok, `${name} ${JSON.stringify(args)}`).toBe(false);
    }
  });

  it('applies the shared operation ranges (operationLimits), the same as the command bus', () => {
    const bad: Array<[string, unknown]> = [
      ['transform_object', { scale: [0, 1, 1] }],
      ['transform_object', { scale: [-1, 1, 1] }],
      ['transform_object', { scale: [99999, 1, 1] }],
      ['transform_object', { position: [1e6, 0, 0] }],
      ['hollow_object', { wallThickness: 1e5 }],
      ['hollow_object', { wallThickness: 0.1 }],
      ['plane_cut', { connectorCount: 9 }],
      ['plane_cut', { connectorCount: 64 }],
      ['plane_cut', { tolerance: 6 }],
      ['apply_texture', { pattern: 'fuzzy', depth: 99999 }],
      ['apply_texture', { pattern: 'fuzzy', scale: 0 }],
    ];
    for (const [name, args] of bad) {
      expect(validateToolCall(name, args).ok, `${name} ${JSON.stringify(args)}`).toBe(false);
    }
    const good: Array<[string, unknown]> = [
      ['transform_object', { scale: [0.001, 1000, 1] }],
      ['hollow_object', { wallThickness: 100 }],
      ['plane_cut', { connectorCount: 0 }],
      ['plane_cut', { connectorCount: 8 }],
      ['apply_texture', { pattern: 'fuzzy', depth: 0, scale: 1000 }],
    ];
    for (const [name, args] of good) {
      expect(validateToolCall(name, args).ok, `${name} ${JSON.stringify(args)}`).toBe(true);
    }
  });

  it('drops null values and copies arrays so the provider payload cannot be mutated later', () => {
    const position = [1, 2, 3];
    const result = validateToolCall('transform_object', { id: null, position });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.params).toEqual({ position: [1, 2, 3] });
    expect(result.request.params.position).not.toBe(position);
  });
});
