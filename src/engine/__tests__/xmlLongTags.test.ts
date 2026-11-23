/**
 * @file src/engine/__tests__/xmlLongTags.test.ts
 * @description Etiquetas XML de más de 64 KiB: en las pasadas de metadatos del laminador (miniaturas en
 * base64 o textos largos dentro de un atributo) se saltan sin rechazar el archivo; en la geometría y en
 * etiquetas sin cerrar siguen siendo archivo dañado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { read3MF } from '../io/threeMfImport';
import { MAX_XML_TAG_LENGTH, forEachLeaf } from '../io/xmlScan';
import { cubeMeshXml, modelXml, pack3mf } from './ioFixtures';

const codeOf = (fn: () => unknown) => {
  try {
    fn();
    return 'ok';
  } catch (error) {
    return (error as { code?: string }).code ?? String(error);
  }
};

/** Atributo con una "miniatura" en base64 más larga que el tope de etiqueta. */
const thumbnail = `data:image/png;base64,${'iVBORw0KGgo'.repeat(Math.ceil((MAX_XML_TAG_LENGTH * 2) / 11))}`;

describe('etiquetas largas en metadatos', () => {
  it('forEachLeaf con skipOversized salta la etiqueta larga y sigue con las demás', () => {
    const xml = `<config><metadata key="thumbnail" value="${thumbnail}"/><metadata key="name" value="Pieza"/></config>`;
    const seen: string[] = [];
    forEachLeaf(xml, 'metadata', (attrs) => { seen.push(attrs); }, { skipOversized: true });
    expect(seen).toEqual([' key="name" value="Pieza"']);
  });

  it('sin la opción (geometría) la etiqueta larga sigue siendo archivo dañado', () => {
    const xml = `<metadata key="thumbnail" value="${thumbnail}"/>`;
    expect(codeOf(() => forEachLeaf(xml, 'metadata', () => {}))).toBe('corrupt');
  });

  it('una etiqueta larga sin cerrar (con otro `<` dentro) es dañada aunque se pida saltar', () => {
    const xml = `<metadata key="x" value="${thumbnail}"<metadata key="name" value="b"/>`;
    expect(codeOf(() => forEachLeaf(xml, 'metadata', () => {}, { skipOversized: true }))).toBe('corrupt');
  });

  it('un 3MF de Bambu/Orca con una miniatura en un atributo de model_settings.config se importa con sus nombres', () => {
    const settings = '<?xml version="1.0"?><config>' +
      `<object id="1"><metadata key="thumbnail" value="${thumbnail}"/><metadata key="name" value="Cabeza"/></object>` +
      `<plate><metadata key="plater_id" value="1"/><metadata key="thumbnail_file" value="${thumbnail}"/>` +
      '<model_instance><metadata key="object_id" value="1"/><metadata key="instance_id" value="0"/></model_instance></plate>' +
      '</config>';
    const model = read3MF(pack3mf({
      '3D/3dmodel.model': modelXml(`<object id="1">${cubeMeshXml(10)}</object>`, '<item objectid="1"/>'),
      'Metadata/model_settings.config': settings,
    }), 'bambu.3mf');
    expect(model.parts).toHaveLength(1);
    expect(model.parts[0].name).toBe('Cabeza');
  });

  it('un vértice con una etiqueta de más de 64 KiB sigue rechazándose (la geometría no se salta)', () => {
    const mesh = `<mesh><vertices><vertex x="0" y="0" z="0" junk="${'a'.repeat(MAX_XML_TAG_LENGTH + 10)}"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh>`;
    expect(codeOf(() => read3MF(pack3mf({ '3D/3dmodel.model': modelXml(`<object id="1">${mesh}</object>`, '<item objectid="1"/>') }), 'x.3mf'))).toBe('corrupt');
  });
});
