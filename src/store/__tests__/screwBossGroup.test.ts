/**
 * @file src/store/__tests__/screwBossGroup.test.ts
 * @description Torreta y grupos con el motor real: el grupo que crea el agregado (pieza sin grupo previo) se disuelve al
 * aplicar las restas si solo queda la pieza; un grupo que el usuario ya tenía no se toca, ni siquiera con un solo
 * miembro, y el creado por el agregado se conserva si el usuario le sumó otra pieza.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { SCREW_BOSS_DEFAULTS } from '../../core/addons/screwBossPresets';
import { clearAddonGroupMarks } from '../../core/scene/addonGroups';
import type { Vec3 } from '../../types/kura';
import { useKuraStore } from '../useKuraStore';
import { byId, resetMagnetStore, store } from './magnetTestKit';

const M3 = SCREW_BOSS_DEFAULTS;
const TOP: Vec3 = [0, 30, 0];
const box = (position: Vec3 = [0, 0, 0]) => store().createPrimitive('box', { width: 30, height: 30, depth: 30 }, { position }).then((o) => o!);

async function applyAll() {
  store().clearSelection();
  await store().applyHolesOnSolids();
}

describe('torreta: grupo creado por el agregado', () => {
  beforeEach(async () => {
    await resetMagnetStore();
    clearAddonGroupMarks();
  });

  it('pieza sin grupo: la torreta crea uno con la pieza y las restas lo disuelven', async () => {
    const host = await box();
    expect(byId(host.id).groupRef).toBeUndefined();
    await store().addScrewBoss({ hostId: host.id, params: M3, point: TOP, normal: [0, 1, 0] });
    expect(store().groups).toHaveLength(1);
    expect(byId(host.id).groupRef).toBe(store().groups[0].id);
    await applyAll();
    expect(store().groups).toHaveLength(0);
    expect(byId(host.id).groupRef).toBeUndefined();
    expect(store().objects).toHaveLength(1);
  });

  it('el grupo creado por el agregado no se disuelve si el usuario le sumó otra pieza', async () => {
    const host = await box();
    const other = await box([100, 0, 0]);
    await store().addScrewBoss({ hostId: host.id, params: M3, point: TOP, normal: [0, 1, 0] });
    const gid = store().groups[0].id;
    useKuraStore.setState({ objects: store().objects.map((o) => (o.id === other.id ? { ...o, groupRef: gid } : o)) });
    await applyAll();
    expect(store().groups.map((g) => g.id)).toEqual([gid]);
    expect(byId(host.id).groupRef).toBe(gid);
    expect(byId(other.id).groupRef).toBe(gid);
  });

  it('grupo que el usuario ya tenía (con un solo miembro): no se toca', async () => {
    const host = await box();
    const mine = { id: 'grp-mio', name: 'Mi grupo', visible: true, locked: false, collapsed: false };
    useKuraStore.setState({ groups: [mine], objects: store().objects.map((o) => (o.id === host.id ? { ...o, groupRef: mine.id } : o)) });
    await store().addScrewBoss({ hostId: host.id, params: M3, point: TOP, normal: [0, 1, 0] });
    expect(store().groups.map((g) => g.id)).toEqual([mine.id]);
    await applyAll();
    expect(store().groups.map((g) => g.id)).toEqual([mine.id]);
    expect(byId(host.id).groupRef).toBe(mine.id);
  });
});
