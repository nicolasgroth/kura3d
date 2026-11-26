/**
 * @file src/store/slices/bedProfilesSlice.ts
 * @description Camas del usuario (crear, editar, duplicar, borrar) guardadas en preferencias locales,
 * y el aviso no intrusivo al abrir un proyecto cuya cama difiere de la preferida ("Usar mi cama" /
 * "Mantener la del proyecto"). La cama activa del proyecto viaja en el `.kura` (`printerProfile`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { PrinterProfile } from '../../types/kura';
import {
  bedProfileFromDraft, findBedProfile, loadUserBedProfiles, MAX_USER_BEDS, newUserBedId, sameBed, saveUserBedProfiles,
  validateBedDraft, type BedProfileDraft,
} from '../bedProfiles';
import { readStorage, STORAGE_PRINTER_KEY } from '../preferencesStorage';
import type { StoreContext } from '../storeContext';
import type { KuraStoreState } from '../storeTypes';

export interface BedProfilesSliceState {
  userBedProfiles: PrinterProfile[];
  /** Crea (sin `id`) o reemplaza una cama del usuario. Devuelve el perfil o null si no es válido. */
  saveUserBedProfile: (draft: BedProfileDraft, id?: string) => PrinterProfile | null;
  duplicateBedProfile: (id: string) => PrinterProfile | null;
  deleteUserBedProfile: (id: string) => boolean;
  /** Tras abrir un proyecto: si su cama difiere de la preferida, ofrece cambiarla. */
  offerPreferredBed: () => void;
}

export function createBedProfilesSlice(ctx: StoreContext): Partial<KuraStoreState> {
  const { set, get, tr } = ctx;
  const persist = (list: PrinterProfile[]) => {
    saveUserBedProfiles(list);
    set({ userBedProfiles: list });
  };
  return {
    userBedProfiles: loadUserBedProfiles(),
    saveUserBedProfile: (draft, id) => {
      if (validateBedDraft(draft).length > 0) return null;
      const list = get().userBedProfiles;
      if (!id && list.length >= MAX_USER_BEDS) return null;
      const profile = bedProfileFromDraft(id ?? newUserBedId(), draft);
      const next = id && list.some((p) => p.id === id) ? list.map((p) => (p.id === id ? profile : p)) : [...list, profile];
      persist(next);
      // Editar la cama activa actualiza también la del proyecto.
      if (get().printerProfile.id === profile.id) set({ printerProfile: profile });
      return profile;
    },
    duplicateBedProfile: (id) => {
      const source = findBedProfile(id, get().userBedProfiles);
      if (!source) return null;
      return get().saveUserBedProfile({
        name: tr('bedProfiles.copyOf', { name: source.name }).slice(0, 60),
        widthMm: source.bedWidthMm, depthMm: source.bedDepthMm, heightMm: source.maxHeightMm, marginMm: source.marginMm ?? 5,
      });
    },
    deleteUserBedProfile: (id) => {
      const list = get().userBedProfiles;
      const target = list.find((p) => p.id === id);
      if (!target) return false;
      persist(list.filter((p) => p.id !== id));
      // La cama activa del proyecto se conserva (viaja en el .kura); solo deja de estar en la lista.
      get().addToast(tr('bedProfiles.deleted', { name: target.name }), 'info');
      return true;
    },
    offerPreferredBed: () => {
      const preferred = findBedProfile(readStorage(STORAGE_PRINTER_KEY), get().userBedProfiles);
      const project = get().printerProfile;
      if (!preferred || sameBed(preferred, project)) return;
      get().addToast(
        tr('bedProfiles.projectDiffers', { project: project.name, mine: preferred.name }),
        'info',
        { label: tr('bedProfiles.useMine'), run: () => set({ printerProfile: preferred }) },
        { secondaryAction: { label: tr('bedProfiles.keepProject'), run: () => undefined } },
      );
    },
  };
}
