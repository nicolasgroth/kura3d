/**
 * @file src/brand.ts
 * @description Fuente única de verdad de la marca, autoría y licencia de Kura3D,
 * usada por la interfaz y los exportadores de archivos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const BRAND = {
  name: 'Kura3D',
  author: 'Nicolás Groth',
  organization: 'ISGROTH — Innovación y Soluciones GROTH',
  license: 'MIT',
  /** Versión de la app; debe coincidir con package.json (lo verifica una prueba). */
  version: '0.5.0',
} as const;

/** Prefijo de los mensajes de consola de la app. */
export const LOG_TAG = `[${BRAND.name}]`;
