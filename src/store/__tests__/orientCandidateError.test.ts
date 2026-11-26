/**
 * @file src/store/__tests__/orientCandidateError.test.ts
 * @description `apply_orientation` con un candidato que no existe: error `not-found` con `id` limpio y `available`
 * como parámetro propio (antes iba mezclado dentro de `id`), y el texto lo dice en los 6 idiomas.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import type { OrientAnalysis } from '../../engine/orient';
import { t } from '../../i18n';
import { findOrientCandidate } from '../orientCommandSchemas';

describe('apply_orientation: candidato inválido', () => {
  it('separa available de id', () => {
    const analysis = { candidates: [{ id: 'current' }, { id: 'axis+z' }] } as unknown as OrientAnalysis;
    let err: { code?: string; key?: string; params?: Record<string, unknown> } = {};
    try {
      findOrientCandidate(analysis, 'nope');
    } catch (e) {
      err = e as typeof err;
    }
    expect(err.code).toBe('not-found');
    expect(err.params).toEqual({ id: 'nope', available: 'current, axis+z' });
    for (const lang of ['es', 'en', 'de', 'fr', 'hi', 'zh'] as const) {
      const text = t(lang, 'orient.error.candidateNotFound', { id: 'nope', available: 'current, axis+z' });
      expect(text).toContain('nope');
      expect(text).toContain('axis+z');
    }
  });
});
