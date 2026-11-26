/**
 * @file src/components/viewmode/usePlateToolReason.ts
 * @description Motivo traducido por el que las acciones de cama (apoyar, centrar, distribuir, ajustar a la impresora,
 * mover a placa) están deshabilitadas en la vista actual, o `undefined` si se pueden usar. Sirve de `title` y de razón
 * de los controles; la regla vive en `core/scene/viewMode.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { plateToolBlockReason } from '../../core/scene/viewMode';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

export function usePlateToolReason(): string | undefined {
  const language = useKuraStore((s) => s.language);
  const layout = useKuraStore((s) => s.layout);
  const key = plateToolBlockReason(layout);
  return key ? t(language, key) : undefined;
}
