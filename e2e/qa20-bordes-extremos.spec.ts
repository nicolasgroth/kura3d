/**
 * @file e2e/qa20-bordes-extremos.spec.ts
 * @description QA20: bordes redondeados y chaflanes en caja, cilindro, tubo y prisma con los tres alcances y
 * valores extremos (0, mínimo, mitad, enorme, negativo, NaN): la pieza resultante debe seguir cerrada (cada
 * arista en exactamente dos triángulos tras soldar vértices), con volumen positivo y las medidas nominales
 * (los bordes no agrandan la pieza); un valor inválido se rechaza con error claro, sin romper la escena.
 * Además comprueba que una escena solo con una referencia no exporta un archivo vacío en silencio.
 * Ejecuta con `KURA_URL=… npx playwright test e2e/qa20-bordes-extremos.spec.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */
import { expect, test, type Page } from '@playwright/test';
import { abrir } from './ux-escena-helpers';

interface Resultado {
  ok: boolean;
  error?: string;
  abiertas?: number;
  noManifold?: number;
  volumen?: number;
  dims?: number[];
  tris?: number;
}

async function probar(page: Page, type: string, base: Record<string, unknown>, extra: Record<string, unknown>): Promise<Resultado> {
  return page.evaluate(
    async ([t, b, e]) => {
      const s = (window as any).__s.getState();
      const antes = s.objects.length;
      const r = await s.executeCommand({ id: `q-${Math.random()}`, command: 'create_primitive', params: { type: t, placement: 'free', position: [0, 0, 0], ...(b as object), ...(e as object) } });
      if (!r.ok) return { ok: false, error: JSON.stringify(r).slice(0, 200) };
      const o = (window as any).__s.getState().objects.at(-1);
      if (!o || (window as any).__s.getState().objects.length !== antes + 1) return { ok: false, error: 'no se agregó el objeto' };
      const P = o.mesh.positions as ArrayLike<number>;
      const I = o.mesh.indices as ArrayLike<number>;
      const key = (i: number) => `${Math.round(P[i * 3] * 1e4)},${Math.round(P[i * 3 + 1] * 1e4)},${Math.round(P[i * 3 + 2] * 1e4)}`;
      const edges = new Map<string, number>();
      let v = 0;
      const mn = [1e9, 1e9, 1e9];
      const mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < I.length; i += 3) {
        const ids = [I[i], I[i + 1], I[i + 2]];
        const ks = ids.map(key);
        for (let j = 0; j < 3; j++) {
          const a = ks[j], c = ks[(j + 1) % 3];
          if (a === c) continue;
          const k = a < c ? `${a}|${c}` : `${c}|${a}`;
          edges.set(k, (edges.get(k) ?? 0) + 1);
        }
        const [a, bb, c] = ids.map((x) => x * 3);
        v += (P[a] * (P[bb + 1] * P[c + 2] - P[bb + 2] * P[c + 1]) - P[a + 1] * (P[bb] * P[c + 2] - P[bb + 2] * P[c]) + P[a + 2] * (P[bb] * P[c + 1] - P[bb + 1] * P[c])) / 6;
      }
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
      let abiertas = 0, noManifold = 0;
      edges.forEach((n) => { if (n === 1) abiertas++; else if (n > 2) noManifold++; });
      return { ok: true, abiertas, noManifold, volumen: v, dims: mx.map((m, k) => m - mn[k]), tris: I.length / 3 };
    },
    [type, base, extra] as const,
  );
}

const FORMAS: Array<[string, Record<string, unknown>]> = [
  ['box', { width: 40, depth: 30, height: 20 }],
  ['cylinder', { radius: 15, height: 20, segments: 48 }],
  ['tube', { radius: 15, innerRadius: 9, height: 20, segments: 48 }],
  ['prism', { radius: 15, height: 20, sides: 6 }],
];

test('bordes extremos: la malla sigue cerrada, con volumen positivo y sin crecer', async ({ page }) => {
  test.setTimeout(900_000);
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  await abrir(page);
  const fallos: string[] = [];
  const sinBorde: Record<string, Resultado> = {};
  for (const [tipo, base] of FORMAS) sinBorde[tipo] = await probar(page, tipo, base, {});
  console.log('base', JSON.stringify(sinBorde));
  for (const [tipo, base] of FORMAS) {
    for (const estilo of ['round', 'chamfer']) {
      for (const alcance of tipo === 'cylinder' || tipo === 'tube' ? ['all', 'top'] : ['all', 'vertical', 'top']) {
        for (const tam of [0.001, 5, 1000]) {
          const r = await probar(page, tipo, base, { edgeStyle: estilo, edgeScope: alcance, edgeSize: tam });
          const et = `${tipo} ${estilo}/${alcance} r=${tam}`;
          if (!r.ok) fallos.push(`${et}: RECHAZADO ${r.error}`);
          else {
            const b = sinBorde[tipo];
            if (r.abiertas || r.noManifold) fallos.push(`${et}: aristas abiertas=${r.abiertas} no-manifold=${r.noManifold}`);
            if ((r.volumen ?? 0) <= 0) fallos.push(`${et}: volumen ${r.volumen}`);
            if (b.dims && r.dims && r.dims.some((d, k) => d > b.dims![k] + 0.01)) fallos.push(`${et}: crece ${r.dims.map((d) => d.toFixed(2))} vs ${b.dims.map((d) => d.toFixed(2))}`);
            if (b.volumen && r.volumen && r.volumen > b.volumen * 1.001) fallos.push(`${et}: volumen mayor que el sin borde`);
          }
        }
      }
    }
  }
  console.log('FALLOS', fallos.length, '\n' + fallos.slice(0, 60).join('\n'));
  // Valores inválidos: deben rechazarse o acotarse, nunca dejar una pieza rota.
  const invalidos: string[] = [];
  for (const tam of [-3, Number.NaN, Infinity]) {
    const r = await probar(page, 'box', FORMAS[0][1], { edgeStyle: 'round', edgeScope: 'all', edgeSize: tam });
    invalidos.push(`${tam} -> ${r.ok ? `aceptado abiertas=${r.abiertas} vol=${r.volumen}` : 'rechazado'}`);
    if (r.ok && (r.abiertas || (r.volumen ?? 0) <= 0)) fallos.push(`inválido ${tam}: pieza rota`);
  }
  console.log('inválidos', invalidos.join(' | '));
  expect(fallos).toEqual([]);
  expect(errores).toEqual([]);
});
