/**
 * @file src/store/__tests__/renameProject.test.ts
 * @description `renameProject` aplica en el store el mismo límite (`PROJECT_NAME_MAX`) y el mismo saneado que el campo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { PROJECT_NAME_MAX } from '../../project/projectFiles';
import { useKuraStore } from '../useKuraStore';

describe('renameProject', () => {
  beforeEach(() => {
    useKuraStore.setState({ projectName: null, projectBusy: false, projectRenamed: false } as never);
  });

  it('recorta un nombre de 300 caracteres al máximo compartido', () => {
    expect(useKuraStore.getState().renameProject('a'.repeat(300))).toBe(true);
    expect(useKuraStore.getState().projectName).toBe(`${'a'.repeat(PROJECT_NAME_MAX)}.kura`);
  });

  it('sanea caracteres prohibidos y rechaza el vacío', () => {
    expect(useKuraStore.getState().renameProject('  mi/pieza:1  ')).toBe(true);
    expect(useKuraStore.getState().projectName).toBe('mi_pieza_1.kura');
    expect(useKuraStore.getState().renameProject('   ')).toBe(false);
  });
});
