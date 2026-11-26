/**
 * @file src/components/fitToBed/BedProfileSelect.tsx
 * @description Selector de la cama activa (impresoras de fábrica y camas del usuario) con el botón
 * «Mis camas» que abre el editor de perfiles propios.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId, useState } from 'react';
import { getLocalizedPrinterName, t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { DEFAULT_PRINTER_PROFILES } from '../../types/kura';
import { BedProfilesEditor } from './BedProfilesEditor';

export const BedProfileSelect: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const profile = useKuraStore((s) => s.printerProfile);
  const userBeds = useKuraStore((s) => s.userBedProfiles);
  const setPrinterProfile = useKuraStore((s) => s.setPrinterProfile);
  const [editing, setEditing] = useState(false);
  const selectId = useId();
  const editorId = useId();
  const known = DEFAULT_PRINTER_PROFILES.some((p) => p.id === profile.id) || userBeds.some((p) => p.id === profile.id);
  return (
    <div className="kura-fit-bed">
      <label htmlFor={selectId} className="kura-section-label">{t(language, 'fit.bed')}</label>
      <div className="kura-fit-bed-row">
        <select id={selectId} className="kura-input" value={profile.id} onChange={(e) => setPrinterProfile(e.target.value)} data-testid="fit-bed-select">
          {!known && <option value={profile.id}>{getLocalizedPrinterName(language, profile)}</option>}
          <optgroup label={t(language, 'bedProfiles.builtIn')}>
            {DEFAULT_PRINTER_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{getLocalizedPrinterName(language, p)}</option>
            ))}
          </optgroup>
          {userBeds.length > 0 && (
            <optgroup label={t(language, 'bedProfiles.mine')}>
              {userBeds.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        <button type="button" className="kura-btn kura-btn-small" aria-expanded={editing} aria-controls={editorId} onClick={() => setEditing((v) => !v)} data-testid="fit-bed-edit">
          {t(language, 'bedProfiles.title')}
        </button>
      </div>
      {editing && (
        <div id={editorId}>
          <BedProfilesEditor />
        </div>
      )}
    </div>
  );
};
