/**
 * @file src/utils/userSizeText.ts
 * @description Texto "X × Y × Z" de un tamaño interno (Y arriba) en los ejes que ve el usuario
 * (Z = altura). Todo aviso que muestre medidas de una pieza debe pasar por aquí.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { LanguageCode, Vec3 } from '../types/kura';
import { formatNumber } from './plural';
import { toUserSize } from '../core/scene/displayAxes';

/** "ancho × fondo × alto" del usuario a partir de un tamaño interno [x, y(alto), z]. */
export function formatUserSize(language: LanguageCode, internalSize: Readonly<Vec3>, maximumFractionDigits = 0): string {
  return toUserSize(internalSize).map((v) => formatNumber(language, v, { maximumFractionDigits })).join(' × ');
}
