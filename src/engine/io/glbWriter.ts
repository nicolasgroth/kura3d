/**
 * @file src/engine/io/glbWriter.ts
 * @description Escritor GLB (glTF 2.0 binario) sin APIs del navegador: arma el JSON y el trozo BIN
 * a mano (cabecera de 12 bytes, trozo JSON con relleno de espacios y trozo BIN con relleno de
 * ceros, ambos alineados a 4). Sirve igual en la app, en Workers, en el servidor MCP y en pruebas.
 * Una malla por objeto con POSITION (metros) y NORMAL compartidos y una primitiva por color.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Malla lista para escribir: posiciones en metros (Y-up) y triángulos agrupados por color. */
export interface GlbMeshInput {
  name: string;
  positions: Float32Array;
  normals: Float32Array;
  groups: Array<{ color: string; indices: Uint32Array }>;
}

const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const FLOAT = 5126;
const UNSIGNED_INT = 5125;

/** Componente sRGB (0..1) a lineal, como espera `baseColorFactor` de glTF. */
const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

function linearColor(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => srgbToLinear(((n >> shift) & 255) / 255);
  return [ch(16), ch(8), ch(0), 1];
}

/**
 * Construye el contenedor GLB. `sceneName` y `generator` los entrega quien exporta (la marca de la
 * app); por omisión son neutros.
 */
export function writeGlb(meshes: GlbMeshInput[], sceneName = 'Scene', generator = 'glTF 2.0 writer'): Uint8Array {
  const chunks: Uint8Array[] = [];
  let binLength = 0;
  const bufferViews: Record<string, unknown>[] = [];
  const accessors: Record<string, unknown>[] = [];
  const materials: Record<string, unknown>[] = [];
  const materialIndex = new Map<string, number>();
  const gltfMeshes: Record<string, unknown>[] = [];
  const nodes: Record<string, unknown>[] = [];

  const addView = (data: Float32Array | Uint32Array, target: number): number => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    chunks.push(bytes);
    bufferViews.push({ buffer: 0, byteOffset: binLength, byteLength: bytes.byteLength, target });
    binLength += bytes.byteLength; // Float32/Uint32: siempre múltiplo de 4, sin relleno intermedio
    return bufferViews.length - 1;
  };

  for (const mesh of meshes) {
    const count = mesh.positions.length / 3;
    if (count === 0 || mesh.groups.every((g) => g.indices.length === 0)) continue;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 3; k++) {
        const v = mesh.positions[i * 3 + k];
        if (v < min[k]) min[k] = v;
        if (v > max[k]) max[k] = v;
      }
    }
    accessors.push({ bufferView: addView(mesh.positions, ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3', min, max });
    const position = accessors.length - 1;
    accessors.push({ bufferView: addView(mesh.normals, ARRAY_BUFFER), componentType: FLOAT, count, type: 'VEC3' });
    const normal = accessors.length - 1;

    const primitives = mesh.groups
      .filter((g) => g.indices.length > 0)
      .map((g) => {
        accessors.push({ bufferView: addView(g.indices, ELEMENT_ARRAY_BUFFER), componentType: UNSIGNED_INT, count: g.indices.length, type: 'SCALAR' });
        let material = materialIndex.get(g.color);
        if (material === undefined) {
          material = materials.length;
          materialIndex.set(g.color, material);
          materials.push({
            name: `kura_${g.color.slice(1)}`,
            pbrMetallicRoughness: { baseColorFactor: linearColor(g.color), metallicFactor: 0, roughnessFactor: 0.6 },
          });
        }
        return { attributes: { POSITION: position, NORMAL: normal }, indices: accessors.length - 1, material, mode: 4 };
      });
    gltfMeshes.push({ name: mesh.name, primitives });
    nodes.push({ name: mesh.name, mesh: gltfMeshes.length - 1 });
  }

  const json = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ name: sceneName, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: gltfMeshes,
    materials,
    accessors,
    bufferViews,
    buffers: binLength > 0 ? [{ byteLength: binLength }] : [],
  };
  const jsonRaw = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = Math.ceil(jsonRaw.length / 4) * 4;
  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonRaw, 20);
  out.fill(0x20, 20 + jsonRaw.length, 20 + jsonLength); // relleno con espacios
  let at = 20 + jsonLength;
  view.setUint32(at, binLength, true);
  view.setUint32(at + 4, 0x004e4942, true); // 'BIN\0'
  at += 8;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
