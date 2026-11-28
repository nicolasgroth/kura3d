/**
 * @file src/components/__tests__/addonPlacementClick.test.ts
 * @description Clic de colocación de agregados (imán, torreta, colgar en el muro, paso de cable): el agregado se
 * crea en el punto de la vista previa, el del rayo al presionar. El `click` del navegador trae coordenadas redondeadas
 * al píxel (Chromium: `pointermove`/`pointerdown` en 349,5 y `click` en 349), y recalcular el punto con ese rayo
 * corría la boca del hueco medio píxel (0,23 mm a 220 mm de la cámara) respecto de lo que mostraba la vista previa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fakeBox } from '../../test/fakeObjects';
import type { SceneObject, Vec3 } from '../../types/kura';
import { addonHitFromEvent, addonPlacementHandlers, type AddonPlacementTarget } from '../viewport/useAddonPlacement';

/** Pieza de un triángulo grande en el plano y = 10 local, con rotación y escala no uniforme. */
function piece(rotation: Vec3, scale: Vec3): SceneObject {
  const tri = { positions: new Float32Array([-50, 10, -50, -50, 10, 50, 50, 10, -50]), indices: new Uint32Array([0, 1, 2]) };
  return { ...fakeBox('p', 'P', 10), mesh: tri, position: [3, 4, 5], rotation, scale } as SceneObject;
}

function target() {
  const place = vi.fn<AddonPlacementTarget['place']>();
  const t: AddonPlacementTarget = { setHover: vi.fn(), hoverHostId: () => 'p', place, radiusMm: () => 2.5 };
  return { t, place };
}

/** Evento del visor sobre la cara 0 con el rayo desde `origin` hacia `dir`. */
function ev(origin: Vec3, dir: Vec3, extra: Record<string, unknown> = {}) {
  const ray = new THREE.Ray(new THREE.Vector3(...origin), new THREE.Vector3(...dir).normalize());
  const point = ray.at(1, new THREE.Vector3());
  return { faceIndex: 0, ray, point, button: 0, buttons: 0, delta: 0, stopPropagation: () => {}, ...extra } as never;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('colocar agregados: el clic crea en el punto de la vista previa', () => {
  const cases: Array<{ name: string; rotation: Vec3; scale: Vec3; from: Vec3; dir: Vec3 }> = [
    { name: 'pieza rotada con escala no uniforme', rotation: [0.4, 0.5, 0.3], scale: [1, 2, 0.6], from: [60, 120, 140], dir: [-0.6, -0.9, -1.1] },
    { name: 'cara inferior (vista desde abajo)', rotation: [Math.PI, 0, 0], scale: [1, 1, 1], from: [3, -200, 5], dir: [0.05, 1, 0.05] },
  ];
  for (const c of cases) {
    it(`${c.name}: el clic con coordenadas redondeadas no corre la boca`, () => {
      const obj = piece(c.rotation, c.scale);
      const { t, place } = target();
      const h = addonPlacementHandlers(obj, t);
      // Presionar (coordenadas fraccionarias): el mismo rayo que la vista previa.
      const press = ev(c.from, c.dir);
      h.onPointerMove(press);
      h.onPointerDown(press);
      const preview = addonHitFromEvent(obj, press, 2.5)!;
      // El `click` llega con el píxel redondeado: el rayo sale medio píxel (~0,23 mm a esa distancia) más allá.
      const click = ev([c.from[0] + 0.23, c.from[1], c.from[2]], c.dir);
      const clickHit = addonHitFromEvent(obj, click, 2.5)!;
      expect(dist(clickHit.point, preview.point)).toBeGreaterThan(0.15);
      h.onClick(click);
      expect(place).toHaveBeenCalledTimes(1);
      const [, point, normal] = place.mock.calls[0];
      expect(dist(point, preview.point)).toBeLessThan(1e-9);
      expect(dist(normal, preview.normal)).toBeLessThan(1e-9);
    });
  }

  it('sin presión registrada (o con otro botón) usa el rayo del clic', () => {
    const obj = piece([0, 0, 0], [1, 1, 1]);
    const { t, place } = target();
    const h = addonPlacementHandlers(obj, t);
    h.onPointerDown(ev([0, 100, 0], [0, -1, 0], { button: 2 }));
    const click = ev([7, 100, -4], [0, -1, 0]);
    h.onClick(click);
    expect(dist(place.mock.calls[0][1], addonHitFromEvent(obj, click, 2.5)!.point)).toBeLessThan(1e-9);
  });

  it('la presión vale para un solo clic: el siguiente sin presión usa su propio rayo', () => {
    const obj = piece([0, 0, 0], [1, 1, 1]);
    const { t, place } = target();
    const h = addonPlacementHandlers(obj, t);
    h.onPointerDown(ev([1, 100, 1], [0, -1, 0]));
    h.onClick(ev([1, 100, 1.3], [0, -1, 0]));
    const second = ev([-9, 100, 2], [0, -1, 0]);
    h.onClick(second);
    expect(place.mock.calls[0][1][2]).toBeCloseTo(1, 9);
    expect(place.mock.calls[1][1][2]).toBeCloseTo(2, 9);
  });

  it('salir de la pieza descarta la presión pendiente', () => {
    const obj = piece([0, 0, 0], [1, 1, 1]);
    const { t, place } = target();
    const h = addonPlacementHandlers(obj, t);
    h.onPointerDown(ev([1, 100, 1], [0, -1, 0]));
    h.onPointerOut();
    h.onClick(ev([4, 100, 4], [0, -1, 0]));
    expect(place.mock.calls[0][1][0]).toBeCloseTo(4, 9);
  });
});
