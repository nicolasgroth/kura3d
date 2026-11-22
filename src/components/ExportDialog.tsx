/**
 * @file src/components/ExportDialog.tsx
 * @description Diálogo único de exportación: formato (STL, 3MF, OBJ+MTL, GLB, PLY), alcance
 * (selección o escena), nombre de archivo basado en el proyecto y laminador destino para 3MF,
 * con avisos de lo que cada formato conserva. Con piezas de una división ofrece un archivo por pieza
 * (ZIP) o un 3MF en disposición de impresión (`split/SplitExportOptions`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import type { ExportFormat, ExportScope } from '../store/modelIoActions';
import { defaultExportBase, sanitizeFileBase } from '../utils/exportNaming';
import { NativeModal } from './NativeModal';
import { SplitExportOptions } from './split/SplitExportOptions';
import { hasSplitParts, type SplitExportMode } from '../store/splitExport';
import '../styles/modelIo.css';

const FORMATS: ExportFormat[] = ['3mf', 'stl', 'obj', 'glb', 'ply'];
const FORMAT_STORAGE_KEY = 'kura3d-export-format';

let pendingFormat: ExportFormat | null = null;

/** Abre el diálogo de exportación con un formato preseleccionado (paleta, atajos). */
export function openExportDialog(format?: ExportFormat) {
  pendingFormat = format ?? null;
  useKuraStore.getState().setActiveDialog('export');
}

function readStoredFormat(): ExportFormat {
  try {
    const stored = localStorage.getItem(FORMAT_STORAGE_KEY) as ExportFormat | null;
    return stored && FORMATS.includes(stored) ? stored : '3mf';
  } catch {
    return '3mf';
  }
}

function storeFormat(format: ExportFormat) {
  try {
    localStorage.setItem(FORMAT_STORAGE_KEY, format);
  } catch {
    // Almacenamiento bloqueado: la preferencia es solo una comodidad.
  }
}

export const ExportDialog: React.FC<{ open: boolean; onClose: () => void; initialFormat?: ExportFormat }> = ({
  open,
  onClose,
  initialFormat,
}) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const projectName = useKuraStore((s) => s.projectName);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const exportModel = useKuraStore((s) => s.exportModel);
  const formId = useId();
  const nameId = useId();

  const exportable = useMemo(() => objects.filter((o) => o.visible && !o.isHole), [objects]);
  const selected = useMemo(
    () => exportable.filter((o) => selectedIds.includes(o.id)),
    [exportable, selectedIds],
  );

  const [format, setFormat] = useState<ExportFormat>('3mf');
  const [scope, setScope] = useState<ExportScope>('scene');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitExportMode | null>(null);
  // Si el usuario no ha editado el nombre, seguir el alcance elegido.
  const nameEditedRef = useRef(false);
  // Solo una elección explícita del formato en el diálogo se recuerda; un atajo no la pisa.
  const formatPickedRef = useRef(false);

  const changeScope = (nextScope: ExportScope) => {
    setScope(nextScope);
    if (!nameEditedRef.current) {
      setFileName(defaultExportBase(nextScope, projectName, selected, exportable, t(language, 'export.defaultName'), t(language, 'export.selectionSuffix')));
    }
  };

  useEffect(() => {
    if (!open) return;
    const nextScope: ExportScope = selected.length > 0 ? 'selection' : 'scene';
    setFormat(pendingFormat ?? initialFormat ?? readStoredFormat());
    pendingFormat = null;
    setScope(nextScope);
    nameEditedRef.current = false;
    formatPickedRef.current = false;
    setFileName(defaultExportBase(nextScope, projectName, selected, exportable, t(language, 'export.defaultName'), t(language, 'export.selectionSuffix')));
    // Solo al abrir: los cambios de selección posteriores no pisan lo que escribió el usuario.
  }, [open]);

  const targets = scope === 'selection' ? selected : exportable;
  const base = sanitizeFileBase(fileName) || t(language, 'export.defaultName');
  const splitTargets = hasSplitParts(targets);
  const effectiveSplit = splitTargets && (splitMode === 'perPiece' || (splitMode === 'printLayout' && format === '3mf')) ? splitMode : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || targets.length === 0) return;
    setBusy(true);
    try {
      if (formatPickedRef.current) storeFormat(format);
      const ok = await exportModel({ format, scope, fileName: base, splitMode: effectiveSplit ?? undefined });
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <NativeModal
      open={open}
      onClose={onClose}
      title={t(language, 'dialog.export.title')}
      footer={
        <>
          <button type="button" className="kura-btn" onClick={onClose}>
            {t(language, 'dialog.cancel')}
          </button>
          <button type="submit" form={formId} className="kura-btn kura-btn-primary" disabled={busy || targets.length === 0}>
            <Download size={14} aria-hidden="true" />
            <span>{t(language, 'dialog.export.execute')} {base}.{effectiveSplit === 'perPiece' ? 'zip' : format}</span>
          </button>
        </>
      }
    >
      <form id={formId} className="kura-export-form" onSubmit={(e) => void handleSubmit(e)}>
        <p className="kura-export-desc">{t(language, 'dialog.export.desc')}</p>

        <fieldset className="kura-export-options">
          <legend>{t(language, 'dialog.export.format')}</legend>
          {FORMATS.map((f) => (
            <label key={f} className={`kura-export-option ${format === f ? 'is-active' : ''}`}>
              <input type="radio" name={`${formId}-format`} value={f} checked={format === f} onChange={() => { formatPickedRef.current = true; setFormat(f); }} />
              <span className="kura-export-option-title">{f.toUpperCase()}</span>
              <span className="kura-export-option-hint">{t(language, `dialog.export.format.${f}` as TranslationKey)}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="kura-export-scope">
          <legend>{t(language, 'dialog.export.scope')}</legend>
          <label
            className={selected.length === 0 ? 'is-disabled' : undefined}
            title={selected.length === 0 ? t(language, 'dialog.export.scope.selectionEmptyTip') : undefined}
          >
            <input
              type="radio"
              name={`${formId}-scope`}
              checked={scope === 'selection' && selected.length > 0}
              disabled={selected.length === 0}
              onChange={() => changeScope('selection')}
            />
            {t(language, 'dialog.export.scope.selection', { count: selected.length })}
          </label>
          <label>
            <input type="radio" name={`${formId}-scope`} checked={scope === 'scene'} onChange={() => changeScope('scene')} />
            {t(language, 'dialog.export.scope.scene', { count: exportable.length })}
          </label>
        </fieldset>

        <div className="kura-form-field">
          <label htmlFor={nameId}>{t(language, 'dialog.export.fileName')}</label>
          <div className="kura-export-name">
            <input
              id={nameId}
              className="kura-input"
              value={fileName}
              maxLength={120}
              spellCheck={false}
              onChange={(e) => {
                nameEditedRef.current = true;
                setFileName(e.target.value);
              }}
            />
            <span aria-hidden="true">.{format}</span>
          </div>
        </div>

        {format === '3mf' && <p className="kura-export-info">{t(language, 'dialog.export3mf.standardNote')}</p>}

        {splitTargets && (
          <SplitExportOptions
            format={format}
            base={base}
            firstCode={targets.find((o) => o.metadata?.split)?.metadata?.split?.code ?? 'A1'}
            value={splitMode}
            onChange={setSplitMode}
          />
        )}

        <ul className="kura-export-notes">
          {format === 'stl' && <li>{t(language, 'dialog.export.noColors')}</li>}
          {format === 'obj' && <li>{t(language, 'dialog.export.objNote', { obj: `${base}.obj`, mtl: `${base}.mtl` })}</li>}
          {format === 'glb' && <li>{t(language, 'dialog.export.glbNote')}</li>}
          <li>{t(language, 'dialog.export.holesNote')}</li>
        </ul>
      </form>
    </NativeModal>
  );
};
