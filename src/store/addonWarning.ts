/**
 * @file src/store/addonWarning.ts
 * @description Forma común de un aviso de agregado: tipo, texto largo (panel y aviso emergente), texto corto (se
 * suma al «agregado» de cada clic) y sus parámetros. La usan el ojo de cerradura y el paso de cable.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { TranslationKey } from '../i18n';

export interface AddonWarning<K extends string = string> {
  kind: K;
  key: TranslationKey;
  short: TranslationKey;
  params: Record<string, string>;
}
