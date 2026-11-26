/**
 * @file src/components/dialogs/ThreadPairOption.tsx
 * @description Opción «Crear la pareja que enrosca» del diálogo de roscas ISO: casilla y tipo de pareja (perno + tuerca,
 * o agujero roscado + perno). Con la pareja elegida, el diálogo crea las dos piezas lado a lado con la holgura aplicada
 * y avisa el resultado de la comprobación de enroscado (`useCreateThreadPair`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import type { ThreadPairKind } from '../../core/operations/screwContainerOperations';
import { screwFitText } from '../../core/scene/screwFitText';
import { useKuraStore } from '../../store/useKuraStore';

export const ThreadPairOption: React.FC<{ value: ThreadPairKind | null; onChange: (value: ThreadPairKind | null) => void }> = ({ value, onChange }) => {
  const language = useKuraStore((s) => s.language);
  const uid = useId();
  return (
    <div className="kura-form-field">
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={t(language, 'dialog.thread.pairTip')}>
        <input
          type="checkbox"
          checked={value !== null}
          aria-describedby={`${uid}-tip`}
          onChange={(e) => onChange(e.target.checked ? 'bolt-nut' : null)}
        />
        <span style={{ fontSize: 12, fontWeight: 600 }}>{t(language, 'dialog.thread.pair')}</span>
      </label>
      <p id={`${uid}-tip`} style={{ fontSize: 11, opacity: 0.75, margin: '2px 0 0' }}>{t(language, 'dialog.thread.pairTip')}</p>
      {value !== null && (
        <select
          className="kura-select"
          aria-label={t(language, 'dialog.thread.pair')}
          value={value}
          onChange={(e) => onChange(e.target.value as ThreadPairKind)}
          style={{ marginTop: 4 }}
        >
          <option value="bolt-nut">{t(language, 'dialog.thread.pairBoltNut')}</option>
          <option value="hole-bolt">{t(language, 'dialog.thread.pairHoleBolt')}</option>
        </select>
      )}
    </div>
  );
};

/** Crea la pareja y avisa el enroscado; devuelve true si se creó. */
export function useCreateThreadPair() {
  const createThreadPair = useKuraStore((s) => s.createThreadPair);
  const addToast = useKuraStore((s) => s.addToast);
  const language = useKuraStore((s) => s.language);
  return async (args: Parameters<typeof createThreadPair>[0]): Promise<boolean> => {
    const created = await createThreadPair(args);
    if (!created) return false;
    addToast(screwFitText(created.fit, language), created.fit.fits ? 'success' : 'error');
    return true;
  };
}
