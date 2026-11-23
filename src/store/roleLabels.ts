/**
 * @file src/store/roleLabels.ts
 * @description Clave i18n del nombre visible de cada rol de objeto (Sólido / Negativo / Referencia),
 * compartida por menús, inspector, árbol y la etiqueta de "Repetir".
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import type { TranslationKey } from '../i18n/translations';
import type { ObjectRole } from '../types/kura';

export const ROLE_LABEL_KEY: Record<ObjectRole, TranslationKey> = {
  solid: 'menu.type.solid',
  negative: 'menu.type.negative',
  reference: 'menu.type.reference',
};
