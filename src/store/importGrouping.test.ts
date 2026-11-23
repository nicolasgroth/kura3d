/**
 * @file src/store/importGrouping.test.ts
 * @description Importar desde el store un 3MF de varias placas (un grupo por placa con el nombre del
 * laminador, aviso de placas y de que no caben en la cama) y un conjunto montado (un grupo con el
 * nombre del archivo, montaje conservado), en un solo paso deshacible.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cubeMeshXml, modelXml, pack3mf, translate } from '../engine/__tests__/ioFixtures';
import { useKuraStore } from './useKuraStore';

const get = useKuraStore.getState;
let empty: ReturnType<typeof get>;

const plate = (id: number, name: string, objects: string[]) =>
  `<plate><metadata key="plater_id" value="${id}"/><metadata key="plater_name" value="${name}"/>` +
  objects.map((o) => `<model_instance><metadata key="object_id" value="${o}"/><metadata key="instance_id" value="0"/></model_instance>`).join('') +
  '</plate>';

/** Tres placas con cubos de 150 mm: juntas no caben en ninguna cama común. */
const plates = () => pack3mf({
  '3D/3dmodel.model': modelXml(
    `<object id="1" name="A">${cubeMeshXml(150)}</object><object id="2" name="B">${cubeMeshXml(150)}</object><object id="3" name="C">${cubeMeshXml(150)}</object><object id="4" name="D">${cubeMeshXml(20)}</object>`,
    `<item objectid="1" transform="${translate(0, 0, 0)}"/><item objectid="4" transform="${translate(160, 0, 0)}"/><item objectid="2" transform="${translate(400, 0, 0)}"/><item objectid="3" transform="${translate(800, 0, 0)}"/>`,
  ),
  'Metadata/model_settings.config': `<config>${plate(1, 'Cabeza', ['1', '4'])}${plate(2, '', ['2'])}${plate(3, '', ['3'])}</config>`,
});

const nested = () => pack3mf({
  '3D/3dmodel.model': modelXml(
    `<object id="1" name="Anillo 1">${cubeMeshXml(10, [10, 10, 0])}</object><object id="2" name="Anillo 2">${cubeMeshXml(20, [5, 5, 0])}</object><object id="3" name="Anillo 3">${cubeMeshXml(30)}</object>`,
    '<item objectid="1"/><item objectid="2"/><item objectid="3"/>',
  ),
});

const file = (name: string, data: ArrayBuffer) => ({ name, read: async () => data });
const toasts = () => get().toasts.map((t) => t.text);

beforeAll(async () => {
  await get().initEngine();
  empty = get();
});

beforeEach(() => {
  useKuraStore.setState(empty, true);
});

describe('agrupación al importar', () => {
  it('3MF de varias placas: un grupo por placa, con el nombre del laminador o «Placa N»', async () => {
    expect(await get().importModelFiles([file('figura.3mf', plates())])).toBe(true);
    const { groups, objects } = get();
    expect(groups.map((g) => g.name)).toEqual(['Cabeza', 'Placa 2', 'Placa 3']);
    const byGroup = (name: string) => objects.filter((o) => o.groupRef === groups.find((g) => g.name === name)?.id).map((o) => o.name);
    expect(byGroup('Cabeza')).toEqual(['A', 'D']);
    expect(byGroup('Placa 2')).toEqual(['B']);
    expect(toasts().some((t) => t.includes('3 placas') && t.includes('no caben en la cama'))).toBe(true);
  });

  it('un solo deshacer quita la importación con sus grupos', async () => {
    await get().importModelFiles([file('figura.3mf', plates())]);
    get().undo();
    expect(get().objects).toHaveLength(0);
    expect(get().groups).toHaveLength(0);
  });

  it('conjunto montado: un grupo con el nombre del archivo y el montaje intacto', async () => {
    await get().importModelFiles([file('Hex Fidget.3mf', nested())]);
    const { groups, objects } = get();
    expect(groups.map((g) => g.name)).toEqual(['Hex Fidget']);
    expect(objects.every((o) => o.groupRef === groups[0].id)).toBe(true);
    const xs = objects.map((o) => o.position[0]);
    expect(xs[1]).toBeCloseTo(xs[0], 4);
    expect(xs[2]).toBeCloseTo(xs[0], 4);
    expect(toasts().some((t) => t.includes('venían montadas'))).toBe(true);
  });

  it('en posición original también agrupa y no mueve nada', async () => {
    await get().importModelFiles([file('figura.3mf', plates())], { placement: 'original' });
    expect(get().groups).toHaveLength(3);
    expect(Math.round(get().objects.find((o) => o.name === 'B')!.position[0])).toBe(475);
  });
});
