/**
 * @file src/utils/aboutInfo.ts
 * @description Datos fijos del diálogo «Acerca de»: enlaces (leídos de `package.json`, sin inventar
 * ninguno) y las bibliotecas abiertas principales con su licencia. Las licencias las verifica una
 * prueba contra `node_modules/<paquete>/package.json`; no se escriben de memoria.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { homepage, repository } from '../../package.json';

/** URL del repositorio tal como la define `package.json` (sin el sufijo `.git`). */
export const REPO_URL: string = repository.url.replace(/\.git$/, '');

/** Página del proyecto según `package.json` (si no la define, el repositorio). */
export const HOME_URL: string = homepage || REPO_URL;

/** Carpeta de guías de uso dentro del repositorio. */
export const GUIDES_URL = `${REPO_URL}/tree/main/docs/guia`;

export interface AboutLib {
  /** Nombre que se muestra (propio de cada proyecto, no se traduce). */
  name: string;
  /** Paquete de npm del que se leyó la licencia. */
  pkg: string;
  /** Licencia declarada por el paquete (SPDX). */
  license: string;
  /** Clave i18n del «para qué» de la biblioteca. */
  useKey:
    | 'about.lib.react'
    | 'about.lib.three'
    | 'about.lib.r3f'
    | 'about.lib.manifold'
    | 'about.lib.zustand'
    | 'about.lib.tauri'
    | 'about.lib.vite'
    | 'about.lib.lucide';
}

export const ABOUT_LIBS: readonly AboutLib[] = [
  { name: 'React', pkg: 'react', license: 'MIT', useKey: 'about.lib.react' },
  { name: 'three.js', pkg: 'three', license: 'MIT', useKey: 'about.lib.three' },
  { name: 'React Three Fiber', pkg: '@react-three/fiber', license: 'MIT', useKey: 'about.lib.r3f' },
  { name: 'Manifold', pkg: 'manifold-3d', license: 'Apache-2.0', useKey: 'about.lib.manifold' },
  { name: 'Zustand', pkg: 'zustand', license: 'MIT', useKey: 'about.lib.zustand' },
  { name: 'Tauri', pkg: '@tauri-apps/api', license: 'Apache-2.0 OR MIT', useKey: 'about.lib.tauri' },
  { name: 'Vite', pkg: 'vite', license: 'MIT', useKey: 'about.lib.vite' },
  { name: 'Lucide', pkg: 'lucide-react', license: 'ISC', useKey: 'about.lib.lucide' },
];
