/**
 * @file src/store/referenceOpacityStore.ts
 * @description Opacidad global por defecto de las referencias (Ajustes). Es una preferencia del
 * usuario (navegador), no del proyecto: cada referencia puede llevar su propia opacidad en el `.kura`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { create } from 'zustand';
import { clampReferenceOpacity, REFERENCE_OPACITY } from '../core/scene/objectRole';
import type { SceneObject } from '../types/kura';
import { readStorage, writeStorage } from './preferencesStorage';

export const STORAGE_REFERENCE_OPACITY_KEY = 'kura3d-reference-opacity';

function loadInitial(): number {
  const raw = readStorage(STORAGE_REFERENCE_OPACITY_KEY);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? clampReferenceOpacity(value) : REFERENCE_OPACITY.default;
}

interface ReferenceOpacityState {
  defaultOpacity: number;
  setDefaultOpacity: (value: number) => void;
}

export const useReferenceOpacityStore = create<ReferenceOpacityState>((set) => ({
  defaultOpacity: loadInitial(),
  setDefaultOpacity: (value) => {
    const next = clampReferenceOpacity(value);
    writeStorage(STORAGE_REFERENCE_OPACITY_KEY, String(next));
    set({ defaultOpacity: next });
  },
}));

/** Opacidad efectiva de una referencia: la propia o la global. */
export const effectiveReferenceOpacity = (obj: Pick<SceneObject, 'referenceOpacity'>, fallback: number): number =>
  clampReferenceOpacity(obj.referenceOpacity ?? fallback);
