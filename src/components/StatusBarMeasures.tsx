/**
 * @file src/components/StatusBarMeasures.tsx
 * @description Indicador compacto de unidad e impresora en la barra de estado: botón que abre un popover
 * con los dos selectores (Escape cierra y devuelve el foco). También se abre desde la paleta de comandos.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { Ruler } from 'lucide-react';
import { getLocalizedPrinterName, t } from '../i18n';
import { hudBed } from '../core/scene/bedLabel';
import { useKuraStore } from '../store/useKuraStore';
import { MeasuresFields } from './settings/MeasuresFields';
import '../styles/statusMeasures.css';

export const StatusBarMeasures: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const unitSystem = useKuraStore((s) => s.unitSystem);
  const printerProfile = useKuraStore((s) => s.printerProfile);
  const plates = useKuraStore((s) => s.plates);
  const activePlateId = useKuraStore((s) => s.activePlateId);
  const customBedDimensions = useKuraStore((s) => s.customBedDimensions);
  const request = useKuraStore((s) => s.measuresRequest);
  const openSettings = useKuraStore((s) => s.openSettings);
  const popoverId = useId();
  const popover = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const unitSelect = useRef<HTMLSelectElement>(null);
  const printerSelect = useRef<HTMLSelectElement>(null);
  const focusTarget = useRef<'unit' | 'printer'>('unit');
  const [expanded, setExpanded] = useState(false);
  const handled = useRef(request?.nonce ?? 0);

  // Como el rótulo del visor: la placa activa con cama propia manda sobre la impresora del proyecto.
  const printerName = hudBed({ printerProfile, customBedDimensions, plates, activePlateId }).ownName ?? getLocalizedPrinterName(language, printerProfile);
  const label = t(language, 'status.measures.button', { unit: unitSystem, printer: printerName });

  // Petición externa (paleta de comandos): se abre tras cerrarse la paleta para no pelear por el foco.
  useEffect(() => {
    if (!request || request.nonce === handled.current) return;
    handled.current = request.nonce;
    focusTarget.current = request.focus;
    const id = window.setTimeout(() => popover.current?.showPopover(), 60);
    return () => window.clearTimeout(id);
  }, [request]);

  const close = () => {
    popover.current?.hidePopover();
    trigger.current?.focus();
  };

  const onToggle = (event: React.SyntheticEvent) => {
    const open = (event.nativeEvent as Event & { newState?: string }).newState === 'open';
    setExpanded(open);
    if (open) {
      const target = focusTarget.current === 'printer' ? printerSelect : unitSelect;
      focusTarget.current = 'unit';
      requestAnimationFrame(() => target.current?.focus());
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="kura-statusbar-btn kura-measures-trigger"
        aria-label={label}
        title={`${unitSystem} · ${printerName}`}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={popoverId}
        popoverTarget={popoverId}
      >
        <Ruler size={12} aria-hidden="true" />
        <span className="kura-measures-unit">{unitSystem}</span>
        <span aria-hidden="true">·</span>
        <span className="kura-measures-printer">{printerName}</span>
      </button>
      <div
        className="kura-measures-popover"
        id={popoverId}
        popover="auto"
        role={expanded ? 'dialog' : undefined}
        aria-label={expanded ? t(language, 'status.measures.title') : undefined}
        ref={popover}
        onToggle={onToggle}
        onKeyDown={onKeyDown}
      >
        <strong>{t(language, 'status.measures.title')}</strong>
        <MeasuresFields idPrefix="status-measures" unitRef={unitSelect} printerRef={printerSelect} />
        <button
          type="button"
          className="kura-btn kura-btn-sm"
          onClick={() => {
            popover.current?.hidePopover();
            openSettings('project');
          }}
        >
          {t(language, 'status.measures.settings')}
        </button>
      </div>
    </>
  );
};
