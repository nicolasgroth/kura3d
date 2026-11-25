/**
 * @file src/__tests__/singleKeyShortcuts.test.ts
 * @description Todo atajo de una tecla del manejador global (App.tsx) anula la accion por defecto: si no, la letra
 * se escribe en el campo que el panel recien abierto enfoca (Mayus+C en «Dividir», Mayus+M en «Molde»...).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import appSource from '../App.tsx?raw';
import { describe, expect, it } from 'vitest';
import { SINGLE_KEY_SHORTCUTS } from '../store/singleKeyShortcuts';

describe('atajos de una tecla', () => {
  it('cada tecla de la cadena final del manejador global esta en la lista que anula el defecto', () => {
    const src: string = appSource;
    const chain = src.slice(src.indexOf('SINGLE_KEY_SHORTCUTS.has(key)'));
    const end = chain.indexOf("window.addEventListener('keydown'");
    const keys = new Set([...chain.slice(0, end).matchAll(/key === '([a-z0-9])'/g)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(8);
    for (const k of keys) expect(SINGLE_KEY_SHORTCUTS.has(k), `falta «${k}»`).toBe(true);
  });
});
