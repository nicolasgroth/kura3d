/**
 * @file src/components/contextPanel/ObjectOperations.tsx
 * @description Accesos del resumen de un objeto: las acciones con opciones (Ahuecar, Simplificar, Textura,
 * Módulos, Revisar, Detectar) abren solo sus opciones en el panel; Cortar, Dividir, Ajustar a la impresora,
 * Molde, Proyectar y Rosca abren su panel de operación; separar piezas o colores se ejecuta directo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';
import { Bolt, Box, Grid3x3, Minimize2, PaintBucket, Puzzle, ScanSearch, Scissors, ShieldCheck, Sparkles, Split, Type, Waves } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import { actionAvailability, type ActionId } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { ColorSplitControl } from '../inspector/ColorSplitControl';
import { openActionPanel } from '../shell/actionRunners';

const PANEL_BUTTONS: ReadonlyArray<{ id: ActionId; icon: React.ReactNode }> = [
  { id: 'hollow', icon: <Box size={13} aria-hidden="true" /> },
  { id: 'simplify', icon: <Sparkles size={13} aria-hidden="true" /> },
  { id: 'texture', icon: <Waves size={13} aria-hidden="true" /> },
  { id: 'modules', icon: <Puzzle size={13} aria-hidden="true" /> },
  { id: 'validate', icon: <ShieldCheck size={13} aria-hidden="true" /> },
  { id: 'detect', icon: <ScanSearch size={13} aria-hidden="true" /> },
];

export const ObjectOperations: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const openFitToBed = useKuraStore((s) => s.openFitToBed);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const isBusy = Boolean(busyOperation);
  const blocked = isBusy || primary.locked;

  const dialogButton = (label: TranslationKey, icon: React.ReactNode, onClick: () => void, disabled: boolean, extra?: { tip?: TranslationKey; keys?: string }) => (
    <button
      type="button"
      className="kura-btn kura-btn-sm"
      disabled={disabled}
      title={t(language, extra?.tip ?? label)}
      aria-keyshortcuts={extra?.keys}
      onClick={onClick}
    >
      {icon}
      <span>{t(language, label)}</span>
    </button>
  );

  return (
    <>
      <section className="kura-card" aria-labelledby="kura-ctx-ops-title">
        <h3 className="kura-section-label" id="kura-ctx-ops-title">{t(language, 'inspector.section.operations')}</h3>
        <p className="kura-ctx-hint">{t(language, 'panel.object.toolsHint')}</p>
        <div className="kura-ctx-ops-grid">
          {PANEL_BUTTONS.map(({ id, icon }) => {
            const availability = actionAvailability({ objects, selectedIds, groups, busyOperation }, id);
            const name = t(language, `rediseno.action.${id}` as TranslationKey);
            const reason = availability.reason ? t(language, 'rediseno.reason.disabled', { reason: t(language, availability.reason) }) : undefined;
            return (
              <button
                key={id}
                type="button"
                className="kura-btn kura-btn-sm"
                data-panel-action={id}
                disabled={!availability.enabled}
                title={reason ?? name}
                onClick={() => openActionPanel(id)}
              >
                {icon}
                <span>{name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="kura-card">
        <h3 className="kura-section-label">{t(language, 'inspector.op.cutAndSplitTitle')}</h3>
        <div className="kura-ctx-ops-grid">
          {dialogButton('inspector.op.planeCut', <Scissors size={13} aria-hidden="true" />, () => setActiveDialog('cut'), blocked, { keys: 'C' })}
          {dialogButton('split.open', <Grid3x3 size={13} aria-hidden="true" />, () => setActiveDialog('splitForBed'), blocked, { tip: 'split.openTip', keys: 'Shift+C' })}
          {dialogButton('fit.open', <Minimize2 size={13} aria-hidden="true" />, () => void openFitToBed([primary.id]), blocked, { tip: 'fit.openTip' })}
          {dialogButton('inspector.op.splitParts', <Split size={13} aria-hidden="true" />, () => void splitDisconnectedObject(primary.id), blocked)}
        </div>
        <ColorSplitControl primary={primary} />
      </section>

      <section className="kura-card">
        <h3 className="kura-section-label">{t(language, 'inspector.pro.title')}</h3>
        <div className="kura-ctx-ops-grid">
          {dialogButton('inspector.pro.mold', <PaintBucket size={13} aria-hidden="true" />, () => setActiveDialog('mold'), isBusy, { keys: 'Shift+M' })}
          {dialogButton('inspector.pro.project', <Type size={13} aria-hidden="true" />, () => setActiveDialog('project'), blocked)}
          {dialogButton('inspector.pro.thread', <Bolt size={13} aria-hidden="true" />, () => setActiveDialog('thread'), isBusy)}
        </div>
      </section>
    </>
  );
};
