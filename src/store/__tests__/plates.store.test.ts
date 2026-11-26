/**
 * @file src/store/__tests__/plates.store.test.ts
 * @description Placas en el store: cama activa idéntica sin placas (regresión del punto único), crear, borrar,
 * renombrar y asignar como un paso de deshacer cada uno (con rehacer), fijar la placa activa sin paso,
 * coherencia de `plateRef` tras cualquier cambio y guardado `.kura` (v3 sin placas, v4 con placas).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { activePlateBed } from '../../core/scene/activePlateBed';
import { decodeProject, encodeProjectImage, PLATES_FORMAT_VERSION } from '../../project/projectCodec';
import { ROLE_FORMAT_VERSION } from '../../project/projectRoleMigration';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { activeBedSize } from '../bedSize';
import { materializeHistory } from '../historySteps';
import { captureProject } from '../projectDocument';
import { activeBed } from '../splitCommandSchemas';
import { useKuraStore } from '../useKuraStore';
import { addBox, byId, resetStore, store } from './storeTestUtils';

const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);

describe('punto único de la cama', () => {
  const profile = DEFAULT_PRINTER_PROFILES[0];

  it('sin placas, activeBed y activeBedSize dan exactamente lo de siempre', () => {
    expect(activeBed({ printerProfile: profile, customBedDimensions: null }))
      .toStrictEqual({ widthMm: profile.bedWidthMm, depthMm: profile.bedDepthMm, heightMm: profile.maxHeightMm });
    expect(activeBed({ printerProfile: profile, customBedDimensions: { width: 300, depth: 200, height: 100 } }))
      .toStrictEqual({ widthMm: 300, depthMm: 200, heightMm: 100 });
    expect(activeBedSize({ printerProfile: profile, customBedDimensions: null })).toStrictEqual({ width: profile.bedWidthMm, depth: profile.bedDepthMm });
    expect(activePlateBed({ printerProfile: profile, customBedDimensions: null })).toMatchObject({ origin: [0, 0], plateId: null });
  });

  it('con placas que usan la cama del proyecto las medidas no cambian; solo cambia el origen', () => {
    const plates = [{ id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] }, { id: 'p2', name: 'Placa 2', origin: [300, 0] as [number, number] }];
    const source = { printerProfile: profile, customBedDimensions: null, plates, activePlateId: 'p2' };
    expect(activeBed(source)).toStrictEqual(activeBed({ printerProfile: profile, customBedDimensions: null }));
    expect(activeBedSize(source)).toStrictEqual(activeBedSize({ printerProfile: profile, customBedDimensions: null }));
    expect(activePlateBed(source)).toMatchObject({ origin: [300, 0], plateId: 'p2' });
  });

  it('una placa con cama propia la impone a la cama activa', () => {
    const plates = [
      { id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] },
      { id: 'p2', name: 'Mini', origin: [300, 0] as [number, number], bed: { name: 'Mini', widthMm: 180, depthMm: 170, heightMm: 160 } },
    ];
    const source = { printerProfile: profile, customBedDimensions: null, plates, activePlateId: 'p2' };
    expect(activeBed(source)).toStrictEqual({ widthMm: 180, depthMm: 170, heightMm: 160 });
    expect(activeBedSize(source)).toStrictEqual({ width: 180, depth: 170 });
    // Un id que ya no existe cae en la primera placa (la del proyecto).
    expect(activeBed({ ...source, activePlateId: 'borrada' }).widthMm).toBe(profile.bedWidthMm);
  });
});

describe('placas en el store', () => {
  beforeEach(async () => {
    await resetStore();
    useKuraStore.setState({ plates: [], activePlateId: null, groups: [] });
  });

  it('crear es un paso de deshacer: vuelve explícita la placa 1, asigna las piezas y deja activa la nueva', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const steps = store().past.length;
    const plate = store().createPlate()!;
    expect(plate.name).toBe('Placa 2');
    expect(store().past.length).toBe(steps + 1);
    expect(store().plates.map((p) => p.name)).toEqual(['Placa 1', 'Placa 2']);
    expect(store().activePlateId).toBe(plate.id);
    expect(byId(a.id)!.plateRef).toBe(store().plates[0].id);
    expect(activeBed(store())).toStrictEqual(activeBed({ printerProfile: store().printerProfile, customBedDimensions: store().customBedDimensions }));
    expect(activePlateBed(store()).origin).toEqual(plate.origin);

    store().undo();
    expect(store().plates).toEqual([]);
    expect(byId(a.id)!.plateRef).toBeUndefined();
    expect(activePlateBed(store()).plateId).toBeNull();
    store().redo();
    expect(store().plates).toHaveLength(2);
    expect(byId(a.id)!.plateRef).toBe(store().plates[0].id);
  });

  it('el nombre por defecto sale por i18n', async () => {
    useKuraStore.setState({ language: 'en' });
    expect(store().createPlate()!.name).toBe('Plate 2');
    expect(store().plates[0].name).toBe('Plate 1');
  });

  it('asignar, renombrar y borrar son un paso cada uno, con rehacer', async () => {
    const a = await addBox(10, [0, 0, 0]);
    const b = await addBox(10, [30, 0, 0]);
    const p2 = store().createPlate()!;
    const p1 = store().plates[0];
    const steps = store().past.length;

    expect(store().assignToPlate(p2.id, [b.id])).toBe(1);
    expect(byId(b.id)!.plateRef).toBe(p2.id);
    expect(store().renamePlate(p2.id, 'Cabeza')).toBe(true);
    expect(store().deletePlate(p2.id)).toBe(true);
    expect(store().past.length).toBe(steps + 3);
    expect(store().plates.map((p) => p.id)).toEqual([p1.id]);
    expect(byId(b.id)!.plateRef).toBe(p1.id);
    expect(store().activePlateId).toBe(p1.id);

    store().undo();
    expect(store().plates.map((p) => p.name)).toEqual(['Placa 1', 'Cabeza']);
    expect(byId(b.id)!.plateRef).toBe(p2.id);
    store().undo();
    expect(store().plates[1].name).toBe('Placa 2');
    store().undo();
    expect(byId(b.id)!.plateRef).toBe(p1.id);
    expect(byId(a.id)!.plateRef).toBe(p1.id);
    store().redo();
    store().redo();
    store().redo();
    expect(store().plates.map((p) => p.id)).toEqual([p1.id]);
    expect(byId(b.id)!.plateRef).toBe(p1.id);
  });

  it('acciones sin efecto no agregan pasos; fijar la placa activa nunca es un paso', async () => {
    await addBox(10);
    const p2 = store().createPlate()!;
    const p1 = store().plates[0];
    const steps = store().past.length;
    expect(store().renamePlate(p2.id, '  ')).toBe(false);
    expect(store().renamePlate('nada', 'X')).toBe(false);
    expect(store().assignToPlate('nada')).toBe(0);
    expect(store().deletePlate('nada')).toBe(false);
    expect(store().setActivePlate(p1.id)).toBe(true);
    expect(store().setActivePlate('nada')).toBe(false);
    expect(store().activePlateId).toBe(p1.id);
    expect(store().deletePlate(p2.id)).toBe(true);
    expect(store().deletePlate(p1.id)).toBe(false); // la última placa no se borra
    expect(store().past.length).toBe(steps + 1);
  });

  it('asignar sin ids usa la selección', async () => {
    const a = await addBox(10);
    const p2 = store().createPlate()!;
    store().selectObject(a.id);
    expect(store().assignToPlate(p2.id)).toBe(1);
    expect(byId(a.id)!.plateRef).toBe(p2.id);
  });

  it('ninguna pieza queda apuntando a una placa que no existe', async () => {
    const a = await addBox(10);
    store().createPlate();
    // Estado roto a propósito (sin pasar por el store); el próximo cambio de escena lo corrige.
    useKuraStore.setState({ plates: [] });
    store().updateObjectMeta(a.id, { name: 'Otra' });
    expect('plateRef' in byId(a.id)!).toBe(false);
    expect(byId(a.id)!.name).toBe('Otra');
  });

  it('guardar: sin placas v3, con placas v4, y vuelve igual', async () => {
    const a = await addBox(10);
    // Sin datos del proyecto (un proyecto con fechas se escribe como v5): aquí se prueba solo la versión por placas.
    useKuraStore.setState({ projectInfo: {} } as never);
    expect(versionOf(encodeProjectImage(captureProject(store())))).toBe(ROLE_FORMAT_VERSION);
    const p2 = store().createPlate()!;
    store().assignToPlate(p2.id, [a.id]);
    const bytes = encodeProjectImage(captureProject(store()));
    expect(versionOf(bytes)).toBe(PLATES_FORMAT_VERSION);
    const back = decodeProject(bytes);
    expect(back.plates).toEqual(store().plates);
    expect(back.objects[0].plateRef).toBe(p2.id);
    expect(back.past.at(-1)!.plates).toHaveLength(2);
    // Abrir el proyecto recupera las placas; la activa vuelve a la primera.
    store().newProject();
    expect(store().plates).toEqual([]);
  });

  it('deshacer un arrastre conserva las placas (la instantánea del arrastre las lleva)', async () => {
    const a = await addBox(10);
    store().createPlate();
    const plates = store().plates;
    store().setObjectTransform(a.id, { position: [40, 0, 0] }, false);
    store().commitTransformSnapshot();
    store().undo();
    expect(byId(a.id)!.position).toEqual([0, 0, 0]);
    expect(store().plates).toBe(plates);
    expect(byId(a.id)!.plateRef).toBe(plates[0].id);
  });

  it('el historial materializado (trazos de pintura) lleva las placas del estado vecino', () => {
    const plates = [{ id: 'p1', name: 'Placa 1', origin: [0, 0] as [number, number] }];
    const past = [{ objects: [], selectedIds: [], plates }];
    expect(materializeHistory([], [], past, [], [], plates).past[0].plates).toBe(plates);
  });
});
