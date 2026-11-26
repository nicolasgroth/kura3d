/**
 * @file src/components/ExportDialog.tsx
 * @description Diálogo único de exportación: formato (STL, 3MF, OBJ+MTL, GLB, PLY), alcance
 * (selección o escena), nombre de archivo basado en el proyecto y laminador destino para 3MF,
 * con avisos de lo que cada formato conserva. Con piezas de una división ofrece un archivo por pieza
 * (ZIP) o un 3MF en disposición de impresión (`split/SplitExportOptions`). Con piezas en dos o más placas, un
 * 3MF con todas las placas o un archivo por placa en ZIP (`dialogs/PlateExportOptions`).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { isPrintable } from '../core/scene/objectRole';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { t, type TranslationKey } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { readStorage, writeStorage } from '../store/preferencesStorage';
import type { ExportFormat, ExportScope } from '../store/modelIoActions';
import { defaultExportBase, sanitizeFileBase } from '../utils/exportNaming';
import { NativeModal } from './NativeModal';
import { SplitExportOptions } from './split/SplitExportOptions';
import { GroupExportOptions } from './dialogs/GroupExportOptions';
import { PlateExportOptions } from './dialogs/PlateExportOptions';
import { SlicerProjectSection } from './dialogs/SlicerProjectSection';
import { planPlateExport } from '../core/scene/plateExport';
import type { PlateExportMode } from '../store/plateExportFlow';
import { selectedGroup } from '../core/scene/groups';
import { hasSplitParts, type SplitExportMode } from '../store/splitExport';
import '../styles/modelIo.css';
import { ExportExcludedNote } from './ExportExcludedNote';

const FORMATS: ExportFormat[] = ['3mf', 'stl', 'obj', 'glb', 'ply'];
const FORMAT_STORAGE_KEY = 'kura3d-export-format';

let pendingFormat: ExportFormat | null = null;
let pendingScope: ExportScope | null = null;

/** Abre el diálogo de exportación con formato y, si se pide, alcance preseleccionados (paleta, menús, atajos). */
export function openExportDialog(format?: ExportFormat, scope?: ExportScope) {
  pendingFormat = format ?? null;
  pendingScope = scope ?? null;
  useKuraStore.getState().setActiveDialog('export');
}

function readStoredFormat(): ExportFormat {
  const stored = readStorage(FORMAT_STORAGE_KEY) as ExportFormat | null;
  return stored && FORMATS.includes(stored) ? stored : '3mf';
}

function storeFormat(format: ExportFormat) {
  writeStorage(FORMAT_STORAGE_KEY, format);
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
  const plates = useKuraStore((s) => s.plates);
  const formId = useId();
  const nameId = useId();

  const exportable = useMemo(() => objects.filter(isPrintable), [objects]);
  const selected = useMemo(
    () => exportable.filter((o) => selectedIds.includes(o.id)),
    [exportable, selectedIds],
  );

  const [format, setFormat] = useState<ExportFormat>('3mf');
  const [scope, setScope] = useState<ExportScope>('scene');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitExportMode | null>(null);
  const [perObject, setPerObject] = useState(false);
  const [plateMode, setPlateMode] = useState<PlateExportMode>('combined');
  const groupSel = useKuraStore((s) => selectedGroup(s.objects, s.groups, s.selectedIds));
  // Si el usuario no ha editado el nombre, seguir el alcance elegido.
  const nameEditedRef = useRef(false);
  // Solo una elección explícita del formato en el diálogo se recuerda; un atajo no la pisa.
  const formatPickedRef = useRef(false);

  // Leído al momento (no del render): el efecto de apertura corre antes de que cambie la selección.
  const selectedGroupName = () => {
    const s = useKuraStore.getState();
    return selectedGroup(s.objects, s.groups, s.selectedIds)?.name;
  };

  const changeScope = (nextScope: ExportScope) => {
    setScope(nextScope);
    if (!nameEditedRef.current) {
      setFileName(defaultExportBase(nextScope, projectName, selected, exportable, t(language, 'app.untitled'), t(language, 'export.selectionSuffix'), t(language, 'export.piecesSuffix'), selectedGroupName()));
    }
  };

  useEffect(() => {
    if (!open) return;
    // Un alcance pedido explícitamente (menú «Exportar selección…») manda; sin selección exportable se usa la escena.
    const nextScope: ExportScope = (pendingScope ?? 'selection') === 'selection' && selected.length > 0 ? 'selection' : 'scene';
    setFormat(pendingFormat ?? initialFormat ?? readStoredFormat());
    pendingFormat = null;
    pendingScope = null;
    setScope(nextScope);
    nameEditedRef.current = false;
    formatPickedRef.current = false;
    setPlateMode('combined');
    setFileName(defaultExportBase(nextScope, projectName, selected, exportable, t(language, 'app.untitled'), t(language, 'export.selectionSuffix'), t(language, 'export.piecesSuffix'), selectedGroupName()));
    // Solo al abrir: los cambios de selección posteriores no pisan lo que escribió el usuario.
  }, [open]);

  const targets = scope === 'selection' ? selected : exportable;
  const base = sanitizeFileBase(fileName) || t(language, 'export.defaultName');
  const splitTargets = hasSplitParts(targets);
  const effectiveSplit = splitTargets && (splitMode === 'perPiece' || (splitMode === 'printLayout' && format === '3mf')) ? splitMode : null;
  const groupPerObject = Boolean(groupSel) && scope === 'selection' && !splitTargets && perObject;
  // Piezas de dos o más placas: la elección aparece; con una sola placa, el diálogo de siempre.
  const platePlan = useMemo(() => (plates.length >= 2 ? planPlateExport(targets, plates) : null), [targets, plates]);
  const showPlates = (platePlan?.buckets.length ?? 0) >= 2 && !effectiveSplit && !groupPerObject;
  const perPlateZip = showPlates && (format !== '3mf' || plateMode === 'perPlate');
  const extension = effectiveSplit === 'perPiece' || groupPerObject || perPlateZip ? 'zip' : format;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || targets.length === 0) return;
    setBusy(true);
    try {
      if (formatPickedRef.current) storeFormat(format);
      const ok = await exportModel({ format, scope, fileName: base, splitMode: effectiveSplit ?? undefined, perObject: groupPerObject, ...(showPlates ? { plateMode } : {}) });
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
            <span>{t(language, 'dialog.export.execute')} {base}.{extension}</span>
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
          <ExportExcludedNote objects={objects} exportable={exportable.length} language={language} />
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
            <span aria-hidden="true">.{perPlateZip ? 'zip' : format}</span>
          </div>
        </div>

        {format === '3mf' && <p className="kura-export-info">{t(language, 'dialog.export3mf.standardNote')}</p>}

        {groupSel && scope === 'selection' && !splitTargets && (
          <GroupExportOptions language={language} groupName={groupSel.name} perObject={perObject} onChange={setPerObject} />
        )}

        {showPlates && platePlan && (
          <PlateExportOptions
            language={language}
            format={format}
            plateCount={platePlan.buckets.length}
            excluded={platePlan.excluded}
            mode={plateMode}
            onChange={setPlateMode}
          />
        )}

        {format === '3mf' && !(showPlates && plateMode === 'perPlate') && <SlicerProjectSection language={language} />}

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
