/**
 * @file src/store/__tests__/orientNoBaseStore.test.ts
 * @description «Orientar para imprimir» en el store con una pieza de dos cuerpos separados (QA 25-nov): aplicar la
 * recomendada la deja con la malla real en min Y = 0 y el aviso dice «apoyada»; aplicar a mano una opción sin base
 * real (solo aristas o puntos en la cama) avisa que no tiene base en vez de decir «apoyada».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeObject } from '../../engine/__tests__/geometryTestUtils';
import { box, input, qaCross } from '../../engine/__tests__/orientShapes';
import { planOrientTransform } from '../../engine/orient';
import { t } from '../../i18n';
import type { SceneObject } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { byId, resetMagnetStore, store, worldOf } from './magnetTestKit';

const minY = (o: SceneObject) => {
  const p = worldOf(o).positions;
  let m = Infinity;
  for (let i = 1; i < p.length; i += 3) m = Math.min(m, p[i]);
  return m;
};

const lastToast = () => store().toasts[store().toasts.length - 1];

describe('Orientar una pieza de dos cuerpos en el store', () => {
  beforeEach(resetMagnetStore);

  it('la cruz de QA (girada 45° como la dejó la versión anterior): la recomendada tiene base, min Y = 0 y dice «apoyada»', async () => {
    // Pose que antes salía recomendada: apoyada solo en dos aristas (contacto 0 mm²).
    const mesh = qaCross();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2), new THREE.Vector3(0, -1, 0));
    const pose = planOrientTransform(input(mesh), [q.x, q.y, q.z, q.w]);
    useKuraStore.setState({ objects: [makeObject('x', mesh, { name: 'Cruz', ...pose })], selectedIds: ['x'] });
    const a = (await store().analyzeOrient('x'))!;
    const current = a.candidates.find((c) => c.id === a.currentId)!;
    expect(current.reasons).toContainEqual({ key: 'noBase' });
    const best = a.candidates[0];
    expect(best.id).not.toBe(a.currentId);
    expect(best.measures.contactAreaMm2).toBeGreaterThan(10);
    expect(await store().applyOrient(best.id)).toBe(true);
    expect(minY(byId('x'))).toBeCloseTo(0, 6);
    expect(lastToast().text).toBe(t(store().language, 'orient.ui.applied', { name: 'Cruz' }));
  });

  it('una opción sin base aplicada a mano queda en Y = 0 y avisa que no tiene base', async () => {
    // Cubo girado: las 6 de ejes caen sobre aristas o vértices; las caras del casco sí son base.
    useKuraStore.setState({ objects: [makeObject('x', box(20, 20, 20), { name: 'Cruz', rotation: [Math.PI / 4, 0, Math.PI / 4] })], selectedIds: ['x'] });
    const a = (await store().analyzeOrient('x'))!;
    const noBase = a.candidates.find((c) => c.reasons.some((r) => r.key === 'noBase') && c.id !== a.currentId);
    expect(noBase).toBeDefined();
    expect(noBase!.rank).toBeGreaterThan(0);
    expect(await store().applyOrient(noBase!.id)).toBe(true);
    expect(minY(byId('x'))).toBeCloseTo(0, 6);
    const toast = lastToast();
    expect(toast.text).toBe(t(store().language, 'orient.ui.appliedNoBase', { name: 'Cruz' }));
    expect(toast.kind).not.toBe('success');
  });
});
