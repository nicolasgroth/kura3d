/**
 * @file src/components/__tests__/ImportMenuButtonHelp.test.tsx
 * @description «Importar 3D» y «Opciones de importación» de la barra superior se registran en la ayuda de controles
 * (`data-help`): el tooltip propio también aparece al llegar con Tab, y conservan nombre accesible y `title`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { ImportMenuButton } from '../ImportMenuButton';
import { isHelpId } from '../shell/controlHelp';

describe('ImportMenuButton: ayuda de controles', () => {
  beforeEach(() => useKuraStore.setState({ language: 'es' }));

  it('ambos botones tienen data-help registrado, nombre accesible y title', () => {
    render(<ImportMenuButton />);
    const main = screen.getByRole('button', { name: t('es', 'topbar.importModel') });
    const opts = screen.getByRole('button', { name: t('es', 'import.menu') });
    expect(main.dataset.help).toBe('top.import');
    expect(opts.dataset.help).toBe('top.importOptions');
    expect(isHelpId(main.dataset.help)).toBe(true);
    expect(isHelpId(opts.dataset.help)).toBe(true);
    expect(main.title).toContain(t('es', 'topbar.importModelTip'));
    expect(opts.title).toBeTruthy();
  });
});
