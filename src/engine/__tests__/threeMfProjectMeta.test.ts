/**
 * @file src/engine/__tests__/threeMfProjectMeta.test.ts
 * @description Datos del proyecto en el 3MF: nombre, descripción y autor viajan como metadatos estándar `Title`,
 * `Description` y `Designer`, escapados; vacíos o ausentes no cambian ni un byte; el archivo se sigue leyendo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { strFromU8, unzipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { BRAND } from '../../brand';
import { projectMetaOf } from '../../project/projectMeta3mf';
import type { SceneObject } from '../../types/kura';
import { createPrimitiveMesh, initManifoldEngine } from '../index';
import { exportSceneTo3MF } from '../ioFormats';
import { projectMetadataXml } from '../io/threeMfExport';
import { read3MF } from '../io/threeMfImport';
import { makeObject } from './geometryTestUtils';

let scene: SceneObject[];
beforeAll(async () => {
  await initManifoldEngine();
  scene = [makeObject('cubo', await createPrimitiveMesh('box', { width: 10, height: 10, depth: 10 }))];
});

const model = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)['3D/3dmodel.model']);
const asBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe('3MF: datos del proyecto como metadatos estándar', () => {
  it('sin datos (ausentes, vacíos o solo espacios) el archivo es idéntico byte a byte', () => {
    const base = exportSceneTo3MF(scene, 'mm', undefined, BRAND);
    for (const meta of [undefined, {}, { title: '', description: '   ', designer: null }, projectMetaOf({ projectName: null, projectInfo: {} })]) {
      expect(exportSceneTo3MF(scene, 'mm', undefined, BRAND, undefined, undefined, meta)).toEqual(base);
    }
    expect(projectMetadataXml({ title: ' ' })).toBe('');
  });

  it('nombre, descripción y autor van como Title, Description y Designer, escapados', () => {
    const meta = projectMetaOf({ projectName: 'Soporte <A&B>', projectInfo: { description: 'Pieza "uno" & \'dos\'', author: 'Ana Pérez' } });
    const xml = model(exportSceneTo3MF(scene, 'mm', undefined, BRAND, undefined, undefined, meta));
    expect(xml).toContain('<metadata name="Title">Soporte &lt;A&amp;B&gt;</metadata>');
    expect(xml).toContain('<metadata name="Description">Pieza &quot;uno&quot; &amp; &apos;dos&apos;</metadata>');
    expect(xml).toContain('<metadata name="Designer">Ana Pérez</metadata>');
    // Antes de <resources> (los metadatos del modelo van primero, como manda el núcleo del 3MF).
    expect(xml.indexOf('name="Designer"')).toBeLessThan(xml.indexOf('<resources>'));
    // Un intento de inyectar XML queda como texto: un solo <resources> y ningún elemento nuevo.
    const evil = model(exportSceneTo3MF(scene, 'mm', undefined, BRAND, undefined, undefined, { title: '</metadata><resources>' }));
    expect(evil.match(/<resources>/g)).toHaveLength(1);
  });

  it('el 3MF con metadatos se sigue importando igual (mismos triángulos)', () => {
    const plain = read3MF(asBuffer(exportSceneTo3MF(scene, 'mm', undefined, BRAND)));
    const withMeta = read3MF(asBuffer(exportSceneTo3MF(scene, 'mm', undefined, BRAND, undefined, undefined, { title: 'P', description: 'D', designer: 'A' })));
    expect(withMeta.parts.length).toBe(plain.parts.length);
    expect(withMeta.parts[0].mesh.indices.length).toBe(plain.parts[0].mesh.indices.length);
  });
});
