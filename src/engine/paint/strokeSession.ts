/**
 * @file src/engine/paint/strokeSession.ts
 * @description Trazo de pincel en curso (pointerdown → pointerup), puro y sin React: trabaja sobre una
 * copia propia de los colores (una sola copia por trazo, no por muestra), anota qué caras cambiaron
 * desde la última subida a la GPU y, al cerrar, entrega la malla final más el delta para UN paso de
 * deshacer. La malla de origen nunca se muta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { MeshData } from '../../types/kura';
import { selectBrushFaces, type BrushQuery } from './brushSelect';
import { buildFaceColorDelta, type FaceColorDelta } from './colorDelta';
import { hasFaceColors, triangleCount } from './faceColors';

export interface StrokeResult {
  mesh: MeshData;
  delta: FaceColorDelta;
}

export class PaintStrokeSession {
  /** Colores de trabajo (mutables solo dentro del trazo). */
  readonly colors: string[];
  private readonly touched: Uint8Array;
  private readonly touchedFaces: number[] = [];
  private readonly originalColors: string[] = [];
  private dirty: number[] = [];

  constructor(
    readonly source: MeshData,
    baseHex: string,
  ) {
    const n = triangleCount(source);
    this.colors = hasFaceColors(source) ? source.faceColors!.slice() : new Array<string>(n).fill(baseHex.toLowerCase());
    this.touched = new Uint8Array(n);
  }

  /** Pinta una muestra; devuelve cuántas caras cambiaron de color. */
  paint(query: BrushQuery, colorHex: string): number {
    const hex = colorHex.toLowerCase();
    const faces = selectBrushFaces(this.source, query);
    let changed = 0;
    for (let i = 0; i < faces.length; i++) {
      const t = faces[i];
      const prev = this.colors[t];
      if (prev === hex) continue;
      if (!this.touched[t]) {
        this.touched[t] = 1;
        this.touchedFaces.push(t);
        this.originalColors.push(prev);
      }
      this.colors[t] = hex;
      this.dirty.push(t);
      changed++;
    }
    return changed;
  }

  /** Caras cambiadas desde la última llamada (para subir solo ese rango a la GPU). */
  takeDirty(): number[] {
    const out = this.dirty;
    this.dirty = [];
    return out;
  }

  /** Cierra el trazo: `null` si al final ningún color difiere del original. */
  finish(): StrokeResult | null {
    const faces: number[] = [], before: string[] = [], after: string[] = [];
    for (let i = 0; i < this.touchedFaces.length; i++) {
      const t = this.touchedFaces[i];
      if (this.colors[t] === this.originalColors[i]) continue;
      faces.push(t);
      before.push(this.originalColors[i]);
      after.push(this.colors[t]);
    }
    if (faces.length === 0) return null;
    const painted = hasFaceColors(this.source);
    const delta = buildFaceColorDelta(triangleCount(this.source), faces, before, after, painted, true);
    return { mesh: { ...this.source, faceColors: this.colors }, delta };
  }
}
