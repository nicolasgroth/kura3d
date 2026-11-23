// @vitest-environment jsdom
/**
 * @file src/project/__tests__/bedProfileProject.test.ts
 * @description La cama activa del proyecto en el `.kura`: una cama del usuario con margen viaja y
 * vuelve igual (sin subir la versión del formato), un margen fuera de rango se rechaza, y los perfiles
 * guardados en preferencias se validan y sanean.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { decodeProject, encodeProject, type ProjectDocument } from '../projectCodec';
import {
  bedProfileFromDraft, findBedProfile, loadUserBedProfiles, sameBed, saveUserBedProfiles, STORAGE_BED_PROFILES_KEY, validateBedDraft,
} from '../../store/bedProfiles';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';

const userBed = bedProfileFromDraft('user-abc', { name: 'Mi Prusa', widthMm: 250, depthMm: 210, heightMm: 220, marginMm: 2.5 });

const doc = (printerProfile = userBed): ProjectDocument => ({
  objects: [], selectedIds: [], past: [], future: [], unitSystem: 'mm', printerProfile,
  customBedDimensions: null, sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
});

describe('cama del proyecto en el .kura', () => {
  it('una cama del usuario con margen viaja y vuelve igual', () => {
    expect(decodeProject(encodeProject(doc())).printerProfile).toEqual(userBed);
  });

  it('una cama de fábrica no escribe margen (los .kura siguen legibles por versiones anteriores)', () => {
    const bytes = encodeProject(doc(DEFAULT_PRINTER_PROFILES[0]));
    expect(new TextDecoder().decode(bytes)).not.toContain('marginMm');
    expect(decodeProject(bytes).printerProfile).toEqual(DEFAULT_PRINTER_PROFILES[0]);
  });

  it('rechaza un margen fuera de rango', () => {
    expect(() => encodeProject(doc({ ...userBed, marginMm: 80 }))).toThrow();
  });
});

describe('camas del usuario en preferencias', () => {
  beforeEach(() => localStorage.clear());

  it('valida rangos y que el margen deje espacio útil', () => {
    expect(validateBedDraft({ name: 'ok', widthMm: 200, depthMm: 200, heightMm: 200, marginMm: 5 })).toEqual([]);
    expect(validateBedDraft({ name: ' ', widthMm: 10, depthMm: 200, heightMm: 200, marginMm: 5 }).map((e) => e.field)).toEqual(['name', 'widthMm']);
    expect(validateBedDraft({ name: 'x', widthMm: 40, depthMm: 40, heightMm: 40, marginMm: 20 }).map((e) => e.field)).toEqual(['margin-space']);
  });

  it('guarda, lee y descarta entradas inválidas o ajenas', () => {
    saveUserBedProfiles([userBed]);
    const raw = JSON.parse(localStorage.getItem(STORAGE_BED_PROFILES_KEY)!);
    raw.push({ id: 'elegoo-centauri-carbon-2', name: 'Pirata', bedWidthMm: 1, bedDepthMm: 1, maxHeightMm: 1 }, { id: 'user-x', name: 'malo', bedWidthMm: -1 });
    localStorage.setItem(STORAGE_BED_PROFILES_KEY, JSON.stringify(raw));
    expect(loadUserBedProfiles()).toEqual([userBed]);
    localStorage.setItem(STORAGE_BED_PROFILES_KEY, '{no es json');
    expect(loadUserBedProfiles()).toEqual([]);
  });

  it('busca entre fábrica y usuario; compara camas por medidas', () => {
    expect(findBedProfile('user-abc', [userBed])).toBe(userBed);
    expect(findBedProfile(DEFAULT_PRINTER_PROFILES[1].id, [])).toBe(DEFAULT_PRINTER_PROFILES[1]);
    expect(sameBed(DEFAULT_PRINTER_PROFILES[0], { ...DEFAULT_PRINTER_PROFILES[0], name: 'otro' })).toBe(true);
    expect(sameBed(DEFAULT_PRINTER_PROFILES[0], userBed)).toBe(false);
  });
});
