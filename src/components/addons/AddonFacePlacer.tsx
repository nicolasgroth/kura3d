/**
 * @file src/components/addons/AddonFacePlacer.tsx
 * @description Colocar un agregado sin ratón: selector de cara (Arriba, Abajo, Frente, Atrás, Izquierda, Derecha) y
 * un botón que lo pone en el centro de esa cara de la pieza seleccionada (o de la única pieza sólida), con la misma
 * ruta de colocación del clic (`panel.placeAt`). La cara se resuelve con `resolveAddonPlacement`, la misma regla del
 * comando de MCP «cara por nombre».
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId, useState } from 'react';
import { ADDON_FACES, resolveAddonPlacement, type AddonFace } from '../../core/addons/addonPlacement';
import { isSolid } from '../../core/scene/objectRole';
import { t, type TranslationKey } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject, Vec3 } from '../../types/kura';

export interface AddonFacePlacerProps {
  /** Prefijo de los `data-testid` (`<prefijo>-face`, `<prefijo>-face-place`). */
  testId: string;
  /** Misma ruta que el clic en el visor. */
  place: (hostId: string, point: Vec3, normal: Vec3) => Promise<boolean>;
  /** Hay campos inválidos: no se coloca. */
  blocked: boolean;
}

/** Pieza donde colocar: la primera seleccionada que sirva, o la única sólida de la escena. */
export function addonFaceHost(objects: readonly SceneObject[], selectedIds: readonly string[]): SceneObject | null {
  const usable = objects.filter((o) => o.visible && isSolid(o) && !o.locked && !o.metadata?.addon);
  const picked = usable.find((o) => selectedIds.includes(o.id));
  return picked ?? (usable.length === 1 ? usable[0] : null);
}

export const AddonFacePlacer: React.FC<AddonFacePlacerProps> = ({ testId, place, blocked }) => {
  const language = useKuraStore((s) => s.language);
  const busy = useKuraStore((s) => s.busyOperation);
  const [face, setFace] = useState<AddonFace>('top');
  const uid = useId();
  const tip = t(language, 'addon.face.tip');

  const run = () => {
    const state = useKuraStore.getState();
    const host = addonFaceHost(state.objects, state.selectedIds);
    if (!host) {
      state.addToast(t(language, 'addon.face.needHost'), 'info');
      return;
    }
    try {
      const { point, normal } = resolveAddonPlacement(host, { kind: 'face', face, offsetMm: [0, 0] });
      void place(host.id, point, normal);
    } catch {
      state.addToast(t(language, 'addon.face.miss'), 'info');
    }
  };

  return (
    <fieldset className="kura-addon-face" data-testid={`${testId}-face`}>
      <legend>{t(language, 'addon.face.group')}</legend>
      <div className="kura-field-row">
        <label htmlFor={`${uid}-face`}>{t(language, 'addon.face.label')}</label>
        <select id={`${uid}-face`} className="kura-select" value={face} onChange={(e) => setFace(e.target.value as AddonFace)} data-testid={`${testId}-face-select`}>
          {ADDON_FACES.map((f) => (
            <option key={f} value={f}>{t(language, `addon.face.${f}` as TranslationKey)}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        disabled={blocked || Boolean(busy)}
        title={tip}
        aria-describedby={`${uid}-tip`}
        onClick={run}
        data-testid={`${testId}-face-place`}
      >
        {t(language, 'addon.face.place')}
      </button>
      <p id={`${uid}-tip`} className="kura-magnet-hint">{tip}</p>
    </fieldset>
  );
};
