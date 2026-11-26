/**
 * @file src/components/planeCutOptions.ts
 * @description Opciones del corte por plano que arma el diálogo: el selector guarda el eje interno y la
 * mitad "positiva/negativa" que el usuario ve en sus ejes (en el Y del usuario el lado + es el −Z interno),
 * así que aquí se convierte la mitad al sentido del motor. Función pura para probar la ruta real.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import type { PlaneCutOptions } from '../types/kura';
import { axisToUser, keepModeFromUser } from '../store/commandAxes';

/** Opciones para `planeCutObject` desde lo que muestra el diálogo (eje interno, mitad en sentido del usuario). */
export function planeCutOptionsFromDialog(dialog: PlaneCutOptions): PlaneCutOptions {
  return { ...dialog, keepMode: keepModeFromUser(axisToUser(dialog.axis), dialog.keepMode) };
}
