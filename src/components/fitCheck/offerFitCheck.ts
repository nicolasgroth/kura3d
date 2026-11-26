/**
 * @file src/components/fitCheck/offerFitCheck.ts
 * @description Comprobación final opcional tras «Ajustar a la impresora»: si el ajuste reescaló piezas con
 * referencias cerca o con medidas funcionales, avisa con la acción «Ver encaje», que abre el panel de
 * Comprobar encaje y corre la comprobación (en el Worker) sobre el bloque ya ajustado y las referencias.
 * No corre nada sola: la escena ya quedó transformada y el usuario decide.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { t } from '../../i18n';
import { fitCheckAfterFitTargets } from '../../store/fitCheckTargets';
import { useKuraStore } from '../../store/useKuraStore';
import { openActionPanel } from '../shell/actionRunners';

/** Abre «Comprobar encaje» y comprueba esos objetos. */
export function openFitCheckFor(ids: string[]): void {
  openActionPanel('fitCheck');
  void useKuraStore.getState().checkFit({ ids });
}

/** Ofrece la comprobación tras un reescalado (`factor` distinto de 1); devuelve si se ofreció. */
export function offerFitCheckAfterFit(blockIds: readonly string[], functionalCount: number, factor: number): boolean {
  if (Math.abs(factor - 1) < 1e-9) return false;
  const state = useKuraStore.getState();
  const ids = fitCheckAfterFitTargets(state.objects, blockIds, functionalCount);
  if (!ids) return false;
  state.addToast(t(state.language, 'fitCheck.ui.afterFit'), 'info', {
    label: t(state.language, 'fitCheck.ui.afterFit.action'),
    run: () => openFitCheckFor(ids),
    targetIds: ids,
  });
  return true;
}
