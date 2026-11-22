import { describe, expect, it } from 'vitest';
import { computeSelectionBounds } from './selectionBounds';

const cube = (x: number, rot: [number, number, number] = [0, 0, 0]) => ({
  mesh: { positions: new Float32Array([-5, -5, -5, 5, 5, 5]) },
  position: [x, 0, 0] as [number, number, number],
  rotation: rot,
  scale: [1, 1, 1] as [number, number, number],
});

describe('computeSelectionBounds', () => {
  it('devuelve null sin geometría', () => {
    expect(computeSelectionBounds([])).toBeNull();
  });

  it('un objeto mide lo mismo que su caja', () => {
    expect(computeSelectionBounds([cube(0)])?.size).toEqual([10, 10, 10]);
  });

  it('varios objetos usan la caja envolvente de toda la selección', () => {
    const b = computeSelectionBounds([cube(0), cube(30)]);
    expect(b?.size).toEqual([40, 10, 10]);
    expect(b?.min[0]).toBe(-5);
    expect(b?.max[0]).toBe(35);
  });

  it('aplica la escala', () => {
    const o = { ...cube(0), scale: [2, 1, 1] as [number, number, number] };
    expect(computeSelectionBounds([o])?.size[0]).toBe(20);
  });
});
