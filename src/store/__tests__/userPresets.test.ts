// @vitest-environment jsdom
/**
 * @file src/store/__tests__/userPresets.test.ts
 * @description Preajustes del usuario (genéricos, probados con imanes): guardar, reemplazar por nombre, eliminar,
 * persistir, saneo de datos corruptos al leer y tope de cantidad. También los preajustes incluidos de imán.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { MAGNET_DEFAULTS } from '../../core/addons/magnetPocket';
import { BUILTIN_MAGNET_PRESETS, MAGNET_PRESET_KIND, MAGNET_PRESET_STORAGE_KEY, magnetSizeLabel } from '../../core/addons/magnetPresets';
import { createUserPresetsStore, loadUserPresets, MAX_USER_PRESETS } from '../userPresets';

const big = { ...MAGNET_DEFAULTS, sizeMm: 12, heightMm: 4 };

describe('preajustes de usuario', () => {
  beforeEach(() => localStorage.clear());

  it('guarda, persiste y elimina', () => {
    const store = createUserPresetsStore(MAGNET_PRESET_KIND);
    const r = store.getState().save('  Mis   12 × 4 ', big);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preset.name).toBe('Mis 12 × 4');
    // Otra instancia (otra carga de la app) lo lee igual.
    expect(createUserPresetsStore(MAGNET_PRESET_KIND).getState().presets).toEqual([r.preset]);
    expect(store.getState().remove(r.preset.id)?.name).toBe('Mis 12 × 4');
    expect(store.getState().presets).toEqual([]);
    expect(localStorage.getItem(MAGNET_PRESET_STORAGE_KEY)).toBeNull();
  });

  it('el mismo nombre reemplaza los valores; nombre vacío o valores inválidos no se guardan', () => {
    const store = createUserPresetsStore(MAGNET_PRESET_KIND);
    store.getState().save('Tapa', big);
    const again = store.getState().save('tapa', { ...big, sizeMm: 8 });
    expect(again.ok && again.preset.values.sizeMm).toBe(8);
    expect(store.getState().presets).toHaveLength(1);
    expect(store.getState().save('   ', big)).toEqual({ ok: false, reason: 'name' });
    expect(store.getState().save('x'.repeat(41), big)).toEqual({ ok: false, reason: 'name' });
    expect(store.getState().save('malo', { ...big, clearanceMm: 2 })).toEqual({ ok: false, reason: 'values' });
  });

  it('tope de cantidad', () => {
    const store = createUserPresetsStore(MAGNET_PRESET_KIND);
    for (let i = 0; i < MAX_USER_PRESETS; i++) expect(store.getState().save(`p${i}`, big).ok).toBe(true);
    expect(store.getState().save('uno más', big)).toEqual({ ok: false, reason: 'full' });
    expect(store.getState().presets).toHaveLength(MAX_USER_PRESETS);
  });

  it('sanea lo guardado: descarta corruptos, ids raros, duplicados y respeta el tope', () => {
    const ok = { id: 'user-abc-1', name: 'Bueno', values: big };
    const list = [
      ok,
      { ...ok }, // id repetido
      { id: 'otro-1', name: 'id ajeno', values: big },
      { id: 'user-x', name: '', values: big },
      { id: 'user-y', name: 'valores malos', values: { ...big, sizeMm: -1 } },
      { id: 'user-z', name: 'forma rara', values: { ...big, shape: 'hex' } },
      { id: 'user-w', name: 'proto', values: JSON.parse('{"__proto__":{"x":1},"shape":"round","sizeMm":5,"heightMm":2}') },
      null, 7, 'texto', [1, 2],
      ...Array.from({ length: 40 }, (_, i) => ({ id: `user-n${i}`, name: `n${i}`, values: big })),
    ];
    localStorage.setItem(MAGNET_PRESET_STORAGE_KEY, JSON.stringify(list));
    const loaded = loadUserPresets(MAGNET_PRESET_KIND);
    expect(loaded[0]).toEqual(ok);
    expect(loaded.find((p) => p.id === 'user-w')?.values).toEqual({ ...MAGNET_DEFAULTS, sizeMm: 5, heightMm: 2 });
    expect(loaded.map((p) => p.id)).not.toContain('otro-1');
    expect(loaded.map((p) => p.id)).not.toContain('user-y');
    expect(loaded).toHaveLength(MAX_USER_PRESETS);
    localStorage.setItem(MAGNET_PRESET_STORAGE_KEY, '{no es json');
    expect(loadUserPresets(MAGNET_PRESET_KIND)).toEqual([]);
    localStorage.setItem(MAGNET_PRESET_STORAGE_KEY, '{"a":1}');
    expect(loadUserPresets(MAGNET_PRESET_KIND)).toEqual([]);
  });
});

describe('preajustes incluidos de imán', () => {
  it('trae 5 × 2 (por defecto), 6 × 3, 8 × 3, 10 × 3 y cuadrado 5 × 5 × 2', () => {
    expect(BUILTIN_MAGNET_PRESETS[0].values).toEqual(MAGNET_DEFAULTS);
    expect(BUILTIN_MAGNET_PRESETS.map((p) => magnetSizeLabel(p.values))).toEqual(['5 × 2', '6 × 3', '8 × 3', '10 × 3', '5 × 5 × 2']);
    expect(magnetSizeLabel({ shape: 'round', sizeMm: 6.5, heightMm: 2 }, 'es')).toBe('6,5 × 2');
    expect(magnetSizeLabel({ shape: 'round', sizeMm: 6.5, heightMm: 2 }, 'en')).toBe('6.5 × 2');
  });
});
