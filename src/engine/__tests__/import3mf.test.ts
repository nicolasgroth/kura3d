/**
 * @file src/engine/__tests__/import3mf.test.ts
 * @description Pruebas del lector 3MF con fixtures sintéticos: componentes anidados, instancias
 * repetidas, transformaciones de build, extensión de producción, configuración Bambu/Orca
 * (6 cuerpos / 3 colores), piezas negativas, espejado, ciclos y archivos corruptos o sobredimensionados.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strToU8, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeMeshStats, initManifoldEngine } from '../index';
import { ModelImportError, import3MFBuffer, parseModelFile, read3MF } from '../ioFormats';
import { boundsOf } from '../io/meshBuffers';
import { cubeMeshXml, modelXml, pack3mf, translate } from './ioFixtures';

const errorCode = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof ModelImportError ? { code: error.code, fileName: error.fileName } : { code: 'other' };
  }
  return { code: 'none' };
};

/** Caja [minX,minY,minZ,maxX,maxY,maxZ] de una pieza en Y-up. */
const box = (positions: Float32Array) => boundsOf(positions).map((n) => Math.round(n * 1000) / 1000);

describe('lector 3MF: componentes, instancias y build', () => {
  beforeAll(async () => {
    await initManifoldEngine();
  });

  it('resuelve componentes anidados con sus transformaciones y la del ítem de build', () => {
    // Objeto 1: cubo de 10 mm. Objeto 2: par de cubos. Objeto 3: par + un cubo suelto => 3 piezas.
    const xml = modelXml(
      `<object id="1" name="Cubo">${cubeMeshXml(10)}</object>` +
      `<object id="2" name="Par"><components><component objectid="1"/><component objectid="1" transform="${translate(20, 0, 0)}"/></components></object>` +
      `<object id="3" name="Conjunto"><components><component objectid="2"/><component objectid="1" transform="${translate(0, 30, 5)}"/></components></object>`,
      `<item objectid="3" transform="${translate(100, 50, 0)}"/>`,
    );
    const model = read3MF(pack3mf({ '3D/3dmodel.model': xml }), 'conjunto.3mf');
    expect(model.parts).toHaveLength(3);
    expect(model.hasPlacement).toBe(true);
    // Z-up (x, y, z) -> Y-up (x, z, -y)
    expect(box(model.parts[0].mesh.positions)).toEqual([100, 0, -60, 110, 10, -50]);
    expect(box(model.parts[1].mesh.positions)).toEqual([120, 0, -60, 130, 10, -50]);
    expect(box(model.parts[2].mesh.positions)).toEqual([100, 5, -90, 110, 15, -80]);
    for (const part of model.parts) {
      expect(part.group).toBe(0);
      expect(part.openEdges).toBe(0);
      expect(computeMeshStats(part.mesh).volumeMm3).toBeCloseTo(1000, 3);
    }
  });

  it('conserva instancias repetidas del mismo objeto con nombres únicos', () => {
    const xml = modelXml(
      `<object id="7" name="Clavija">${cubeMeshXml(5)}</object>`,
      [0, 1, 2].map((i) => `<item objectid="7" transform="${translate(i * 12, 0, 0)}"/>`).join(''),
    );
    const parts = read3MF(pack3mf({ '3D/3dmodel.model': xml })).parts;
    expect(parts.map((p) => p.name)).toEqual(['Clavija', 'Clavija (2)', 'Clavija (3)']);
    expect(parts.map((p) => box(p.mesh.positions)[0])).toEqual([0, 12, 24]);
    expect(new Set(parts.map((p) => p.group)).size).toBe(3);
  });

  it('aplica rotación, traslación y unidad declarada (ida y vuelta del prototipo IO-01a)', () => {
    const tri = '<mesh><vertices><vertex x="1" y="0" z="0"/><vertex x="0" y="2" z="0"/><vertex x="0" y="0" z="3"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh>';
    const xml = modelXml(
      `<object id="1" name="Arm">${tri}</object><object id="2" name="Foot">${tri}</object>`,
      '<item objectid="1" transform="0 1 0 -1 0 0 0 0 1 4 -5 6"/><item objectid="2" transform="1 0 0 0 1 0 0 0 1 -1 -1 -4"/>',
      'centimeter',
    );
    const buffer = pack3mf({ '3D/3dmodel.model': xml });
    const [arm, foot] = import3MFBuffer(buffer, { preservePlacement: true });
    expect([arm.name, foot.name]).toEqual(['Arm', 'Foot']);
    expect([...arm.mesh.positions]).toEqual([40, 60, 40, 20, 60, 50, 40, 90, 50]);
    expect([...foot.mesh.positions]).toEqual([0, -40, 10, -10, -40, -10, -10, -10, 10]);
    const [centeredArm, centeredFoot] = import3MFBuffer(buffer);
    expect([...centeredArm.mesh.positions]).toEqual([10, 0, -5, -10, 0, 5, 10, 30, 5]);
    expect([...centeredFoot.mesh.positions]).toEqual([5, 0, 10, -5, 0, -10, -5, 30, 10]);
  });

  it('lee un paquete tipo Bambu Studio: p:path, 6 cuerpos y 3 colores de filamento', () => {
    const colors = ['#FF0000', '#00FF00', '#0000FF'];
    const sub = modelXml(
      [1, 2, 3, 4, 5, 6].map((id) => `<object id="${id}" type="model">${cubeMeshXml(8)}</object>`).join(''),
    );
    const root = modelXml(
      [1, 2, 3, 4, 5, 6].map((id) =>
        `<object id="${id + 10}" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="${id}" transform="${translate(0, 0, 0)}"/></components></object>`,
      ).join(''),
      [1, 2, 3, 4, 5, 6].map((id) => `<item objectid="${id + 10}" transform="${translate(id * 15, 128, 0)}" printable="1"/>`).join(''),
    );
    const settings = '<?xml version="1.0"?><config>' +
      [1, 2, 3, 4, 5, 6].map((id) =>
        `<object id="${id + 10}"><metadata key="name" value="Cuerpo ${id}"/><metadata key="extruder" value="${((id - 1) % 3) + 1}"/>` +
        `<part id="${id}" subtype="normal_part"><metadata key="name" value="Cuerpo ${id}"/></part></object>`,
      ).join('') + '</config>';
    const project = JSON.stringify({ filament_colour: colors });
    const model = read3MF(pack3mf({
      '3D/3dmodel.model': root,
      '3D/Objects/object_1.model': sub,
      'Metadata/model_settings.config': settings,
      'Metadata/project_settings.config': project,
    }), 'placa.3mf');
    expect(model.parts.map((p) => p.name)).toEqual([1, 2, 3, 4, 5, 6].map((i) => `Cuerpo ${i}`));
    expect(model.parts.map((p) => p.color)).toEqual(['#ff0000', '#00ff00', '#0000ff', '#ff0000', '#00ff00', '#0000ff']);
    expect(new Set(model.parts.map((p) => box(p.mesh.positions)[0])).size).toBe(6);
    expect(model.parts.every((p) => box(p.mesh.positions)[5] === -128)).toBe(true);
  });

  it('toma colores de basematerials, conserva el color base del objeto y los colores por cara', () => {
    const xml = modelXml(
      '<basematerials id="5"><base name="A" displaycolor="#112233FF"/><base name="B" displaycolor="#AABBCCFF"/></basematerials>' +
      `<object id="1" name="Pintado" pid="5" pindex="0">${cubeMeshXml(10, [0, 0, 0], (i) => (i < 2 ? ' pid="5" p1="1"' : ''))}</object>`,
      '<item objectid="1"/>',
    );
    const [part] = read3MF(pack3mf({ '3D/3dmodel.model': xml })).parts;
    expect(part.color).toBe('#112233');
    expect(part.mesh.faceColors?.filter((c) => c === '#aabbcc')).toHaveLength(2);
  });

  it('importa piezas negativas como huecos y omite modificadores', () => {
    const root = modelXml(
      `<object id="1">${cubeMeshXml(10)}</object><object id="2">${cubeMeshXml(4, [3, 3, 3])}</object><object id="3">${cubeMeshXml(2)}</object>` +
      '<object id="9" name="Pieza"><components><component objectid="1"/><component objectid="2"/><component objectid="3"/></components></object>',
      '<item objectid="9"/>',
    );
    const settings = '<config><object id="9"><metadata key="name" value="Pieza"/>' +
      '<part id="1" subtype="normal_part"><metadata key="name" value="Cuerpo"/></part>' +
      '<part id="2" subtype="negative_part"><metadata key="name" value="Agujero"/></part>' +
      '<part id="3" subtype="modifier_part"/></object></config>';
    const parts = read3MF(pack3mf({ '3D/3dmodel.model': root, 'Metadata/model_settings.config': settings })).parts;
    expect(parts.map((p) => [p.name, Boolean(p.isHole)])).toEqual([['Cuerpo', false], ['Agujero', true]]);
  });

  it('invierte el orden de los triángulos con transformaciones espejadas', () => {
    const xml = modelXml(`<object id="1">${cubeMeshXml(10)}</object>`, '<item objectid="1" transform="-1 0 0 0 1 0 0 0 1 0 0 0"/>');
    const [part] = read3MF(pack3mf({ '3D/3dmodel.model': xml })).parts;
    expect(computeMeshStats(part.mesh).volumeMm3).toBeCloseTo(1000, 3);
  });

  it('coloca sin solapar cuando el build no trae transformaciones', () => {
    const xml = modelXml(`<object id="1">${cubeMeshXml(10)}</object><object id="2">${cubeMeshXml(10)}</object>`, '<item objectid="1"/><item objectid="2"/>');
    expect(read3MF(pack3mf({ '3D/3dmodel.model': xml })).hasPlacement).toBe(false);
  });
});

describe('lector 3MF: validaciones y límites', () => {
  const single = (mesh: string) => pack3mf({ '3D/3dmodel.model': modelXml(`<object id="1">${mesh}</object>`, '<item objectid="1"/>') });

  it('rechaza índices de triángulo fuera de rango nombrando el archivo', () => {
    const bad = '<mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="3"/></triangles></mesh>';
    expect(errorCode(() => parseModelFile('roto.3mf', single(bad)))).toEqual({ code: 'invalid-index', fileName: 'roto.3mf' });
  });

  it('rechaza coordenadas no numéricas en vez de convertirlas en 0', () => {
    const bad = '<mesh><vertices><vertex x="NaN" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh>';
    expect(errorCode(() => read3MF(single(bad))).code).toBe('non-finite');
    const missing = bad.replace('x="NaN" ', '');
    expect(errorCode(() => read3MF(single(missing))).code).toBe('non-finite');
  });

  it('detecta ciclos de componentes', () => {
    const xml = modelXml(
      '<object id="1"><components><component objectid="2"/></components></object><object id="2"><components><component objectid="1"/></components></object>',
      '<item objectid="1"/>',
    );
    expect(errorCode(() => read3MF(pack3mf({ '3D/3dmodel.model': xml }))).code).toBe('component-cycle');
  });

  it('limita la expansión de instancias (triángulos totales)', () => {
    const items = Array.from({ length: 20 }, () => '<item objectid="1"/>').join('');
    const xml = modelXml(`<object id="1">${cubeMeshXml(10)}</object>`, items);
    expect(errorCode(() => read3MF(pack3mf({ '3D/3dmodel.model': xml }), 'x.3mf', { maxTriangles: 100 })).code).toBe('too-many-triangles');
  });

  it('rechaza paquetes cuyo contenido descomprimido supera el límite (zip bomb) sin descomprimirlos', () => {
    const xml = modelXml(`<object id="1">${cubeMeshXml(10)}</object>`, '<item objectid="1"/>');
    const padding = ' '.repeat(200_000);
    const bomb = pack3mf({ '3D/3dmodel.model': xml + `<!--${padding}-->` });
    expect(bomb.byteLength).toBeLessThan(10_000);
    expect(errorCode(() => read3MF(bomb, 'bomba.3mf', { maxUncompressedBytes: 100_000 })).code).toBe('archive-too-large');
    // Las miniaturas y otros adjuntos no cuentan ni se descomprimen.
    const withThumb = pack3mf({ '3D/3dmodel.model': xml, 'Metadata/plate_1.png': new Uint8Array(300_000) });
    expect(read3MF(withThumb, 't.3mf', { maxUncompressedBytes: 100_000 }).parts).toHaveLength(1);
  });

  it('rechaza archivos truncados o que no son ZIP', () => {
    const good = new Uint8Array(single(cubeMeshXml(10)));
    expect(errorCode(() => read3MF(good.slice(0, good.length - 30).buffer)).code).toBe('corrupt');
    expect(errorCode(() => read3MF(strToU8('hola mundo, no soy un zip').buffer as ArrayBuffer)).code).toBe('corrupt');
    const noModel = zipSync({ 'readme.txt': strToU8('x') });
    expect(errorCode(() => read3MF(noModel.buffer as ArrayBuffer)).code).toBe('missing-model');
  });

  it('rechaza archivos vacíos', () => {
    expect(errorCode(() => parseModelFile('vacio.3mf', new ArrayBuffer(0)))).toEqual({ code: 'empty', fileName: 'vacio.3mf' });
  });
});
