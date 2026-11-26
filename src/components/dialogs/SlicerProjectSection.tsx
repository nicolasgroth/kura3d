/**
 * @file src/components/dialogs/SlicerProjectSection.tsx
 * @description Sección «Laminador» del diálogo de exportación 3MF: muestra si hay proyecto de ejemplo del laminador
 * cargado (impresora y filamentos tomados), permite cargarlo desde un .3mf guardado por Bambu Studio / OrcaSlicer /
 * Elegoo Slicer y quitarlo. Solo se guardan los identificadores de perfil de la lista blanca (`slicerProjectSample`);
 * con él, el 3MF exportado abre con sus placas, nombres y colores. Errores claros si el archivo no trae perfil.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useId, useState } from 'react';
import { t } from '../../i18n';
import { extractSlicerProjectSample, type SlicerProjectSample } from '../../engine/io/slicerProjectSample';
import { clearSlicerProjectSample, loadSlicerProjectSample, saveSlicerProjectSample } from '../../store/slicerProjectPreference';
import { LocalFileError, openLocalFiles } from '../../utils/platformBridge';
import type { LanguageCode } from '../../types/kura';

/** Un proyecto del laminador con miniaturas pesa unos MB; más de esto no es un proyecto razonable. */
const MAX_SAMPLE_FILE_BYTES = 256 * 1024 * 1024;

/** Filamentos distintos, en orden, para mostrarlos sin repetir. */
const uniqueNames = (names: readonly string[]) => [...new Set(names)].join(', ');

export const SlicerProjectSection: React.FC<{ language: LanguageCode }> = ({ language }) => {
  const [sample, setSample] = useState<SlicerProjectSample | null>(() => loadSlicerProjectSample());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hintId = useId();

  const load = async () => {
    setError(null);
    setBusy(true);
    let name = '';
    try {
      const [file] = await openLocalFiles('.3mf', MAX_SAMPLE_FILE_BYTES);
      if (!file) return;
      name = file.name;
      const data = await file.read();
      const result = extractSlicerProjectSample(new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data));
      if (!result.ok) {
        setError(t(language, `dialog.export.slicer.error.${result.reason}`, { name }));
        return;
      }
      if (!saveSlicerProjectSample(result.sample)) {
        setError(t(language, 'dialog.export.slicer.error.save'));
        return;
      }
      setSample(result.sample);
    } catch (e) {
      setError(t(language, 'dialog.export.slicer.error.unreadable', { name: e instanceof LocalFileError ? e.fileName : name }));
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    clearSlicerProjectSample();
    setSample(null);
    setError(null);
  };

  return (
    <fieldset className="kura-export-scope kura-export-slicer" aria-describedby={hintId}>
      <legend>{t(language, 'dialog.export.slicer.legend')}</legend>
      <p className="kura-export-info" aria-live="polite">
        {sample
          ? t(language, 'dialog.export.slicer.loaded', {
            printer: sample.printerSettingsId,
            count: sample.filamentSettingsIds.length,
            filaments: uniqueNames(sample.filamentSettingsIds),
          })
          : t(language, 'dialog.export.slicer.none')}
      </p>
      <p id={hintId} className="kura-export-info">{t(language, 'dialog.export.slicer.hint')}</p>
      <div className="kura-export-slicer-actions">
        <button type="button" className="kura-btn" onClick={() => void load()} disabled={busy}>
          {t(language, 'dialog.export.slicer.load')}
        </button>
        {sample && (
          <button type="button" className="kura-btn" onClick={remove} disabled={busy}>
            {t(language, 'dialog.export.slicer.remove')}
          </button>
        )}
      </div>
      {error && <p className="kura-export-info kura-export-error" role="alert">{error}</p>}
    </fieldset>
  );
};
