/**
 * @file src/project/__tests__/projectInfo.test.ts
 * @description Datos del proyecto en el `.kura` (versión 5): ida y vuelta con y sin datos, un proyecto antiguo sin
 * datos abre igual y se guarda sin campos vacíos, la versión solo sube si hay datos, y archivos maliciosos
 * (textos enormes, tipos erróneos, fechas inválidas o absurdas, controles, claves ajenas, `info` en una versión
 * que no lo admite) se rechazan; el HTML llega intacto como texto. El borrador de recuperación también los conserva.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { decodeProject, encodeProjectImage, INFO_FORMAT_VERSION, PLATES_FORMAT_VERSION, ProjectCodecError, type ProjectDocument } from '../projectCodec';
import { PROJECT_INFO_LIMITS, cleanInfoText, compactInfo, isValidInfoDate, sameInfoContent, validStoredInfo } from '../projectInfo';
import { assembleDocument, splitDocument } from '../recoveryDraftFormat';
import { repackKura } from './legacyKura';

const doc = (info?: ProjectDocument['info']): ProjectDocument => ({
  objects: [], selectedIds: [], past: [], future: [],
  unitSystem: 'mm', printerProfile: DEFAULT_PRINTER_PROFILES[0], customBedDimensions: null,
  sectionPlane: { enabled: false, heightMm: 25 }, snapGridMm: 1,
  ...(info ? { info } : {}),
});

const versionOf = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
const FULL = {
  description: 'Soporte de auriculares', notes: 'Línea 1\n\tLínea 2 — ñ 文 🧊', author: 'Ana',
  createdAt: '2026-11-20T10:00:00Z', modifiedAt: '2026-11-23T14:05:09.123Z', workSeconds: 8100,
};

/** Reescribe `info` en el manifiesto de un archivo ya guardado (con CRC recalculado). */
const withInfo = (info: unknown, version = INFO_FORMAT_VERSION) =>
  repackKura(encodeProjectImage(doc(FULL)), version, (m) => { (m as unknown as { info: unknown }).info = info; });

describe('datos del proyecto en el .kura', () => {
  it('ida y vuelta con todos los datos', () => {
    const bytes = encodeProjectImage(doc(FULL));
    expect(versionOf(bytes)).toBe(INFO_FORMAT_VERSION);
    expect(decodeProject(bytes).info).toEqual(FULL);
  });

  it('sin datos: versión 3, sin `info`, y abre igual', () => {
    const bytes = encodeProjectImage(doc());
    expect(versionOf(bytes)).toBe(3);
    expect(decodeProject(bytes).info).toBeUndefined();
    // Campos vacíos o solo espacios no se guardan.
    const empty = encodeProjectImage(doc({ description: '   ', notes: '\n\n', author: '', workSeconds: 0 }));
    expect(versionOf(empty)).toBe(3);
    expect(decodeProject(empty).info).toBeUndefined();
  });

  it('un proyecto antiguo (v3 y v4) sin datos abre y se guarda sin campos vacíos', () => {
    for (const version of [3, PLATES_FORMAT_VERSION]) {
      const old = repackKura(encodeProjectImage(doc()), version);
      const opened = decodeProject(old);
      expect(opened.info).toBeUndefined();
      const resaved = encodeProjectImage(opened);
      const manifest = JSON.parse(new TextDecoder().decode(resaved.subarray(16, 16 + new DataView(resaved.buffer).getUint32(8, true))));
      expect(Object.keys(manifest)).not.toContain('info');
      expect(versionOf(resaved)).toBe(3);
    }
  });

  it('guarda solo los campos presentes (una fecha sola basta y no inventa el resto)', () => {
    const back = decodeProject(encodeProjectImage(doc({ modifiedAt: '2026-01-02T03:04:05Z' })));
    expect(back.info).toEqual({ modifiedAt: '2026-01-02T03:04:05Z' });
  });

  it('el HTML y los scripts viajan como texto, sin tocarse', () => {
    const html = '<script>alert(1)</script><img src=x onerror=alert(2)> &amp; "q"';
    expect(decodeProject(encodeProjectImage(doc({ description: html, notes: html }))).info).toEqual({ description: html, notes: html });
  });

  it('un archivo anterior a v5 no puede traer `info`', () => {
    expect(() => decodeProject(withInfo({ description: 'x' }, 4))).toThrow(ProjectCodecError);
    expect(() => decodeProject(withInfo({ description: 'x' }, 3))).toThrow(ProjectCodecError);
    expect(decodeProject(withInfo({ description: 'x' }, 5)).info).toEqual({ description: 'x' });
  });

  it('rechaza archivos maliciosos en `info`', () => {
    const hostile: Array<[string, unknown]> = [
      ['no es objeto', 'texto'],
      ['arreglo', ['a']],
      ['null', null],
      ['clave ajena', { description: 'x', extra: 1 }],
      ['__proto__', JSON.parse('{"__proto__": {"x": 1}}')],
      ['descripción de tipo erróneo', { description: 42 }],
      ['notas como objeto', { notes: { html: '<b>' } }],
      ['descripción enorme', { description: 'a'.repeat(PROJECT_INFO_LIMITS.description + 1) }],
      ['notas enormes', { notes: 'a'.repeat(PROJECT_INFO_LIMITS.notes + 1) }],
      ['autor enorme', { author: 'a'.repeat(PROJECT_INFO_LIMITS.author + 1) }],
      ['salto de línea en la descripción', { description: 'a\nb' }],
      ['carácter nulo', { notes: 'a\u0000b' }],
      ['control C1', { author: 'a\u0085b' }],
      ['marca bidireccional', { description: 'a\u202eb' }],
      ['sustituto suelto', { description: 'a\ud800b' }],
      ['fecha no ISO', { createdAt: 'ayer' }],
      ['fecha con zona', { createdAt: '2026-11-20T10:00:00+02:00' }],
      ['fecha imposible', { createdAt: '2026-02-31T10:00:00Z' }],
      ['hora imposible', { modifiedAt: '2026-11-20T25:00:00Z' }],
      ['fecha absurda (siglo pasado)', { createdAt: '1970-01-01T00:00:00Z' }],
      ['fecha absurda (futuro lejano)', { modifiedAt: '9999-12-31T00:00:00Z' }],
      ['fecha como número', { createdAt: 1_700_000_000_000 }],
      ['tiempo negativo', { workSeconds: -1 }],
      ['tiempo decimal', { workSeconds: 1.5 }],
      ['tiempo absurdo', { workSeconds: PROJECT_INFO_LIMITS.maxWorkSeconds + 1 }],
      ['tiempo como texto', { workSeconds: '30' }],
    ];
    for (const [label, info] of hostile) {
      expect(() => decodeProject(withInfo(info)), label).toThrow(ProjectCodecError);
    }
  });

  it('el límite exacto se acepta', () => {
    const edge = { description: 'd'.repeat(500), notes: 'n'.repeat(20_000), author: 'a'.repeat(120), workSeconds: PROJECT_INFO_LIMITS.maxWorkSeconds };
    expect(decodeProject(encodeProjectImage(doc(edge))).info).toEqual(edge);
  });

  it('escribir información inválida falla antes de producir un archivo', () => {
    expect(() => encodeProjectImage(doc({ createdAt: 'mañana' }))).toThrow(ProjectCodecError);
    expect(() => encodeProjectImage(doc({ description: 'a'.repeat(501) }))).toThrow(ProjectCodecError);
  });
});

describe('borrador de recuperación con datos del proyecto', () => {
  it('conserva los datos y rechaza un `info` dañado', async () => {
    const { manifest, blocks } = await splitDocument(doc(FULL));
    const words = new Map([...blocks].map(([key, block]) => [key, block.words] as const));
    expect(assembleDocument(JSON.parse(JSON.stringify(manifest)), words).info).toEqual(FULL);
    expect(() => assembleDocument({ ...JSON.parse(JSON.stringify(manifest)), info: { description: 7 } }, words)).toThrow(ProjectCodecError);
    // Borrador anterior (sin `info`) o proyecto sin datos: igual que antes.
    const plain = await splitDocument(doc());
    expect('info' in plain.manifest).toBe(false);
    expect(assembleDocument(JSON.parse(JSON.stringify(plain.manifest)), new Map()).info).toBeUndefined();
  });
});

describe('utilidades de datos del proyecto', () => {
  it('cleanInfoText quita controles y bidi, aplana la línea y respeta el tope', () => {
    expect(cleanInfoText('a\u0000b\u202ec', 'description')).toBe('abc');
    expect(cleanInfoText('uno\ndos\ttres', 'description')).toBe('uno dos tres');
    expect(cleanInfoText('a\r\nb\rc\u0007', 'notes')).toBe('a\nb\nc');
    expect(cleanInfoText('x'.repeat(900), 'description')).toHaveLength(PROJECT_INFO_LIMITS.description);
    // No parte un par sustituto al recortar.
    expect(cleanInfoText(`${'a'.repeat(119)}🧊`, 'author')).toBe('a'.repeat(119));
  });

  it('isValidInfoDate acepta ISO UTC real y rechaza el resto', () => {
    expect(isValidInfoDate('2026-11-23T14:05:00Z')).toBe(true);
    expect(isValidInfoDate('2026-11-23T14:05:00.5Z')).toBe(true);
    expect(isValidInfoDate('2024-02-29T00:00:00Z')).toBe(true);
    expect(isValidInfoDate('2026-02-29T00:00:00Z')).toBe(false);
    expect(isValidInfoDate('2026-11-23')).toBe(false);
    expect(isValidInfoDate(undefined)).toBe(false);
  });

  it('compactInfo y sameInfoContent ignoran vacíos, espacios finales, fecha de guardado y reloj', () => {
    expect(compactInfo({ description: '  ', notes: '\n', workSeconds: 0 })).toBeUndefined();
    expect(compactInfo({ description: ' hola ' })).toEqual({ description: 'hola' });
    expect(sameInfoContent({ description: 'a', modifiedAt: '2026-01-01T00:00:00Z', workSeconds: 5 }, { description: 'a ', workSeconds: 99 })).toBe(true);
    expect(sameInfoContent({ description: 'a' }, { description: 'b' })).toBe(false);
    expect(sameInfoContent(undefined, { createdAt: '2026-01-01T00:00:00Z' })).toBe(false);
    expect(validStoredInfo({})).toBe(true);
  });
});
