/**
 * @file src/components/toastActionA11y.ts
 * @description Nombre accesible de los botones de acción de un aviso (WCAG 2.5.3, «etiqueta en el nombre»): el nombre
 * accesible empieza por el texto visible. Si la acción trae una frase larga (`ariaLabel`) que no empieza por la
 * etiqueta, el nombre es la etiqueta y la frase pasa a descripción (`title` y `aria-describedby`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

export interface ToastActionA11y {
  /** `aria-label` del botón (`undefined`: el texto visible ya es el nombre). */
  name: string | undefined;
  /** Texto de apoyo (tooltip y descripción), o `undefined`. */
  description: string | undefined;
}

const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

export function toastActionA11y(action: { label: string; ariaLabel?: string }): ToastActionA11y {
  const long = action.ariaLabel?.trim();
  if (!long) return { name: undefined, description: undefined };
  if (normalize(long).startsWith(normalize(action.label))) return { name: long, description: undefined };
  return { name: action.label, description: long };
}
