/**
 * @file src/engine/__tests__/textFont.test.ts
 * @description Texto 3D con fuente real (Roboto Bold vía opentype.js): sólidos manifold, cuerpos y
 * agujeros por glifo, alto de mayúscula = tamaño, kerning/espaciado/alineación, rendimiento y error
 * tipado para caracteres que la fuente no tiene.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { primitiveParamsSchema } from '../../../mcp-server/src/schemas';
import { parseCreatePrimitive } from '../../store/commandSchemas';
import { EngineError } from '../engineErrors';
import { initManifoldEngine, meshDataToManifold } from '../manifoldKernel';
import { computeMeshStats, createPrimitiveMesh } from '../primitives';
import type { MeshData } from '../../types/kura';
import { DEFAULT_TEXT_FONT_ID, loadTextFont } from '../text/fontRegistry';
import { ROBOTO_BOLD_LATIN_WOFF_BASE64 } from '../text/fonts/robotoBoldLatin';
import { layoutTextOutlines } from '../text/textOutlines';

interface NodeFs {
  readFileSync(path: URL): { toString(encoding: 'base64' | 'utf8'): string };
}
const nodeFs = (globalThis as unknown as { process: { getBuiltinModule: (id: string) => NodeFs } }).process.getBuiltinModule('node:fs');
const asset = (name: string) => nodeFs.readFileSync(new URL(`../../assets/fonts/${name}`, import.meta.url));
const minY = (mesh: MeshData) => mesh.positions.filter((_, i) => i % 3 === 1).reduce((a, b) => Math.min(a, b), Infinity);

/** Cuerpos (componentes conexas) y género de la malla. */
async function topology(text: string, fontSize = 10) {
  const mesh = await createPrimitiveMesh('text', { text, fontSize, height: 2 });
  const m = meshDataToManifold(await initManifoldEngine(), mesh);
  try {
    const parts = m.decompose();
    const genus = parts.map((p) => p.genus());
    parts.forEach((p) => p.delete());
    return { mesh, bodies: genus.length, genus };
  } finally {
    m.delete();
  }
}

beforeAll(async () => {
  await initManifoldEngine();
});

describe('texto 3D con fuente real', () => {
  it('la fuente embebida es la copia exacta del .woff con licencia en src/assets/fonts', () => {
    expect(ROBOTO_BOLD_LATIN_WOFF_BASE64).toBe(asset('Roboto-Bold-latin.woff').toString('base64'));
    expect(asset('Roboto-OFL.txt').toString('utf8')).toContain('SIL Open Font License');
  });

  it.each(['Kura3D', 'Ñandú 8%', '¿Qué?', '¡Hola, señor Müller! 0123456789 #&@()-+'])(
    '"%s" sale manifold y apoyado en la cama',
    async (text) => {
      const mesh = await createPrimitiveMesh('text', { text, fontSize: 10, height: 2 });
      const stats = computeMeshStats(mesh);
      expect(stats.isManifold).toBe(true);
      expect(stats.volumeMm3).toBeGreaterThan(0);
      expect(minY(mesh)).toBeCloseTo(0, 4);
      expect(stats.dimensionsMm[1]).toBeCloseTo(2, 3);
    }
  );

  it('"O" es un cuerpo con un agujero pasante (género 1)', async () => {
    const { bodies, genus } = await topology('O');
    expect(bodies).toBe(1);
    expect(genus).toEqual([1]);
  });

  it('"i" son dos cuerpos sin agujeros; "8" uno con dos agujeros', async () => {
    const i = await topology('i');
    expect(i.bodies).toBe(2);
    expect(i.genus).toEqual([0, 0]);
    const eight = await topology('8');
    expect(eight.bodies).toBe(1);
    expect(eight.genus).toEqual([2]);
  });

  it('"tamaño" es el alto de mayúscula: "H" a 10 mm mide 10 mm de alto en planta', async () => {
    const mesh = await createPrimitiveMesh('text', { text: 'H', fontSize: 10, height: 2 });
    // El texto queda acostado: su alto de letra corre sobre Z.
    expect(computeMeshStats(mesh).dimensionsMm[2]).toBeCloseTo(10, 1);
  });

  it('"Kura3D" a 10 mm tiene un ancho razonable (entre 38 y 50 mm)', async () => {
    const mesh = await createPrimitiveMesh('text', { text: 'Kura3D', fontSize: 10, height: 2 });
    const [w, , d] = computeMeshStats(mesh).dimensionsMm;
    expect(w).toBeGreaterThan(38);
    expect(w).toBeLessThan(50);
    expect(d).toBeGreaterThan(9.9); // la "K" llega al alto de mayúscula
  });

  it('aplica el kerning de la fuente ("AV" más estrecho que "A" + "V")', async () => {
    const face = await loadTextFont(DEFAULT_TEXT_FONT_ID);
    const av = layoutTextOutlines(face, 'AV', { size: 10 }).advanceWidth;
    const a = layoutTextOutlines(face, 'A', { size: 10 }).advanceWidth;
    const v = layoutTextOutlines(face, 'V', { size: 10 }).advanceWidth;
    expect(av).toBeLessThan(a + v - 0.2);
  });

  it('el espaciado entre letras ensancha el texto (n-1) veces el valor', async () => {
    const base = await createPrimitiveMesh('text', { text: 'KURA', fontSize: 10, height: 2 });
    const spaced = await createPrimitiveMesh('text', { text: 'KURA', fontSize: 10, height: 2, letterSpacing: 2 });
    const dw = computeMeshStats(spaced).dimensionsMm[0] - computeMeshStats(base).dimensionsMm[0];
    expect(dw).toBeCloseTo(6, 1);
    expect(computeMeshStats(spaced).isManifold).toBe(true);
  });

  it('alinea las líneas a izquierda, centro o derecha', async () => {
    const face = await loadTextFont(DEFAULT_TEXT_FONT_ID);
    const lineStarts = (align: 'left' | 'center' | 'right') =>
      layoutTextOutlines(face, 'WWWW\nI', { size: 10, align }).lines.map((l) => l.x);
    const [wideL, narrowL] = lineStarts('left');
    expect(narrowL).toBeCloseTo(wideL, 6);
    const [wideR, narrowR] = lineStarts('right');
    expect(narrowR).toBeGreaterThan(wideR + 20);
    const [wideC, narrowC] = lineStarts('center');
    expect(narrowC).toBeGreaterThan(wideC);
    expect(narrowC).toBeLessThan(narrowR);
    const mesh = await createPrimitiveMesh('text', { text: 'WWWW\nI', fontSize: 10, height: 2, textAlign: 'right' });
    expect(computeMeshStats(mesh).isManifold).toBe(true);
  });

  it('una frase de 40 caracteres sale manifold y cuesta proporcional al texto', async () => {
    const text = 'Kura3D imprime piezas: ñandú, cigüeña 42';
    expect(text.length).toBe(40);
    await createPrimitiveMesh('text', { text: 'warm', fontSize: 10, height: 2 });
    const t0 = performance.now();
    await createPrimitiveMesh('text', { text: 'warm', fontSize: 10, height: 2 });
    const short = performance.now() - t0;
    const t1 = performance.now();
    const mesh = await createPrimitiveMesh('text', { text, fontSize: 10, height: 2 });
    const elapsed = performance.now() - t1;
    expect(computeMeshStats(mesh).isManifold).toBe(true);
    // 10× los caracteres no debe costar más de ~40× (referencia medida en la misma corrida).
    expect(elapsed).toBeLessThan(Math.max(short, 5) * 40);
  });

  it('un carácter que la fuente no tiene devuelve TEXT_GLYPH_MISSING nombrando los caracteres', async () => {
    const err = await createPrimitiveMesh('text', { text: 'Hola 中文 नमस्ते' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EngineError);
    expect((err as EngineError).code).toBe('TEXT_GLYPH_MISSING');
    expect(String((err as EngineError).params.chars)).toContain('中');
    expect(String((err as EngineError).params.chars)).toContain('न');
  });

  it('el Command Bus y el MCP aceptan textAlign solo con sus valores', () => {
    expect(parseCreatePrimitive({ type: 'text', textAlign: 'center', letterSpacing: 1.5 }).params).toMatchObject({
      textAlign: 'center',
      letterSpacing: 1.5,
    });
    expect(() => parseCreatePrimitive({ type: 'text', textAlign: 'justify' })).toThrow();
    expect(primitiveParamsSchema.safeParse({ textAlign: 'right' }).success).toBe(true);
    expect(primitiveParamsSchema.safeParse({ textAlign: 'justify' }).success).toBe(false);
  });

  it('rechaza una alineación o espaciado fuera de rango', async () => {
    await expect(createPrimitiveMesh('text', { text: 'A', letterSpacing: 1000 })).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
    await expect(
      createPrimitiveMesh('text', { text: 'A', textAlign: 'justify' as unknown as 'left' })
    ).rejects.toMatchObject({ code: 'INVALID_PARAMETER' });
  });
});
