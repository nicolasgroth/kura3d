/**
 * @file src/components/measure/measureClipboard.ts
 * @description Copiar el valor de una medición al portapapeles con aviso; si el navegador no deja,
 * muestra el valor en el aviso para copiarlo a mano.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

export async function copyMeasureValue(value: string): Promise<void> {
  const { language, addToast } = useKuraStore.getState();
  try {
    await navigator.clipboard.writeText(value);
    addToast(t(language, 'measure.copied', { value }), 'success');
  } catch {
    addToast(value, 'info');
  }
}
