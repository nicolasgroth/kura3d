/**
 * @file src/engine/__tests__/importPlatesAssembly.test.ts
 * @description Importación de 3MF reales (QA): placas de Bambu/Orca (`model_settings.config`), nombre del
 * objeto que declara el laminador, y conjuntos montados (piezas que se solapan en sus posiciones
 * originales) que se conservan como bloque en vez de repartirse en estantería.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { findImportClusters } from '../io/importClusters';
import { placeImportedModels } from '../io/importPlacement';
import { boundsOf } from '../io/meshBuffers';
import { read3MF } from '../io/threeMfImport';
import { cubeMeshXml, modelXml, pack3mf, translate } from './ioFixtures';

const plateXml = (id: number, name: string, objects: string[]) =>
  `<plate><metadata key="plater_id" value="${id}"/><metadata key="plater_name" value="${name}"/>` +
  objects.map((o) => `<model_instance><metadata key="object_id" value="${o}"/><metadata key="instance_id" value="0"/></model_instance>`).join('') +
  '</plate>';

/** Tres objetos en dos placas de Bambu, separadas 300 mm como las deja el laminador. */
function multiPlate(): ArrayBuffer {
  const settings = '<?xml version="1.0"?><config>' +
    '<object id="1"><metadata key="name" value="Cabeza_A"/><part id="1" subtype="normal_part"><metadata key="name" value="figura.stl"/></part></object>' +
    '<object id="2"><metadata key="name" value="Cuello"/></object>' +
    '<object id="3"><metadata key="name" value="Base"/></object>' +
    plateXml(1, 'Cabeza', ['1', '2']) + plateXml(2, '', ['3']) + '</config>';
  return pack3mf({
    '3D/3dmodel.model': modelXml(
      `<object id="1">${cubeMeshXml(10)}</object><object id="2">${cubeMeshXml(10)}</object><object id="3">${cubeMeshXml(20)}</object>`,
      `<item objectid="1" transform="${translate(100, 100, 0)}"/><item objectid="2" transform="${translate(120, 100, 0)}"/><item objectid="3" transform="${translate(420, 100, 0)}"/>`,
    ),
    'Metadata/model_settings.config': settings,
  });
}

/** Tres cubos concéntricos sin transformaciones (como los anillos montados de un fidget). */
function nested(): ArrayBuffer {
  return pack3mf({
    '3D/3dmodel.model': modelXml(
      `<object id="1" name="A">${cubeMeshXml(10, [10, 10, 0])}</object><object id="2" name="B">${cubeMeshXml(20, [5, 5, 0])}</object><object id="3" name="C">${cubeMeshXml(30)}</object>`,
      '<item objectid="1"/><item objectid="2"/><item objectid="3"/>',
    ),
  });
}

/** Dos cubos sin transformaciones ni relación (separados en el archivo). */
function loose(): ArrayBuffer {
  return pack3mf({
    '3D/3dmodel.model': modelXml(
      `<object id="1" name="A">${cubeMeshXml(10)}</object><object id="2" name="B">${cubeMeshXml(10, [500, 0, 0])}</object>`,
      '<item objectid="1"/><item objectid="2"/>',
    ),
  });
}

const centerX = (positions: Float32Array, dx: number) => {
  const b = boundsOf(positions);
  return (b[0] + b[3]) / 2 + dx;
};

describe('3MF de varias placas', () => {
  it('detecta las placas con su nombre y las piezas de cada una', () => {
    const model = read3MF(multiPlate(), 'placas.3mf');
    expect(model.plates).toEqual([
      { name: 'Cabeza', groups: [0, 1] },
      { name: undefined, groups: [2] },
    ]);
    expect(findImportClusters(model)).toEqual([
      { kind: 'plate', name: 'Cabeza', plateNumber: 1, parts: [0, 1] },
      { kind: 'plate', name: undefined, plateNumber: 2, parts: [2] },
    ]);
  });

  it('usa el nombre del objeto que declara el laminador cuando el objeto tiene una sola pieza', () => {
    expect(read3MF(multiPlate(), 'placas.3mf').parts.map((p) => p.name)).toEqual(['Cabeza_A', 'Cuello', 'Base']);
  });

  it('en la cama cada placa conserva su disposición y las placas quedan juntas sin solaparse', () => {
    const placed = placeImportedModels([read3MF(multiPlate(), 'placas.3mf')], 'bed');
    const [a, b] = placed.map((p) => centerX(p.mesh.positions, p.position[0]));
    expect(b - a).toBeCloseTo(20, 4); // misma placa: posición relativa intacta
    // Huella XZ mundial de cada placa.
    const box = (indices: number[]) => {
      const out = [Infinity, Infinity, -Infinity, -Infinity];
      for (const i of indices) {
        const bb = boundsOf(placed[i].mesh.positions);
        const [x, , z] = placed[i].position;
        out[0] = Math.min(out[0], bb[0] + x); out[1] = Math.min(out[1], bb[2] + z);
        out[2] = Math.max(out[2], bb[3] + x); out[3] = Math.max(out[3], bb[5] + z);
      }
      return out;
    };
    const p1 = box([0, 1]);
    const p2 = box([2]);
    // La placa 2 ya no queda a 300 mm: se acomoda junto a la 1, sin solaparse (bloques separados 5 mm).
    const gap = Math.max(p2[0] - p1[2], p1[0] - p2[2], p2[1] - p1[3], p1[1] - p2[3]);
    expect(gap).toBeGreaterThanOrEqual(4.99);
    expect(gap).toBeLessThan(10);
  });
});

describe('conjuntos montados', () => {
  it('piezas que se solapan en el archivo forman un conjunto', () => {
    expect(findImportClusters(read3MF(nested(), 'fidget.3mf'))).toEqual([{ kind: 'assembly', parts: [0, 1, 2] }]);
  });

  it('en la cama el conjunto conserva el montaje (centros coinciden) en vez de repartirse', () => {
    const placed = placeImportedModels([read3MF(nested(), 'fidget.3mf')], 'bed');
    const centers = placed.map((p) => centerX(p.mesh.positions, p.position[0]));
    expect(centers[1]).toBeCloseTo(centers[0], 4);
    expect(centers[2]).toBeCloseTo(centers[0], 4);
    expect(placed.every((p) => Math.abs(p.position[1]) < 1e-6)).toBe(true); // las tres apoyan en la cama
  });

  it('piezas separadas sin relación siguen repartiéndose', () => {
    const model = read3MF(loose(), 'sueltas.3mf');
    expect(findImportClusters(model)).toEqual([]);
    const placed = placeImportedModels([model], 'bed');
    const [a, b] = placed.map((p) => centerX(p.mesh.positions, p.position[0]));
    expect(Math.abs(b - a)).toBeLessThan(30); // ya no a 500 mm: se acomodan juntas
  });

  it('el modo "posición original" deja todo donde lo trae el archivo', () => {
    const placed = placeImportedModels([read3MF(multiPlate(), 'placas.3mf')], 'original');
    expect(placed.map((p) => Math.round(centerX(p.mesh.positions, p.position[0])))).toEqual([105, 125, 430]);
  });
});
