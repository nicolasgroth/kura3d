/**
 * @file src/core/__tests__/parametricTextFields.test.ts
 * @description Los campos del texto 3D incluyen espaciado (con el rango del motor), alineación
 * y un texto multilínea.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { PRIMITIVE_PARAM_RANGES, TEXT_ALIGN_OPTIONS } from '../../engine/primitiveLimits';
import { primitiveParamFields } from '../scene/parametric';

describe('campos paramétricos del texto 3D', () => {
  const fields = primitiveParamFields('text');

  it('el texto admite varias líneas', () => {
    const text = fields.find((f) => f.key === 'text');
    expect(text).toMatchObject({ kind: 'text', multiline: true });
  });

  it('el espaciado usa el rango del motor', () => {
    const spacing = fields.find((f) => f.key === 'letterSpacing');
    expect(spacing).toMatchObject({ kind: 'length', defaultValue: 0 });
    expect(spacing && 'range' in spacing ? spacing.range : null).toEqual(PRIMITIVE_PARAM_RANGES.letterSpacing);
  });

  it('la alineación ofrece izquierda, centro y derecha', () => {
    const align = fields.find((f) => f.key === 'textAlign');
    expect(align).toMatchObject({ kind: 'select', defaultValue: 'left' });
    expect(align && 'options' in align ? align.options : []).toEqual([...TEXT_ALIGN_OPTIONS]);
  });
});
