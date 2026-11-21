/**
 * @file src/engine/advancedGeometry.ts
 * @description Herramientas geométricas avanzadas de Kura3D: importación y extrusión
 * de SVG a sólidos 3D watertight, generación de relieves/litofanías cerradas desde
 * imágenes RGBA, texturas procedurales con subdivisión sin grietas y pintado inteligente
 * (esférico, uniforme y flood-fill por ángulo diedro).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { CrossSection, Manifold } from 'manifold-3d';
import type {
  ImageTo3DOptions,
  MeshData,
  SceneObject,
  SvgImportOptions,
  TextureOptions,
  TexturePatternType,
  Vec3,
} from '../types/kura';
import {
  computeVertexNormals,
  initManifoldEngine,
  manifoldToMeshData,
} from './manifoldKernel';
import { normalizeMeshToBed } from './primitives';

// ============================================================================
// 1. Extrusión de SVG a malla 3D watertight
// ============================================================================

/**
 * Tokeniza una cadena de atributo SVG `d` en comandos y números respetando
 * notación científica y signos negativos pegados (ej. "M10-20.5.25").
 */
function tokenizeSvgPath(d: string): string[] {
  const tokens: string[] = [];
  const regex = /([a-zA-Z])|([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(d)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
}

/**
 * Evalúa un punto en una curva Bézier cúbica en `t in [0, 1]`.
 */
function evalCubicBezier(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
}

/**
 * Evalúa un punto en una curva Bézier cuadrática en `t in [0, 1]`.
 */
function evalQuadBezier(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

/**
 * Convierte un arco elíptico SVG (comando A/a) en segmentos de polilínea según la
 * parametrización por centro especificada en el estándar W3C SVG 1.1.
 */
function sampleSvgArc(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
  segments: number
): [number, number][] {
  if (Math.hypot(x2 - x1, y2 - y1) < 1e-8) {
    return [];
  }
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx < 1e-8 || ry < 1e-8) {
    return [[x2, y2]];
  }

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx2 = (x1 - x2) * 0.5;
  const dy2 = (y1 - y2) * 0.5;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    rx *= scale;
    ry *= scale;
  }

  const rxSq = rx * rx;
  const rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;

  const num = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
  const den = rxSq * y1pSq + rySq * x1pSq;
  const coef = (largeArc === sweep ? -1 : 1) * Math.sqrt(den > 1e-12 ? num / den : 0);

  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) * 0.5;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) * 0.5;

  const vecAngle = (ux: number, uy: number, vx: number, vy: number): number => {
    const sign = ux * vy - uy * vx < 0 ? -1 : 1;
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const ratio = Math.max(-1, Math.min(1, len > 1e-12 ? dot / len : 1));
    return sign * Math.acos(ratio);
  };

  const theta1 = vecAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = vecAngle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry
  );

  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2;
  if (sweep && dTheta < 0) dTheta += Math.PI * 2;

  const steps = Math.max(4, Math.ceil((Math.abs(dTheta) / (Math.PI * 2)) * segments * 2));
  const pts: [number, number][] = [];

  for (let i = 1; i <= steps; i++) {
    const theta = theta1 + (dTheta * i) / steps;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const px = cosPhi * rx * cosT - sinPhi * ry * sinT + cx;
    const py = sinPhi * rx * cosT + cosPhi * ry * sinT + cy;
    pts.push([px, py]);
  }
  return pts;
}

/**
 * Parsea un atributo `d` de SVG en una lista de contornos poligonales 2D (Y invertido
 * para coincidir con el sistema top-down de la cama 3D).
 */
function parseSvgPathData(d: string, curveSegments: number): [number, number][][] {
  const tokens = tokenizeSvgPath(d);
  const contours: [number, number][][] = [];
  let current: [number, number][] = [];

  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCtrlX = 0;
  let lastCtrlY = 0;
  let lastCmd = '';

  const isCommand = (t: string): boolean => /^[a-zA-Z]$/.test(t);
  const nextNum = (): number => parseFloat(tokens[i++] ?? '0');

  const pushPoint = (x: number, y: number): void => {
    const py = -y; // Invertimos Y de SVG para que el diseño no quede espejado
    const last = current[current.length - 1];
    if (!last || Math.hypot(x - last[0], py - last[1]) > 1e-6) {
      current.push([x, py]);
    }
  };

  while (i < tokens.length) {
    if (isCommand(tokens[i])) {
      cmd = tokens[i++];
    } else if (cmd === 'M') {
      cmd = 'L';
    } else if (cmd === 'm') {
      cmd = 'l';
    }

    switch (cmd) {
      case 'M':
      case 'm': {
        if (current.length >= 3) contours.push(current);
        current = [];
        const x = nextNum() + (cmd === 'm' ? cx : 0);
        const y = nextNum() + (cmd === 'm' ? cy : 0);
        cx = x;
        cy = y;
        startX = x;
        startY = y;
        pushPoint(cx, cy);
        lastCmd = cmd;
        break;
      }

      case 'L':
      case 'l': {
        const x = nextNum() + (cmd === 'l' ? cx : 0);
        const y = nextNum() + (cmd === 'l' ? cy : 0);
        cx = x;
        cy = y;
        pushPoint(cx, cy);
        lastCmd = cmd;
        break;
      }

      case 'H':
      case 'h': {
        const x = nextNum() + (cmd === 'h' ? cx : 0);
        cx = x;
        pushPoint(cx, cy);
        lastCmd = cmd;
        break;
      }

      case 'V':
      case 'v': {
        const y = nextNum() + (cmd === 'v' ? cy : 0);
        cy = y;
        pushPoint(cx, cy);
        lastCmd = cmd;
        break;
      }

      case 'C':
      case 'c': {
        const rel = cmd === 'c';
        const x1 = nextNum() + (rel ? cx : 0);
        const y1 = nextNum() + (rel ? cy : 0);
        const x2 = nextNum() + (rel ? cx : 0);
        const y2 = nextNum() + (rel ? cy : 0);
        const x = nextNum() + (rel ? cx : 0);
        const y = nextNum() + (rel ? cy : 0);
        for (let s = 1; s <= curveSegments; s++) {
          const t = s / curveSegments;
          pushPoint(
            evalCubicBezier(cx, x1, x2, x, t),
            evalCubicBezier(cy, y1, y2, y, t)
          );
        }
        lastCtrlX = x2;
        lastCtrlY = y2;
        cx = x;
        cy = y;
        lastCmd = cmd;
        break;
      }

      case 'S':
      case 's': {
        const rel = cmd === 's';
        const hasPrev = /[CcSs]/.test(lastCmd);
        const x1 = hasPrev ? 2 * cx - lastCtrlX : cx;
        const y1 = hasPrev ? 2 * cy - lastCtrlY : cy;
        const x2 = nextNum() + (rel ? cx : 0);
        const y2 = nextNum() + (rel ? cy : 0);
        const x = nextNum() + (rel ? cx : 0);
        const y = nextNum() + (rel ? cy : 0);
        for (let s = 1; s <= curveSegments; s++) {
          const t = s / curveSegments;
          pushPoint(
            evalCubicBezier(cx, x1, x2, x, t),
            evalCubicBezier(cy, y1, y2, y, t)
          );
        }
        lastCtrlX = x2;
        lastCtrlY = y2;
        cx = x;
        cy = y;
        lastCmd = cmd;
        break;
      }

      case 'Q':
      case 'q': {
        const rel = cmd === 'q';
        const x1 = nextNum() + (rel ? cx : 0);
        const y1 = nextNum() + (rel ? cy : 0);
        const x = nextNum() + (rel ? cx : 0);
        const y = nextNum() + (rel ? cy : 0);
        for (let s = 1; s <= curveSegments; s++) {
          const t = s / curveSegments;
          pushPoint(evalQuadBezier(cx, x1, x, t), evalQuadBezier(cy, y1, y, t));
        }
        lastCtrlX = x1;
        lastCtrlY = y1;
        cx = x;
        cy = y;
        lastCmd = cmd;
        break;
      }

      case 'T':
      case 't': {
        const rel = cmd === 't';
        const hasPrev = /[QqTt]/.test(lastCmd);
        const x1 = hasPrev ? 2 * cx - lastCtrlX : cx;
        const y1 = hasPrev ? 2 * cy - lastCtrlY : cy;
        const x = nextNum() + (rel ? cx : 0);
        const y = nextNum() + (rel ? cy : 0);
        for (let s = 1; s <= curveSegments; s++) {
          const t = s / curveSegments;
          pushPoint(evalQuadBezier(cx, x1, x, t), evalQuadBezier(cy, y1, y, t));
        }
        lastCtrlX = x1;
        lastCtrlY = y1;
        cx = x;
        cy = y;
        lastCmd = cmd;
        break;
      }

      case 'A':
      case 'a': {
        const rel = cmd === 'a';
        const rx = nextNum();
        const ry = nextNum();
        const rot = nextNum();
        const largeArc = nextNum() !== 0;
        const sweep = nextNum() !== 0;
        const x = nextNum() + (rel ? cx : 0);
        const y = nextNum() + (rel ? cy : 0);
        const pts = sampleSvgArc(cx, cy, rx, ry, rot, largeArc, sweep, x, y, curveSegments);
        for (const [px, py] of pts) {
          pushPoint(px, py);
        }
        cx = x;
        cy = y;
        lastCmd = cmd;
        break;
      }

      case 'Z':
      case 'z': {
        if (current.length >= 3) {
          contours.push(current);
        }
        current = [];
        cx = startX;
        cy = startY;
        lastCmd = cmd;
        break;
      }

      default:
        // Evita bucle infinito ante tokens desconocidos
        i++;
        break;
    }
  }

  if (current.length >= 3) {
    contours.push(current);
  }
  return contours;
}

/**
 * Extrae atributos XML de una etiqueta SVG de forma ligera y determinista.
 */
function parseXmlAttributes(attrText: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(attrText)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? '';
  }
  return attrs;
}

/**
 * Fallback puro JS para extraer grupos de contornos 2D por cada elemento SVG
 * (`<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`) en entornos headless
 * sin DOMParser. Cada grupo conserva sus propios sub-contornos (para agujeros),
 * mientras que distintos elementos se unen luego mediante `CrossSection.union`.
 */
function parseSvgElementGroupsFallback(
  svgText: string,
  curveSegments: number
): [number, number][][][] {
  const groups: [number, number][][][] = [];
  const tagRegex = /<(path|rect|circle|ellipse|polygon|polyline)\b([^>]*)\/?>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(svgText)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = parseXmlAttributes(match[2]);
    if (attrs.fill?.toLowerCase() === 'none' && !attrs.stroke) {
      continue;
    }

    if (tag === 'path' && attrs.d) {
      const pathContours = parseSvgPathData(attrs.d, curveSegments);
      if (pathContours.length > 0) {
        groups.push(pathContours);
      }
    } else if (tag === 'rect') {
      const x = parseFloat(attrs.x ?? '0') || 0;
      const y = parseFloat(attrs.y ?? '0') || 0;
      const w = parseFloat(attrs.width ?? '0') || 0;
      const h = parseFloat(attrs.height ?? '0') || 0;
      if (w > 0 && h > 0) {
        groups.push([
          [
            [x, -y],
            [x + w, -y],
            [x + w, -(y + h)],
            [x, -(y + h)],
          ],
        ]);
      }
    } else if (tag === 'circle') {
      const cx = parseFloat(attrs.cx ?? '0') || 0;
      const cy = parseFloat(attrs.cy ?? '0') || 0;
      const r = parseFloat(attrs.r ?? '0') || 0;
      if (r > 0) {
        const segs = Math.max(12, curveSegments * 2);
        const poly: [number, number][] = [];
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          poly.push([cx + Math.cos(a) * r, -(cy + Math.sin(a) * r)]);
        }
        groups.push([poly]);
      }
    } else if (tag === 'ellipse') {
      const cx = parseFloat(attrs.cx ?? '0') || 0;
      const cy = parseFloat(attrs.cy ?? '0') || 0;
      const rx = parseFloat(attrs.rx ?? '0') || 0;
      const ry = parseFloat(attrs.ry ?? '0') || 0;
      if (rx > 0 && ry > 0) {
        const segs = Math.max(12, curveSegments * 2);
        const poly: [number, number][] = [];
        for (let s = 0; s < segs; s++) {
          const a = (s / segs) * Math.PI * 2;
          poly.push([cx + Math.cos(a) * rx, -(cy + Math.sin(a) * ry)]);
        }
        groups.push([poly]);
      }
    } else if ((tag === 'polygon' || tag === 'polyline') && attrs.points) {
      const nums = attrs.points
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => Number.isFinite(n));
      const poly: [number, number][] = [];
      for (let k = 0; k + 1 < nums.length; k += 2) {
        poly.push([nums[k], -nums[k + 1]]);
      }
      if (poly.length >= 3) {
        groups.push([poly]);
      }
    }
  }

  return groups;
}

/**
 * Extrae grupos de contornos usando `THREE.SVGLoader` cuando el DOM del navegador
 * está disponible, o el parser determinista puro en entornos Node/headless.
 */
function extractSvgElementGroups(
  svgContent: string,
  curveSegments: number
): [number, number][][][] {
  if (typeof DOMParser !== 'undefined') {
    try {
      const loader = new SVGLoader();
      const parsed = loader.parse(svgContent);
      const groups: [number, number][][][] = [];

      for (const path of parsed.paths) {
        const shapes = SVGLoader.createShapes(path);
        for (const shape of shapes) {
          const pts = shape.extractPoints(curveSegments);
          const group: [number, number][][] = [];
          if (pts.shape.length >= 3) {
            group.push(pts.shape.map((p) => [p.x, -p.y]));
          }
          for (const hole of pts.holes) {
            if (hole.length >= 3) {
              group.push(hole.map((p) => [p.x, -p.y]));
            }
          }
          if (group.length > 0) {
            groups.push(group);
          }
        }
      }

      if (groups.length > 0) {
        return groups;
      }
    } catch {
      // Si SVGLoader falla por SVG parcial, continuamos con el parser robusto integrado
    }
  }

  return parseSvgElementGroupsFallback(svgContent, curveSegments);
}

/**
 * Importa y extruye un archivo SVG vectorial en un sólido 3D cerrado (watertight),
 * escalado al ancho físico objetivo (`targetWidth` en mm) y apoyado sobre Y=0.
 *
 * @param options Opciones de importación y extrusión SVG.
 * @returns Malla `MeshData` extrusionada en milímetros.
 */
export async function extrudeSvgToMesh(options: SvgImportOptions): Promise<MeshData> {
  const wasm = await initManifoldEngine();
  const curveSegments = Math.max(4, Math.round(options.curveSegments || 12));
  const groups = extractSvgElementGroups(options.svgContent, curveSegments);

  if (groups.length === 0) {
    throw new Error(
      'No se encontraron contornos vectoriales válidos (<path>, <rect>, <circle>, <polygon>, <ellipse>) en el SVG.'
    );
  }

  const elementSections: CrossSection[] = [];
  let rawUnion: CrossSection | null = null;
  let csUnion: CrossSection | null = null;
  let csScaled: CrossSection | null = null;
  let extruded: Manifold | null = null;
  let rotated: Manifold | null = null;

  try {
    for (const group of groups) {
      // Regla EvenOdd dentro de cada elemento para cortar sus propios agujeros internos
      const elemCs = wasm.CrossSection.ofPolygons(group, 'EvenOdd');
      if (!elemCs.isEmpty()) {
        elementSections.push(elemCs);
      } else {
        elemCs.delete();
      }
    }

    if (elementSections.length === 0) {
      throw new Error('La geometría 2D del SVG tiene área nula.');
    }

    // Unimos todos los elementos SVG independientes (como hace el renderizador SVG estándar)
    rawUnion =
      elementSections.length === 1
        ? elementSections[0]
        : wasm.CrossSection.union(elementSections);
    csUnion = rawUnion.simplify(1e-4);

    if (csUnion.isEmpty()) {
      throw new Error('La geometría 2D del SVG tiene área nula.');
    }

    const bounds = csUnion.bounds();
    const width = bounds.max[0] - bounds.min[0];
    const height = bounds.max[1] - bounds.min[1];
    const refSpan = width > 1e-4 ? width : Math.max(height, 1e-4);
    const scaleFactor = Math.max(1, options.targetWidth) / refSpan;

    csScaled = csUnion.scale([scaleFactor, scaleFactor]);
    const depthMm = Math.max(0.4, options.depth);
    extruded = csScaled.extrude(depthMm, 0, 0, [1, 1], false);
    // Rotamos -90° en X para que la extrusión apunte hacia +Y sobre la cama XZ
    rotated = extruded.rotate([-90, 0, 0]);

    const mesh = manifoldToMeshData(rotated);
    return normalizeMeshToBed(mesh);
  } finally {
    for (const sec of elementSections) {
      sec.delete();
    }
    if (rawUnion && !elementSections.includes(rawUnion)) {
      rawUnion.delete();
    }
    csUnion?.delete();
    csScaled?.delete();
    extruded?.delete();
    rotated?.delete();
  }
}

// ============================================================================
// 2. Relieve / Litofanía 3D watertight desde imagen RGBA
// ============================================================================

/**
 * Genera una malla 3D sólida, completamente cerrada (watertight) y libre de T-junctions
 * a partir de una imagen RGBA (modo relieve o litofanía invertida), descansando sobre Y=0.
 *
 * @param options Parámetros físicos, buffer RGBA y nivel de suavizado.
 * @returns Malla sólida `MeshData` con base plana y paredes laterales cosidas.
 */
export function generateReliefFromImage(options: ImageTo3DOptions): MeshData {
  const srcW = Math.max(1, Math.floor(options.pixelWidth));
  const srcH = Math.max(1, Math.floor(options.pixelHeight));
  const maxGrid = 220;

  const cols = Math.max(2, Math.min(srcW, maxGrid));
  const rows = Math.max(2, Math.min(srcH, maxGrid));

  // Muestreo de luminancia normalizada [0..1]
  let grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    const sy = Math.min(srcH - 1, Math.floor((r / (rows - 1)) * (srcH - 1)));
    for (let c = 0; c < cols; c++) {
      const sx = Math.min(srcW - 1, Math.floor((c / (cols - 1)) * (srcW - 1)));
      const pIdx = (sy * srcW + sx) * 4;
      const red = options.rgba[pIdx] ?? 0;
      const green = options.rgba[pIdx + 1] ?? 0;
      const blue = options.rgba[pIdx + 2] ?? 0;
      const alpha = (options.rgba[pIdx + 3] ?? 255) / 255;

      const lum = ((0.299 * red + 0.587 * green + 0.114 * blue) / 255) * alpha;
      grid[r * cols + c] = options.invert ? 1 - lum : lum;
    }
  }

  // Pasadas deterministas de suavizado 3x3 si se solicita
  const passes = Math.max(0, Math.min(5, Math.round(options.smoothing)));
  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (let dc = -1; dc <= 1; dc++) {
            const cc = c + dc;
            if (cc < 0 || cc >= cols) continue;
            sum += grid[rr * cols + cc];
            count++;
          }
        }
        next[r * cols + c] = sum / count;
      }
    }
    grid = next;
  }

  const widthMm = Math.max(1, options.widthMm);
  const depthMm = Math.max(1, options.depthMm);
  const baseMm = Math.max(0.4, options.baseThicknessMm);
  const reliefMm = Math.max(0, options.reliefHeightMm);

  const positions: number[] = [];
  const indices: number[] = [];

  // 1) Vértices de la superficie superior (índices 0 .. cols*rows - 1)
  for (let r = 0; r < rows; r++) {
    const z = -depthMm * 0.5 + (r / (rows - 1)) * depthMm;
    for (let c = 0; c < cols; c++) {
      const x = -widthMm * 0.5 + (c / (cols - 1)) * widthMm;
      const y = baseMm + grid[r * cols + c] * reliefMm;
      positions.push(x, y, z);
    }
  }

  // Triángulos de la superficie superior (normal saliente +Y)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = (r + 1) * cols + c;
      const br = bl + 1;
      indices.push(tl, bl, br);
      indices.push(tl, br, tr);
    }
  }

  // 2) Anillo perimetral en sentido horario visto desde +Y para coser paredes y base
  const topPerimeter: number[] = [];
  for (let c = 0; c < cols; c++) topPerimeter.push(c); // Borde superior (r=0)
  for (let r = 1; r < rows; r++) topPerimeter.push(r * cols + (cols - 1)); // Borde derecho
  for (let c = cols - 2; c >= 0; c--) topPerimeter.push((rows - 1) * cols + c); // Borde inferior
  for (let r = rows - 2; r >= 1; r--) topPerimeter.push(r * cols); // Borde izquierdo

  // Vértices perimetrales inferiores a Y=0 emparejados 1-a-1 con el perímetro superior
  const botPerimeter: number[] = [];
  for (const topIdx of topPerimeter) {
    const botIdx = positions.length / 3;
    positions.push(positions[topIdx * 3], 0, positions[topIdx * 3 + 2]);
    botPerimeter.push(botIdx);
  }

  // Vértice central inferior para triangular toda la base sin T-junctions
  const botCenterIdx = positions.length / 3;
  positions.push(0, 0, 0);

  const perimCount = topPerimeter.length;
  for (let k = 0; k < perimCount; k++) {
    const next = (k + 1) % perimCount;
    const t0 = topPerimeter[k];
    const t1 = topPerimeter[next];
    const b0 = botPerimeter[k];
    const b1 = botPerimeter[next];

    // Pared lateral con normal hacia afuera
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);

    // Tapa inferior con normal hacia -Y
    indices.push(botCenterIdx, b0, b1);
  }

  const posArr = new Float32Array(positions);
  const idxArr = new Uint32Array(indices);
  const normals = computeVertexNormals(posArr, idxArr);

  return {
    positions: posArr,
    indices: idxArr,
    normals,
  };
}

// ============================================================================
// 3. Texturas procedurales con subdivisión uniforme watertight
// ============================================================================

/**
 * Subdivide uniformemente cada triángulo en 4 sub-triángulos compartiendo los
 * vértices medios de cada arista, garantizando 0 grietas y preservación watertight.
 */
function subdivideMeshUniform(mesh: MeshData): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  const vertPositions = Array.from(mesh.positions);
  const edgeMidpoints = new Map<string, number>();
  const newIndices: number[] = [];
  const newFaceColors: string[] | undefined = mesh.faceColors
    ? new Array<string>(triCount * 4)
    : undefined;

  const getMidpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    const existing = edgeMidpoints.get(key);
    if (existing !== undefined) return existing;

    const midIdx = vertPositions.length / 3;
    vertPositions.push(
      (vertPositions[a * 3] + vertPositions[b * 3]) * 0.5,
      (vertPositions[a * 3 + 1] + vertPositions[b * 3 + 1]) * 0.5,
      (vertPositions[a * 3 + 2] + vertPositions[b * 3 + 2]) * 0.5
    );
    edgeMidpoints.set(key, midIdx);
    return midIdx;
  };

  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const m01 = getMidpoint(i0, i1);
    const m12 = getMidpoint(i1, i2);
    const m20 = getMidpoint(i2, i0);

    newIndices.push(i0, m01, m20);
    newIndices.push(m01, i1, m12);
    newIndices.push(m20, m12, i2);
    newIndices.push(m01, m12, m20);

    if (newFaceColors && mesh.faceColors) {
      const col = mesh.faceColors[t];
      const base = t * 4;
      newFaceColors[base] = col;
      newFaceColors[base + 1] = col;
      newFaceColors[base + 2] = col;
      newFaceColors[base + 3] = col;
    }
  }

  return {
    positions: new Float32Array(vertPositions),
    indices: new Uint32Array(newIndices),
    ...(newFaceColors ? { faceColors: newFaceColors } : {}),
  };
}

/**
 * Calcula la longitud máxima promedio de aristas de la malla para decidir si
 * requiere subdivisión antes de desplazar vértices.
 */
function getMaxEdgeLength(mesh: MeshData): number {
  const triCount = Math.floor(mesh.indices.length / 3);
  let maxLenSq = 0;
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] * 3;
    const i1 = mesh.indices[t * 3 + 1] * 3;
    const i2 = mesh.indices[t * 3 + 2] * 3;

    const pairs: [number, number][] = [
      [i0, i1],
      [i1, i2],
      [i2, i0],
    ];
    for (const [a, b] of pairs) {
      const dx = mesh.positions[b] - mesh.positions[a];
      const dy = mesh.positions[b + 1] - mesh.positions[a + 1];
      const dz = mesh.positions[b + 2] - mesh.positions[a + 2];
      const dSq = dx * dx + dy * dy + dz * dz;
      if (dSq > maxLenSq) maxLenSq = dSq;
    }
  }
  return Math.sqrt(maxLenSq);
}

/** Hash espacial determinista en [0, 1] para ruido "fuzzy skin". */
function spatialHash3D(x: number, y: number, z: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

/** Ruido trilineal suave determinista basado en hash espacial. */
function valueNoise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;

  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const n000 = spatialHash3D(ix, iy, iz);
  const n100 = spatialHash3D(ix + 1, iy, iz);
  const n010 = spatialHash3D(ix, iy + 1, iz);
  const n110 = spatialHash3D(ix + 1, iy + 1, iz);
  const n001 = spatialHash3D(ix, iy, iz + 1);
  const n101 = spatialHash3D(ix + 1, iy, iz + 1);
  const n011 = spatialHash3D(ix, iy + 1, iz + 1);
  const n111 = spatialHash3D(ix + 1, iy + 1, iz + 1);

  return lerp(
    lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
    lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
    w
  );
}

/**
 * Evalúa el factor de desplazamiento normalizado [-0.5 .. 1.0] de cada patrón
 * procedural en función de la posición 3D y escala en milímetros.
 */
function sampleTexturePattern(
  pattern: Exclude<TexturePatternType, 'none'>,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  scale: number
): number {
  const s = Math.max(0.5, scale);

  // Coordenadas triplanares según normal dominante para evitar distorsión en caras laterales
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const az = Math.abs(nz);
  let u = x;
  let v = z;
  if (ax >= ay && ax >= az) {
    u = z;
    v = y;
  } else if (az >= ax && az >= ay) {
    u = x;
    v = y;
  }

  switch (pattern) {
    case 'fuzzy':
      return valueNoise3D((x / s) * 3.0, (y / s) * 3.0, (z / s) * 3.0) * 2 - 1;

    case 'knurling': {
      const k1 = Math.sin(((u + v) / s) * Math.PI * 2);
      const k2 = Math.sin(((u - v) / s) * Math.PI * 2);
      return Math.abs(k1) * Math.abs(k2) * 2 - 0.5;
    }

    case 'waves':
      return Math.sin(((u * 0.75 + v * 1.1) / s) * Math.PI * 2);

    case 'honeycomb': {
      const px = u / s;
      const py = v / s;
      const r3 = Math.sqrt(3);
      const hx = px;
      const hy = py * (2 / r3);
      const gx = hx - Math.round(hx);
      const gy = hy - Math.round(hy);
      const hexDist = Math.max(Math.abs(gx), Math.abs(gx * 0.5 + gy * 0.866));
      return hexDist > 0.36 ? 0.8 : -0.4;
    }

    case 'grid': {
      const gx = Math.abs((u / s) - Math.round(u / s));
      const gy = Math.abs((v / s) - Math.round(v / s));
      return gx < 0.14 || gy < 0.14 ? 1.0 : -0.25;
    }
  }
}

/**
 * Aplica un relieve procedural determinista (`fuzzy`, `knurling`, `waves`, `honeycomb`, `grid`)
 * subdividiendo primero las aristas grandes dentro de un presupuesto seguro de triángulos
 * y desplazando los vértices a lo largo de su normal suave.
 *
 * @param mesh Malla de entrada watertight.
 * @param options Patrón, profundidad en mm y escala en mm.
 * @returns Malla con relieve aplicado y base apoyada en Y=0.
 */
export function applyProceduralTexture(
  mesh: MeshData,
  options: TextureOptions
): MeshData {
  if (
    options.pattern === 'none' ||
    Math.abs(options.depth) < 1e-6 ||
    mesh.indices.length === 0
  ) {
    return {
      positions: new Float32Array(mesh.positions),
      indices: new Uint32Array(mesh.indices),
      ...(mesh.normals ? { normals: new Float32Array(mesh.normals) } : {}),
      ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
    };
  }

  let working: MeshData = {
    positions: new Float32Array(mesh.positions),
    indices: new Uint32Array(mesh.indices),
    ...(mesh.faceColors ? { faceColors: [...mesh.faceColors] } : {}),
  };

  // Subdividimos uniformemente hasta alcanzar resolución adecuada al patrón (límite 48k tris)
  const targetEdge = Math.max(0.6, options.scale * 0.45);
  const maxTriangles = 48000;
  let pass = 0;
  while (
    pass < 4 &&
    working.indices.length / 3 <= maxTriangles / 4 &&
    getMaxEdgeLength(working) > targetEdge
  ) {
    working = subdivideMeshUniform(working);
    pass++;
  }

  const normals = computeVertexNormals(working.positions, working.indices);
  const vertCount = Math.floor(working.positions.length / 3);
  const displaced = new Float32Array(working.positions.length);

  for (let v = 0; v < vertCount; v++) {
    const x = working.positions[v * 3];
    const y = working.positions[v * 3 + 1];
    const z = working.positions[v * 3 + 2];
    const nx = normals[v * 3];
    const ny = normals[v * 3 + 1];
    const nz = normals[v * 3 + 2];

    const factor = sampleTexturePattern(
      options.pattern,
      x,
      y,
      z,
      nx,
      ny,
      nz,
      options.scale
    );
    const disp = factor * options.depth;

    displaced[v * 3] = x + nx * disp;
    displaced[v * 3 + 1] = y + ny * disp;
    displaced[v * 3 + 2] = z + nz * disp;
  }

  const finalNormals = computeVertexNormals(displaced, working.indices);
  return normalizeMeshToBed({
    positions: displaced,
    indices: working.indices,
    normals: finalNormals,
    ...(working.faceColors ? { faceColors: working.faceColors } : {}),
  });
}

// ============================================================================
// 4. Herramientas de pintado multicolor por cara
// ============================================================================

/**
 * Calcula la distancia al cuadrado exacta desde un punto `P` hasta el triángulo `(A, B, C)`
 * en R³ usando regiones de Voronoi (algoritmo de Ericson). Garantiza que brochas pequeñas
 * pinten caras grandes (low-poly) al tocar cualquier vértice, arista o interior.
 */
function pointToTriangleDistanceSq(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) {
    return apx * apx + apy * apy + apz * apz;
  }

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) {
    return bpx * bpx + bpy * bpy + bpz * bpz;
  }

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const qx = ax + v * abx - px;
    const qy = ay + v * aby - py;
    const qz = az + v * abz - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) {
    return cpx * cpx + cpy * cpy + cpz * cpz;
  }

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const qx = ax + w * acx - px;
    const qy = ay + w * acy - py;
    const qz = az + w * acz - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    const qx = bx + w * (cx - bx) - px;
    const qy = by + w * (cy - by) - py;
    const qz = bz + w * (cz - bz) - pz;
    return qx * qx + qy * qy + qz * qz;
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  const qx = ax + abx * v + acx * w - px;
  const qy = ay + aby * v + acy * w - py;
  const qz = az + abz * v + acz * w - pz;
  return qx * qx + qy * qy + qz * qz;
}

/** Color de las caras sin pintar cuando quien llama no indica el color base del objeto. */
export const DEFAULT_UNPAINTED_COLOR = '#94a3b8';

/**
 * Devuelve la malla con nuevos `faceColors` compartiendo posiciones, índices y normales (inmutables):
 * pintar no copia la geometría. Si ningún color cambió, devuelve la misma malla.
 */
function withFaceColors(mesh: MeshData, faceColors: string[], changed: boolean): MeshData {
  return changed ? { ...mesh, faceColors } : mesh;
}

/**
 * Pinta con `colorHex` todos los triángulos cuya distancia exacta (vértices, aristas,
 * interior o centroide) hasta `localCenter` sea menor o igual a `radiusMm` (brocha esférica 3D).
 * El radio está en mm de mundo: las distancias se miden aplicando la escala del objeto (la rotación
 * y la traslación no alteran distancias), así una pieza escalada ×2 no pinta el doble de área.
 */
export function paintMeshFacesInSphere(
  obj: SceneObject,
  localCenter: Vec3,
  radiusMm: number,
  colorHex: string
): MeshData {
  const triCount = Math.floor(obj.mesh.indices.length / 3);
  const hadColors = Boolean(obj.mesh.faceColors && obj.mesh.faceColors.length === triCount);
  const faceColors = hadColors
    ? [...obj.mesh.faceColors!]
    : new Array<string>(triCount).fill(obj.color.toLowerCase());

  const [sx, sy, sz] = (obj.scale ?? [1, 1, 1]).map((v) => Math.abs(v) || 1);
  const rSq = radiusMm * radiusMm;
  const cx = localCenter[0] * sx;
  const cy = localCenter[1] * sy;
  const cz = localCenter[2] * sz;
  const normalizedHex = colorHex.toLowerCase();
  let changed = false;

  for (let t = 0; t < triCount; t++) {
    const i0 = obj.mesh.indices[t * 3] * 3;
    const i1 = obj.mesh.indices[t * 3 + 1] * 3;
    const i2 = obj.mesh.indices[t * 3 + 2] * 3;

    const ax = obj.mesh.positions[i0] * sx;
    const ay = obj.mesh.positions[i0 + 1] * sy;
    const az = obj.mesh.positions[i0 + 2] * sz;
    const bx = obj.mesh.positions[i1] * sx;
    const by = obj.mesh.positions[i1 + 1] * sy;
    const bz = obj.mesh.positions[i1 + 2] * sz;
    const d0x = obj.mesh.positions[i2] * sx;
    const d0y = obj.mesh.positions[i2 + 1] * sy;
    const d0z = obj.mesh.positions[i2 + 2] * sz;

    const distSq = pointToTriangleDistanceSq(
      cx,
      cy,
      cz,
      ax,
      ay,
      az,
      bx,
      by,
      bz,
      d0x,
      d0y,
      d0z
    );
    if (distSq <= rSq && faceColors[t] !== normalizedHex) {
      faceColors[t] = normalizedHex;
      changed = true;
    }
  }

  return withFaceColors(obj.mesh, faceColors, changed);
}

/**
 * Asigna un color uniforme `colorHex` a todos los triángulos de una malla.
 */
export function paintEntireMesh(mesh: MeshData, colorHex: string): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  return { ...mesh, faceColors: new Array<string>(triCount).fill(colorHex.toLowerCase()) };
}

/**
 * Pintado inteligente por inundación (smart flood-fill, estilo OrcaSlicer / Bambu Studio):
 * propaga el color `colorHex` desde `seedFaceIndex` a todas las caras conectadas por
 * arista cuyo ángulo entre normales adyacentes no supere `angleThresholdDeg`.
 *
 * @param mesh Malla origen.
 * @param seedFaceIndex Índice del triángulo semilla.
 * @param colorHex Color objetivo en hexadecimal '#rrggbb'.
 * @param angleThresholdDeg Ángulo máximo permitido entre caras adyacentes (por defecto 30°).
 * @param baseColorHex Color del objeto para las caras aún sin pintar (si la malla no tiene `faceColors`).
 * @returns Malla con `faceColors` actualizado (comparte la geometría con la original).
 */
export function paintFloodFillConnectedFaces(
  mesh: MeshData,
  seedFaceIndex: number,
  colorHex: string,
  angleThresholdDeg = 30,
  baseColorHex: string = DEFAULT_UNPAINTED_COLOR
): MeshData {
  const triCount = Math.floor(mesh.indices.length / 3);
  if (seedFaceIndex < 0 || seedFaceIndex >= triCount) {
    return mesh;
  }

  const faceColors =
    mesh.faceColors && mesh.faceColors.length === triCount
      ? [...mesh.faceColors]
      : new Array<string>(triCount).fill(baseColorHex.toLowerCase());

  // Mapear vértices por posición cuantizada para conectar también mallas con costuras duplicadas
  const vertCount = Math.floor(mesh.positions.length / 3);
  const invTol = 1e4;
  const posMap = new Map<string, number>();
  const vertWeld = new Uint32Array(vertCount);
  for (let v = 0; v < vertCount; v++) {
    const key = `${Math.round(mesh.positions[v * 3] * invTol)},${Math.round(
      mesh.positions[v * 3 + 1] * invTol
    )},${Math.round(mesh.positions[v * 3 + 2] * invTol)}`;
    let id = posMap.get(key);
    if (id === undefined) {
      id = posMap.size;
      posMap.set(key, id);
    }
    vertWeld[v] = id;
  }

  // Calcular normales unitarias por triángulo y grafo de adyacencia por arista no dirigida
  const triNormals = new Float32Array(triCount * 3);
  const edgeToTris = new Map<string, number[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3];
    const i1 = mesh.indices[t * 3 + 1];
    const i2 = mesh.indices[t * 3 + 2];

    const ax = mesh.positions[i0 * 3];
    const ay = mesh.positions[i0 * 3 + 1];
    const az = mesh.positions[i0 * 3 + 2];

    const e1x = mesh.positions[i1 * 3] - ax;
    const e1y = mesh.positions[i1 * 3 + 1] - ay;
    const e1z = mesh.positions[i1 * 3 + 2] - az;

    const e2x = mesh.positions[i2 * 3] - ax;
    const e2y = mesh.positions[i2 * 3 + 1] - ay;
    const e2z = mesh.positions[i2 * 3 + 2] - az;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nx, ny, nz) || 1;
    triNormals[t * 3] = nx / len;
    triNormals[t * 3 + 1] = ny / len;
    triNormals[t * 3 + 2] = nz / len;

    const w0 = vertWeld[i0];
    const w1 = vertWeld[i1];
    const w2 = vertWeld[i2];
    const pairs: [number, number][] = [
      [w0, w1],
      [w1, w2],
      [w2, w0],
    ];
    for (const [u, v] of pairs) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      let list = edgeToTris.get(key);
      if (!list) {
        list = [];
        edgeToTris.set(key, list);
      }
      list.push(t);
    }
  }

  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180);
  const visited = new Uint8Array(triCount);
  const queue: number[] = [seedFaceIndex];
  visited[seedFaceIndex] = 1;
  const normalizedHex = colorHex.toLowerCase();

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    faceColors[curr] = normalizedHex;

    const cnx = triNormals[curr * 3];
    const cny = triNormals[curr * 3 + 1];
    const cnz = triNormals[curr * 3 + 2];

    const w0 = vertWeld[mesh.indices[curr * 3]];
    const w1 = vertWeld[mesh.indices[curr * 3 + 1]];
    const w2 = vertWeld[mesh.indices[curr * 3 + 2]];
    const pairs: [number, number][] = [
      [w0, w1],
      [w1, w2],
      [w2, w0],
    ];

    for (const [u, v] of pairs) {
      const key = u < v ? `${u}_${v}` : `${v}_${u}`;
      const neighbors = edgeToTris.get(key);
      if (!neighbors) continue;
      for (const nb of neighbors) {
        if (visited[nb]) continue;
        const dot =
          cnx * triNormals[nb * 3] +
          cny * triNormals[nb * 3 + 1] +
          cnz * triNormals[nb * 3 + 2];
        if (dot >= cosThreshold) {
          visited[nb] = 1;
          queue.push(nb);
        }
      }
    }
  }

  return withFaceColors(mesh, faceColors, true);
}
