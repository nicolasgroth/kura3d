/**
 * @file src/core/scene/__tests__/floatingBarPlacement.test.ts
 * @description Colocación pura de la barra flotante: centrada y encima, volteo abajo, pegada a los bordes, franja superior
 * fija y proyección (punto detrás de la cámara, objeto fuera de vista).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { extentIntersectsViewport, placeFloatingBar, screenExtent } from '../floatingBarPlacement';

const viewport = { width: 1000, height: 600 };
const bar = { width: 200, height: 40 };
const inside = (p: { x: number; y: number }) => p.x >= 8 && p.y >= 8 && p.x + bar.width <= viewport.width - 8 && p.y + bar.height <= viewport.height - 8;

describe('placeFloatingBar', () => {
  it('se centra sobre la caja, con el hueco, dentro del visor', () => {
    const p = placeFloatingBar({ extent: { left: 400, right: 600, top: 300, bottom: 450 }, bar, viewport });
    expect(p.side).toBe('above');
    expect(p.x).toBe(400);
    expect(p.y).toBe(300 - 10 - 40);
    expect(inside(p)).toBe(true);
  });

  it('si arriba no cabe, va debajo de la caja', () => {
    const p = placeFloatingBar({ extent: { left: 400, right: 600, top: 30, bottom: 200 }, bar, viewport });
    expect(p.side).toBe('below');
    expect(p.y).toBe(210);
  });

  it('la franja fija superior cuenta como espacio ocupado', () => {
    const p = placeFloatingBar({ extent: { left: 400, right: 600, top: 80, bottom: 200 }, bar, viewport, topInset: 60 });
    expect(p.side).toBe('below');
  });

  it('se pega a los bordes laterales', () => {
    expect(placeFloatingBar({ extent: { left: -50, right: 20, top: 300, bottom: 400 }, bar, viewport }).x).toBe(8);
    expect(placeFloatingBar({ extent: { left: 960, right: 1100, top: 300, bottom: 400 }, bar, viewport }).x).toBe(1000 - 8 - 200);
  });

  it('un objeto alto que no deja hueco arriba ni abajo recibe la barra a un lado, fuera de su caja', () => {
    const right = placeFloatingBar({ extent: { left: 100, right: 500, top: 20, bottom: 700 }, bar, viewport });
    expect(right.side).toBe('right');
    expect(right.x).toBe(510);
    expect(inside(right)).toBe(true);
    const left = placeFloatingBar({ extent: { left: 500, right: 950, top: 20, bottom: 700 }, bar, viewport });
    expect(left.side).toBe('left');
    expect(left.x + bar.width).toBeLessThanOrEqual(500 - 10);
    expect(inside(left)).toBe(true);
  });

  it('un objeto que llena el visor deja la barra pegada al borde, dentro', () => {
    const p = placeFloatingBar({ extent: { left: -100, right: 1100, top: -100, bottom: 700 }, bar, viewport });
    expect(p.side).toBe('pinned');
    expect(inside(p)).toBe(true);
  });

  it('un objeto bajo el borde inferior pone la barra encima sin salirse', () => {
    const p = placeFloatingBar({ extent: { left: 400, right: 600, top: 590, bottom: 800 }, bar, viewport });
    expect(inside(p)).toBe(true);
  });

  it('siempre queda dentro del visor en una barrida de posiciones', () => {
    for (let x = -300; x <= 1300; x += 97) {
      for (let y = -300; y <= 900; y += 83) {
        const p = placeFloatingBar({ extent: { left: x, right: x + 150, top: y, bottom: y + 120 }, bar, viewport });
        expect(inside(p)).toBe(true);
      }
    }
  });
});

describe('screenExtent / extentIntersectsViewport', () => {
  it('une los puntos proyectados', () => {
    const e = screenExtent([
      { x: 10, y: 50, inFront: true },
      { x: 90, y: 20, inFront: true },
    ]);
    expect(e).toEqual({ left: 10, right: 90, top: 20, bottom: 50 });
  });

  it('un punto detrás de la cámara o no finito anula el ancla', () => {
    expect(screenExtent([{ x: 1, y: 1, inFront: false }])).toBeNull();
    expect(screenExtent([{ x: Number.NaN, y: 1, inFront: true }])).toBeNull();
    expect(screenExtent([])).toBeNull();
  });

  it('detecta un objeto totalmente fuera del visor', () => {
    expect(extentIntersectsViewport({ left: 1200, right: 1300, top: 10, bottom: 50 }, viewport)).toBe(false);
    expect(extentIntersectsViewport({ left: 900, right: 1300, top: 10, bottom: 50 }, viewport)).toBe(true);
  });
});
