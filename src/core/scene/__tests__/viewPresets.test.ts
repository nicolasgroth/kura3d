/**
 * @file src/core/scene/__tests__/viewPresets.test.ts
 * @description Vistas predefinidas: encuadran una escena grande (la cámara queda fuera de la caja) y los
 * planos de recorte crecen con la escena.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { framePose, type FrameBox } from '../cameraFraming';
import { clipPlanesFor, isViewPreset, VIEW_PRESET_DIRS } from '../viewPresets';

const BIG: FrameBox = { min: [-220, 0, -220], max: [220, 440, 220] };

describe('vistas predefinidas', () => {
  for (const preset of Object.keys(VIEW_PRESET_DIRS) as Array<keyof typeof VIEW_PRESET_DIRS>) {
    it(`${preset}: con un cubo de 440 mm la cámara queda fuera y el objeto entra con margen`, () => {
      const pose = framePose({ box: BIG, viewDir: VIEW_PRESET_DIRS[preset], fovDeg: 42, aspect: 16 / 9, margin: 1.4 });
      const inside = [0, 1, 2].every((i) => pose.position[i] >= BIG.min[i] && pose.position[i] <= BIG.max[i]);
      expect(inside).toBe(false);
      // Radio de la caja ≈ 381 mm: la distancia debe superar ese radio con holgura.
      expect(pose.distance).toBeGreaterThan(450);
      const clip = clipPlanesFor(pose.distance, 381);
      expect(clip.far).toBeGreaterThan(pose.distance + 381);
      expect(clip.near).toBeLessThan(pose.distance - 381);
    });
  }

  it('recorte: cercano pequeño de cerca, lejano crece con la escena', () => {
    expect(clipPlanesFor(50, 100).near).toBeLessThanOrEqual(0.5);
    expect(clipPlanesFor(20000, 5000).far).toBeGreaterThanOrEqual(2 * (20000 + 10000));
    expect(clipPlanesFor(Number.NaN, Number.NaN).far).toBeGreaterThan(0);
  });

  it('reconoce las vistas y descarta los encuadres', () => {
    expect(isViewPreset('iso')).toBe(true);
    expect(isViewPreset('fit')).toBe(false);
  });
});
