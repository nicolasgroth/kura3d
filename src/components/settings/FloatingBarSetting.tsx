/**
 * @file src/components/settings/FloatingBarSetting.tsx
 * @description Ajuste «Barra de acciones junto al objeto» (activada por defecto): preferencia local de vista, no del proyecto.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId } from 'react';
import { t } from '../../i18n';
import { useFloatingBarPrefs } from '../../store/floatingBarState';
import { useKuraStore } from '../../store/useKuraStore';

export const FloatingBarSetting: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const enabled = useFloatingBarPrefs((s) => s.enabled);
  const setEnabled = useFloatingBarPrefs((s) => s.setEnabled);
  const id = useId();
  const hintId = useId();
  return (
    <div className="kura-form-field kura-floating-bar-setting">
      <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input id={id} type="checkbox" checked={enabled} aria-describedby={hintId} onChange={(e) => setEnabled(e.target.checked)} />
        <span>{t(language, 'floatingBar.setting')}</span>
      </label>
      <small id={hintId} className="kura-field-hint">{t(language, 'floatingBar.setting.hint')}</small>
    </div>
  );
};
