/// <reference types="vite/client" />
/**
 * @file src/store/__tests__/engineErrorWiring.test.ts
 * @description El store y el Command Bus consumen los errores y avisos tipados del motor: toasts
 * localizados en el idioma activo, avisos de refinado/ahuecado visibles, `errorCode` con el código
 * del `EngineError` y resta vacía detectada por código en vez de por geometría o texto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest';
import paletteSource from '../../components/CommandPalette.tsx?raw';
import { REFINE_UI_DEFAULTS } from '../../components/refineDefaults';
import inspectorSource from '../../components/RightInspector.tsx?raw';
import { EngineError, localizeEngineWarning, refineMeshDetailed, runBooleanOperation } from '../../engine';
import { t } from '../../i18n';
import type { KuraCommandRequest, LanguageCode } from '../../types/kura';
import type { CommandBusResponse } from '../commandBus';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const run = (command: KuraCommandRequest['command'], params: Record<string, unknown>) =>
  store().executeCommand({ id: `t_${command}`, command, params }, 'ai') as Promise<CommandBusResponse>;

const toastTexts = () => store().toasts.map((toast) => toast.text);

describe('errores del motor localizados en toasts', () => {
  it.each<LanguageCode>(['en', 'de', 'zh'])('ahuecado con pared demasiado gruesa en %s', async (lang) => {
    await resetStore(lang);
    const box = await addBox(10);
    expect(await store().hollowObject(box.id, { enabled: true, wallThickness: 6 })).toBe(false);
    const expected = t(lang, 'engineError.HOLLOW_WALL_TOO_THICK', { thickness: 6, minDim: 10 });
    expect(toastTexts().some((text) => text.includes(expected))).toBe(true);
    // Nunca el texto español del motor cuando el idioma no es español.
    expect(toastTexts().some((text) => text.includes(t('es', 'engineError.HOLLOW_WALL_TOO_THICK', { thickness: 6, minDim: 10 })))).toBe(false);
  });
});

describe('avisos del motor como toasts', () => {
  beforeEach(() => resetStore('en'));

  it('refinar con arista mayor que la malla avisa REFINE_NO_CHANGE en el idioma activo', async () => {
    const box = await addBox(10);
    const expected = (await refineMeshDetailed(byId(box.id)!, 50, false)).warnings;
    expect(expected.map((w) => w.code)).toContain('REFINE_NO_CHANGE');
    expect(await store().refineSelectedMesh(box.id, 50)).toBe(true);
    for (const warning of expected) {
      expect(toastTexts()).toContain(localizeEngineWarning('en', warning));
    }
  });
});

describe('Command Bus propaga el código del EngineError', () => {
  beforeEach(() => resetStore('fr'));

  it('hollow_object con pared imposible devuelve errorCode HOLLOW_WALL_TOO_THICK localizado', async () => {
    const box = await addBox(10);
    const res = await run('hollow_object', { id: box.id, wallThickness: 6 });
    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe('HOLLOW_WALL_TOO_THICK');
    expect(res.error).toBe(t('fr', 'engineError.HOLLOW_WALL_TOO_THICK', { thickness: 6, minDim: 10 }));
  });

  it('un fallo posterior sin error del motor no hereda el código anterior', async () => {
    const box = await addBox(10);
    await run('hollow_object', { id: box.id, wallThickness: 6 });
    const ok = await run('get_scene_state', {});
    expect(ok.ok).toBe(true);
    expect(ok.errorCode).toBeUndefined();
  });
});

describe('resta vacía con error tipado', () => {
  beforeEach(() => resetStore());

  it('el motor lanza BOOLEAN_EMPTY_RESULT cuando el hueco contiene al sólido', async () => {
    const small = await addBox(5, [0, 0, 0]);
    const hole = await addBox(30, [0, -5, 0], { role: 'negative' });
    await expect(runBooleanOperation(small, hole, 'subtract')).rejects.toMatchObject({ code: 'BOOLEAN_EMPTY_RESULT' });
    await expect(runBooleanOperation(small, hole, 'subtract')).rejects.toBeInstanceOf(EngineError);
  });
});

describe('paleta de comandos alineada con el inspector', () => {
  it('refinar desde la paleta usa los valores por defecto del inspector (sin suavizado)', () => {
    expect(REFINE_UI_DEFAULTS.smooth).toBe(false);
    expect(paletteSource).toMatch(/refineSelectedMesh\(primaryId, REFINE_UI_DEFAULTS\.edgeMm, REFINE_UI_DEFAULTS\.smooth\)/);
    expect(inspectorSource).toContain('useState<boolean>(REFINE_UI_DEFAULTS.smooth)');
  });
});
