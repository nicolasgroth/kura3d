/**
 * @file src/core/scene/__tests__/objectRole.test.ts
 * @description Predicados del rol de objeto (sólido / negativo / referencia) y su alias obsoleto `isHole`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import {
  clampReferenceOpacity, isNegative, isPrintable, isReference, isSolid, OBJECT_ROLES,
  participatesInBooleans, readRoleInput, roleFromLegacy,
} from '../objectRole';

const o = (role: 'solid' | 'negative' | 'reference', visible = true) => ({ role, visible });

describe('objectRole', () => {
  it('cada rol responde a un solo predicado', () => {
    expect(OBJECT_ROLES).toEqual(['solid', 'negative', 'reference']);
    expect([isSolid(o('solid')), isNegative(o('solid')), isReference(o('solid'))]).toEqual([true, false, false]);
    expect([isSolid(o('negative')), isNegative(o('negative')), isReference(o('negative'))]).toEqual([false, true, false]);
    expect([isSolid(o('reference')), isNegative(o('reference')), isReference(o('reference'))]).toEqual([false, false, true]);
  });

  it('isPrintable: solo sólidos visibles; una referencia nunca se imprime', () => {
    expect(isPrintable(o('solid'))).toBe(true);
    expect(isPrintable(o('solid', false))).toBe(false);
    expect(isPrintable(o('negative'))).toBe(false);
    expect(isPrintable(o('reference'))).toBe(false);
  });

  it('participatesInBooleans excluye referencias', () => {
    expect(participatesInBooleans(o('solid'))).toBe(true);
    expect(participatesInBooleans(o('negative'))).toBe(true);
    expect(participatesInBooleans(o('reference'))).toBe(false);
  });

  it('roleFromLegacy traduce isHole', () => {
    expect(roleFromLegacy(true)).toBe('negative');
    expect(roleFromLegacy(false)).toBe('solid');
    expect(roleFromLegacy(undefined)).toBe('solid');
  });

  it('readRoleInput: role gana sobre el alias isHole; valores inválidos se ignoran', () => {
    expect(readRoleInput({ role: 'reference', isHole: true })).toBe('reference');
    expect(readRoleInput({ isHole: true })).toBe('negative');
    expect(readRoleInput({ isHole: false })).toBe('solid');
    expect(readRoleInput({})).toBeUndefined();
    expect(readRoleInput({ role: 'fantasma' })).toBeUndefined();
  });

  it('clampReferenceOpacity acota a 0,15–1', () => {
    expect(clampReferenceOpacity(0)).toBe(0.15);
    expect(clampReferenceOpacity(2)).toBe(1);
    expect(clampReferenceOpacity(0.5)).toBe(0.5);
    expect(clampReferenceOpacity(Number.NaN)).toBe(0.35);
  });
});
