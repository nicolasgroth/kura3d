/**
 * @file src/engine/tJunctions.ts
 * @description Cierre de uniones en T al coser dos superficies: cuando un borde de una queda
 * subdividido con vértices que la otra no tiene, cada triángulo de borde se divide en abanico en
 * esos vértices intermedios. Solo mira aristas de borde (sin gemela), así el costo es pequeño.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/**
 * Divide los triángulos cuyas aristas de borde contienen vértices de borde colineales. Devuelve
 * índices nuevos y, para cada triángulo, el índice del triángulo de entrada del que proviene.
 */
export function splitTJunctions(
  positions: Float32Array,
  indices: Uint32Array,
  toleranceMm = 1e-4,
  maxPasses = 4
): { indices: Uint32Array; triangleSource: Uint32Array } {
  let tris = Array.from(indices);
  let source = Array.from({ length: indices.length / 3 }, (_, i) => i);
  for (let pass = 0; pass < maxPasses; pass++) {
    const directed = new Set<string>();
    for (let t = 0; t < tris.length; t += 3) {
      for (let c = 0; c < 3; c++) directed.add(`${tris[t + c]}:${tris[t + ((c + 1) % 3)]}`);
    }
    const boundaryVerts = new Set<number>();
    for (let t = 0; t < tris.length; t += 3) {
      for (let c = 0; c < 3; c++) {
        const a = tris[t + c];
        const b = tris[t + ((c + 1) % 3)];
        if (!directed.has(`${b}:${a}`)) {
          boundaryVerts.add(a);
          boundaryVerts.add(b);
        }
      }
    }
    if (boundaryVerts.size === 0) break;
    const candidates = Array.from(boundaryVerts);
    const outTris: number[] = [];
    const outSource: number[] = [];
    let changed = false;
    for (let t = 0; t < tris.length; t += 3) {
      const tri = [tris[t], tris[t + 1], tris[t + 2]];
      let split = false;
      for (let c = 0; c < 3 && !split; c++) {
        const a = tri[c];
        const b = tri[(c + 1) % 3];
        const opp = tri[(c + 2) % 3];
        if (directed.has(`${b}:${a}`)) continue;
        const inner = verticesOnSegment(positions, a, b, candidates, toleranceMm);
        if (inner.length === 0) continue;
        const chain = [a, ...inner, b];
        for (let k = 0; k + 1 < chain.length; k++) {
          outTris.push(chain[k], chain[k + 1], opp);
          outSource.push(source[t / 3]);
        }
        split = true;
      }
      if (split) {
        changed = true;
      } else {
        outTris.push(...tri);
        outSource.push(source[t / 3]);
      }
    }
    tris = outTris;
    source = outSource;
    if (!changed) break;
  }
  return { indices: new Uint32Array(tris), triangleSource: new Uint32Array(source) };
}

/** Vértices de `candidates` estrictamente dentro del segmento a–b (a distancia ≤ tol), ordenados de a a b. */
function verticesOnSegment(p: Float32Array, a: number, b: number, candidates: number[], tol: number): number[] {
  const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
  const dx = p[b * 3] - ax, dy = p[b * 3 + 1] - ay, dz = p[b * 3 + 2] - az;
  const len2 = dx * dx + dy * dy + dz * dz;
  if (len2 <= tol * tol) return [];
  const hits: Array<[number, number]> = [];
  for (const v of candidates) {
    if (v === a || v === b) continue;
    const vx = p[v * 3] - ax, vy = p[v * 3 + 1] - ay, vz = p[v * 3 + 2] - az;
    const s = (vx * dx + vy * dy + vz * dz) / len2;
    if (s <= 1e-9 || s >= 1 - 1e-9) continue;
    const ex = vx - s * dx, ey = vy - s * dy, ez = vz - s * dz;
    if (ex * ex + ey * ey + ez * ez <= tol * tol) hits.push([s, v]);
  }
  hits.sort((x, y) => x[0] - y[0]);
  return hits.map((h) => h[1]);
}
