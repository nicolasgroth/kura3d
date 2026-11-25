/**
 * @file src/components/ImportMenuButton.tsx
 * @description Botón de importación de la barra superior: abre el selector de varios archivos y,
 * con su menú, elige la colocación (apoyar el conjunto en la cama o conservar la posición original).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useId, useRef } from 'react';
import { ChevronDown, FileUp, SquareDashed } from 'lucide-react';
import { t } from '../i18n';
import { useKuraStore } from '../store/useKuraStore';
import { helpAttrs } from './shell/controlHelp';
import '../styles/modelIo.css';

export function ImportMenuButton() {
  const language = useKuraStore((s) => s.language);
  const placement = useKuraStore((s) => s.importPlacementMode);
  const setPlacement = useKuraStore((s) => s.setImportPlacementMode);
  const importMeshFromDialog = useKuraStore((s) => s.importMeshFromDialog);
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const placementLabel = t(language, placement === 'original' ? 'import.placement.original' : 'import.placement.bed');

  return (
    <div className="kura-import-split">
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        onClick={() => void importMeshFromDialog()}
        {...helpAttrs('top.import', language)}
        title={`${t(language, 'topbar.importModelTip')} · ${placementLabel}`}
        aria-label={t(language, 'topbar.importModel')}
      >
        <FileUp size={13} aria-hidden="true" />
        <span className="kura-btn-label kura-label-keep">{t(language, 'topbar.importShort')}</span>
      </button>
      <button
        type="button"
        className="kura-btn kura-btn-sm"
        popoverTarget={menuId}
        {...helpAttrs('top.importOptions', language)}
        title={t(language, 'import.menu')}
        aria-label={t(language, 'import.menu')}
      >
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      <div className="kura-project-popover kura-import-popover" id={menuId} popover="auto" ref={menu}>
        <fieldset>
          <legend>{t(language, 'import.placement.title')}</legend>
          {(['bed', 'original'] as const).map((mode) => (
            <label key={mode} className="kura-import-choice">
              <input
                type="radio"
                name={`${menuId}-placement`}
                checked={placement === mode}
                onChange={() => setPlacement(mode)}
              />
              <span>{t(language, `import.placement.${mode}`)}</span>
              <small>{t(language, `import.placement.${mode}Hint`)}</small>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          onClick={() => {
            menu.current?.hidePopover();
            void importMeshFromDialog();
          }}
        >
          <FileUp size={14} aria-hidden="true" />
          {t(language, 'import.fromFile')}
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          title={t(language, 'import.asReference.hint')}
          onClick={() => {
            menu.current?.hidePopover();
            void importMeshFromDialog(undefined, { asReference: true });
          }}
        >
          <SquareDashed size={14} aria-hidden="true" />
          {t(language, 'import.asReference')}
        </button>
      </div>
    </div>
  );
}
