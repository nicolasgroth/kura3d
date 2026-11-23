/**
 * @file src/store/__tests__/kuraSceneRoundTrip.test.ts
 * @description Ida y vuelta exacta de una escena por 3MF de Kura3D: grupos anidados, colores por cara,
 * un hueco, objetos ocultos y bloqueados, rotaciones y escalas. Exportar -> leer -> restaurar ->
 * comparación profunda. Además: la estructura estándar sigue intacta (build solo con lo impreso, placas
 * por grupo raíz) y un archivo editado por otro programa (conteos distintos) cae al lector normal.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPrimitiveMesh, initManifoldEngine, parseModelFile } from '../../engine';
import { exportSceneTo3MF } from '../../engine/ioFormats';
import { KURA_SCENE_PATH, parseKuraSceneMeta } from '../../engine/io/kuraSceneMeta';
import { buildSceneObject } from '../../core/scene/sceneObjects';
import type { SceneGroup, SceneObject } from '../../types/kura';
import { isKuraScene, restoreKuraScene, type RestoreBuild } from '../kuraSceneRestore';

const toBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
const build: RestoreBuild = (p) => buildSceneObject({ ...p, source: 'imported' });

let scene: SceneObject[];
let groups: SceneGroup[];

beforeAll(async () => {
  await initManifoldEngine();
  const box = await createPrimitiveMesh('box', { width: 10, height: 6, depth: 4 });
  const cyl = await createPrimitiveMesh('cylinder', { radius: 3, height: 8, segments: 16 });
  const painted = { ...box, faceColors: Array.from({ length: box.indices.length / 3 }, (_, i) => (i % 3 === 0 ? '#ff8040' : '#112233')) };
  groups = [
    { id: 'gA', name: 'Placa 1', visible: true, locked: false, collapsed: false },
    { id: 'gB', name: 'Sub <&> «B»', parentId: 'gA', visible: true, locked: true, collapsed: true, lockedByGroup: ['o2'] },
    { id: 'gC', name: 'Placa 2', visible: false, locked: false, collapsed: false, hiddenByGroup: ['o4'] },
  ];
  const obj = (id: string, mesh: typeof box, extra: Partial<SceneObject>): SceneObject => ({
    ...buildSceneObject({ id, name: id, source: 'primitive', mesh, color: '#112233' }),
    ...extra,
  });
  scene = [
    obj('o1', painted, { name: 'Pintado', position: [12.5, 3, -40.25], rotation: [0.3, -1.1, 2.0], scale: [1, 1.5, 0.75], groupRef: 'gA' }),
    obj('o2', cyl, { name: 'Bloqueado', position: [-80, 4, 10], rotation: [0, Math.PI / 2, 0], locked: true, color: '#8000ff', groupRef: 'gB' }),
    obj('o3', box, { name: 'Hueco', position: [-80, 4, 10], isHole: true, color: '#f97316', groupRef: 'gB' }),
    obj('o4', cyl, { name: 'Oculto', position: [150, 4, 120], visible: false, groupRef: 'gC', materialPreset: 'petg_gloss' as SceneObject['materialPreset'] }),
    obj('o5', box, { name: 'Suelto', position: [300, 3, -200], scale: [2, 2, 2], color: '#ffffff', groupRef: 'gC' }),
  ];
});

function roundTrip(objects: SceneObject[], sceneGroups: SceneGroup[]) {
  const bytes = exportSceneTo3MF(objects, 'mm', undefined, undefined, { groups: sceneGroups });
  const model = parseModelFile('escena.3mf', toBuffer(bytes));
  return { bytes, model };
}

describe('3MF de Kura3D: ida y vuelta exacta de la escena', () => {
  it('restaura piezas, nombres, colores, grupos y transformaciones', () => {
    const { model } = roundTrip(scene, groups);
    expect(isKuraScene(model)).toBe(true);
    expect(model.clusters).toEqual([]);
    const restored = restoreKuraScene(model, build);
    expect(restored.objects).toHaveLength(scene.length);
    const byName = new Map(restored.objects.map((o) => [o.name, o]));
    const newGroup = new Map(restored.groups.map((g) => [g.id, g]));
    const oldGroup = new Map(groups.map((g) => [g.id, g]));
    for (const original of scene) {
      const back = byName.get(original.name)!;
      expect(back, original.name).toBeDefined();
      expect(back.position).toEqual(original.position);
      expect(back.rotation).toEqual(original.rotation);
      expect(back.scale).toEqual(original.scale);
      expect(back.color).toBe(original.color);
      expect(back.visible).toBe(original.visible);
      expect(back.locked).toBe(original.locked);
      expect(back.isHole).toBe(original.isHole);
      expect(back.materialPreset).toBe(original.materialPreset);
      expect(newGroup.get(back.groupRef!)?.name).toBe(oldGroup.get(original.groupRef!)?.name);
      // Malla local: misma topología y vértices dentro de la precisión del XML (5 decimales).
      expect(Array.from(back.mesh.indices)).toEqual(Array.from(original.mesh.indices));
      const a = back.mesh.positions, b = original.mesh.positions;
      expect(a.length).toBe(b.length);
      let maxErr = 0;
      for (let i = 0; i < a.length; i++) maxErr = Math.max(maxErr, Math.abs(a[i] - b[i]));
      expect(maxErr).toBeLessThan(1e-3);
      expect(back.mesh.faceColors).toEqual(original.mesh.faceColors);
    }
    // Árbol de grupos: anidado, estados y miembros ocultados/bloqueados por el grupo.
    const strip = (g: SceneGroup, ids: (id: string) => string) => ({
      name: g.name, parent: g.parentId ? ids(g.parentId) : undefined, visible: g.visible, locked: g.locked, collapsed: g.collapsed,
      hidden: g.hiddenByGroup?.map(ids), lockedBy: g.lockedByGroup?.map(ids),
    });
    const nameOfNew = (id: string) => newGroup.get(id)?.name ?? restored.objects.find((o) => o.id === id)?.name ?? id;
    const nameOfOld = (id: string) => oldGroup.get(id)?.name ?? scene.find((o) => o.id === id)?.name ?? id;
    expect(restored.groups.map((g) => strip(g, nameOfNew))).toEqual(groups.map((g) => strip(g, nameOfOld)));
  });

  it('desplaza el bloque entero sin reacomodar las piezas entre sí', () => {
    const { model } = roundTrip(scene, groups);
    const restored = restoreKuraScene(model, build, [500, 0, -20]);
    restored.objects.forEach((o, i) => {
      const original = scene.find((s) => s.name === o.name)!;
      expect(o.position).toEqual([original.position[0] + 500, original.position[1], original.position[2] - 20]);
      expect(i).toBeGreaterThanOrEqual(0);
    });
  });

  it('mantiene la estructura estándar para los laminadores', () => {
    const { bytes } = roundTrip(scene, groups);
    const files = unzipSync(bytes);
    const modelXml = strFromU8(files['3D/3dmodel.model']);
    const settings = strFromU8(files['Metadata/model_settings.config']);
    // Build: solo lo visible y sólido (o1, o2, o5); ocultos y huecos quedan como recursos sin ítem.
    expect(modelXml.match(/<item /g)).toHaveLength(3);
    expect(modelXml.match(/<object /g)).toHaveLength(5);
    // Una placa por grupo raíz con piezas impresas, con su nombre.
    expect(settings.match(/<plate>/g)).toHaveLength(2);
    expect(settings).toContain('value="Placa 1"');
    expect(settings).toContain('value="Placa 2"');
    expect(Object.keys(files)).toContain(KURA_SCENE_PATH);
    expect(strFromU8(files['[Content_Types].xml'])).toContain('Extension="json"');
    // Un lector sin los metadatos (como un laminador) ve las 3 piezas impresas con sus placas.
    delete files[KURA_SCENE_PATH];
    const plain = parseModelFile('plano.3mf', toBuffer(zipSync(files)));
    expect(plain.kuraScene).toBeUndefined();
    expect(plain.parts).toHaveLength(3);
    expect(plain.plates).toHaveLength(2);
  });

  it('cae al lector normal si otro programa cambió la malla', () => {
    const { bytes } = roundTrip(scene, groups);
    const files = unzipSync(bytes);
    const meta = JSON.parse(strFromU8(files[KURA_SCENE_PATH]));
    meta.objects[0].triangles += 1;
    files[KURA_SCENE_PATH] = strToU8(JSON.stringify(meta));
    const model = parseModelFile('editado.3mf', toBuffer(zipSync(files)));
    expect(model.kuraScene).toBeUndefined();
    expect(model.parts).toHaveLength(3);
  });
});

describe('metadatos de escena hostiles', () => {
  const valid = () => ({
    namespace: 'https://kura3d.app/3mf/scene/1',
    objects: [{ objectId: '2', name: 'a', position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: '#fff', visible: true, locked: false, isHole: false, vertices: 3, triangles: 1 }],
    groups: [] as unknown[],
  });
  it('rechaza espacio de nombres ajeno, JSON roto, números no finitos y escala cero', () => {
    expect(parseKuraSceneMeta('{', 10)).toBeNull();
    expect(parseKuraSceneMeta(JSON.stringify({ ...valid(), namespace: 'x' }), 10)).toBeNull();
    const nan = valid();
    (nan.objects[0] as { position: unknown }).position = [0, 'a', 0];
    expect(parseKuraSceneMeta(JSON.stringify(nan), 10)).toBeNull();
    const zero = valid();
    zero.objects[0].scale = [1, 0, 1];
    expect(parseKuraSceneMeta(JSON.stringify(zero), 10)).toBeNull();
    expect(parseKuraSceneMeta(JSON.stringify(valid()), 0)).toBeNull();
    expect(parseKuraSceneMeta('x'.repeat(4 * 1024 * 1024 + 1), 10)).toBeNull();
  });
  it('corta ciclos de grupos y descarta índices fuera de rango', () => {
    const cyc = valid();
    cyc.groups = [
      { name: 'a', parent: 1, visible: true, locked: false, collapsed: false, hiddenByGroup: [0, 7, -1] },
      { name: 'b', parent: 0, visible: true, locked: false, collapsed: false },
      { name: 'c', parent: 99, visible: true, locked: false, collapsed: false },
    ];
    const meta = parseKuraSceneMeta(JSON.stringify(cyc), 10)!;
    expect(meta).not.toBeNull();
    const parentOf = (i: number) => meta.groups[i].parent;
    // Ningún grupo es su propio ancestro.
    for (let i = 0; i < meta.groups.length; i++) {
      let cursor = parentOf(i);
      for (let steps = 0; cursor !== undefined && steps < 10; steps++) {
        expect(cursor).not.toBe(i);
        cursor = parentOf(cursor);
      }
    }
    expect(meta.groups[0].hiddenByGroup).toEqual([0]);
    expect(meta.groups[2].parent).toBeUndefined();
  });
});
