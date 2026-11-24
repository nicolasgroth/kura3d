/**
 * @file src/components/contextPanel/ObjectOperations.tsx
 * @description Accesos del resumen de un objeto, compactos: cada sección es una fila de botones con icono (nombre
 * accesible, tooltip y, si está apagado, el motivo). Las acciones con opciones (Ahuecar, Simplificar / Refinar,
 * Textura, Módulos, Revisar, Detectar) abren solo sus opciones en el panel; Cortar, Dividir, Ajustar a la
 * impresora, Molde, Proyectar y Rosca abren su panel de operación; separar piezas y separar por colores
 * (profundidad por defecto) se ejecutan directo; el ▾ de separar por colores despliega su profundidad. Donde hay variantes, un pequeño desplegable (▾) las muestra.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useState } from 'react';
import { Bolt, Box, ChevronDown, Grid3x3, Minimize2, PaintBucket, Palette, Puzzle, ScanSearch, Scissors, ShieldCheck, Sparkles, Split, Type, Waves } from 'lucide-react';
import { OPERATION_DEFAULTS } from '../../engine/operationLimits';
import { t, type TranslationKey } from '../../i18n';
import { actionAvailability, type ActionId } from '../../store/actionsCatalog';
import { useKuraStore } from '../../store/useKuraStore';
import type { SceneObject } from '../../types/kura';
import { ColorSplitControl } from '../inspector/ColorSplitControl';
import { openActionPanel } from '../shell/actionRunners';
import { PanelFold } from './PanelFold';

const ICON = 15;

const PANEL_BUTTONS: ReadonlyArray<{ id: ActionId; icon: React.ReactNode; variants?: ActionId[] }> = [
  { id: 'hollow', icon: <Box size={ICON} aria-hidden="true" /> },
  { id: 'simplify', icon: <Sparkles size={ICON} aria-hidden="true" />, variants: ['simplify', 'refine'] },
  { id: 'texture', icon: <Waves size={ICON} aria-hidden="true" /> },
  { id: 'modules', icon: <Puzzle size={ICON} aria-hidden="true" /> },
  { id: 'validate', icon: <ShieldCheck size={ICON} aria-hidden="true" /> },
  { id: 'detect', icon: <ScanSearch size={ICON} aria-hidden="true" /> },
];

/** Botón de icono: nombre accesible, tooltip y apagado con `aria-disabled` (conserva foco y tooltip). */
const IconOp: React.FC<{
  name: string;
  icon: React.ReactNode;
  onClick: () => void;
  reason?: string;
  keys?: string;
  /** Qué hace, además del nombre. */
  tip?: string;
  extra?: Record<string, string>;
}> = ({ name, icon, onClick, reason, keys, tip, extra }) => (
  <button
    type="button"
    className={`kura-btn kura-btn-sm kura-btn-icon kura-op-icon${reason ? ' is-unavailable' : ''}`}
    aria-label={name}
    aria-disabled={reason ? true : undefined}
    aria-keyshortcuts={keys}
    title={reason ? `${name} — ${reason}` : `${name}${keys ? ` (${keys})` : ''}${tip ? ` — ${tip}` : ''}`}
    onClick={() => {
      if (!reason) onClick();
    }}
    {...extra}
  >
    {icon}
  </button>
);

export const ObjectOperations: React.FC<{ primary: SceneObject }> = ({ primary }) => {
  const language = useKuraStore((s) => s.language);
  const objects = useKuraStore((s) => s.objects);
  const selectedIds = useKuraStore((s) => s.selectedIds);
  const groups = useKuraStore((s) => s.groups);
  const busyOperation = useKuraStore((s) => s.busyOperation);
  const setActiveDialog = useKuraStore((s) => s.setActiveDialog);
  const openFitToBed = useKuraStore((s) => s.openFitToBed);
  const splitDisconnectedObject = useKuraStore((s) => s.splitDisconnectedObject);
  const splitObjectByColor = useKuraStore((s) => s.splitObjectByColor);
  const [variantsOf, setVariantsOf] = useState<ActionId | null>(null);
  const [colorSplitOpen, setColorSplitOpen] = useState(false);
  const isBusy = Boolean(busyOperation);
  const blockedReason = isBusy
    ? t(language, 'rediseno.reason.busy')
    : primary.locked
      ? t(language, 'rediseno.reason.locked')
      : undefined;
  const busyReason = isBusy ? t(language, 'rediseno.reason.busy') : undefined;

  const actionReason = (id: ActionId) => {
    const availability = actionAvailability({ objects, selectedIds, groups, busyOperation }, id);
    return availability.reason ? t(language, availability.reason) : undefined;
  };
  const actionName = (id: ActionId) => t(language, `rediseno.action.${id}` as TranslationKey);
  const dialogOp = (label: TranslationKey, icon: React.ReactNode, onClick: () => void, reason: string | undefined, keys?: string) => (
    <IconOp name={t(language, label)} icon={icon} onClick={onClick} reason={reason} keys={keys} />
  );

  return (
    <>
      <PanelFold id="ops" title="inspector.section.operations">
        <section className="kura-card" aria-labelledby="kura-ctx-ops-title">
          <h3 className="kura-section-label" id="kura-ctx-ops-title">{t(language, 'inspector.section.operations')}</h3>
          <p className="kura-ctx-hint">{t(language, 'panel.object.toolsHint')}</p>
          <div className="kura-ctx-ops-row" role="group" aria-labelledby="kura-ctx-ops-title">
            {PANEL_BUTTONS.map(({ id, icon, variants }) => (
              <span key={id} className="kura-op-cell">
                <IconOp name={actionName(id)} icon={icon} reason={actionReason(id)} onClick={() => openActionPanel(id)} extra={{ 'data-panel-action': id }} />
                {variants && (
                  <button
                    type="button"
                    className="kura-btn kura-btn-sm kura-op-variant"
                    aria-expanded={variantsOf === id}
                    aria-label={t(language, 'rediseno3b.ops.moreVariants')}
                    title={t(language, 'rediseno3b.ops.variants', { name: actionName(id) })}
                    onClick={() => setVariantsOf(variantsOf === id ? null : id)}
                  >
                    <ChevronDown size={11} aria-hidden="true" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {variantsOf && (
            <div className="kura-op-variants" role="group" aria-label={t(language, 'rediseno3b.ops.variants', { name: actionName(variantsOf) })}>
              {PANEL_BUTTONS.find((b) => b.id === variantsOf)?.variants?.map((v) => {
                const reason = actionReason(v);
                return (
                  <button
                    key={v}
                    type="button"
                    className="kura-btn kura-btn-sm"
                    data-panel-action={v}
                    aria-disabled={reason ? true : undefined}
                    title={reason ?? actionName(v)}
                    onClick={() => {
                      if (!reason) openActionPanel(v);
                    }}
                  >
                    {actionName(v)}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </PanelFold>

      <PanelFold id="cut" title="inspector.op.cutAndSplitTitle">
        <section className="kura-card" aria-labelledby="kura-ctx-cut-title">
          <h3 className="kura-section-label" id="kura-ctx-cut-title">{t(language, 'inspector.op.cutAndSplitTitle')}</h3>
          <div className="kura-ctx-ops-row" role="group" aria-labelledby="kura-ctx-cut-title">
            {dialogOp('inspector.op.planeCut', <Scissors size={ICON} aria-hidden="true" />, () => setActiveDialog('cut'), blockedReason, 'C')}
            <IconOp
              name={t(language, 'split.open')}
              icon={<Grid3x3 size={ICON} aria-hidden="true" />}
              reason={blockedReason}
              keys="Shift+C"
              tip={t(language, 'split.openTip')}
              onClick={() => setActiveDialog('splitForBed')}
            />
            <IconOp name={t(language, 'fit.open')} tip={t(language, 'fit.openTip')} icon={<Minimize2 size={ICON} aria-hidden="true" />} reason={blockedReason} onClick={() => void openFitToBed([primary.id])} />
            {dialogOp('inspector.op.splitParts', <Split size={ICON} aria-hidden="true" />, () => void splitDisconnectedObject(primary.id), blockedReason)}
            <span className="kura-op-cell">
              {/* Un clic separa con la profundidad por defecto; ▾ muestra la profundidad para elegirla. */}
              <IconOp
                name={t(language, 'inspector.op.splitColors')}
                tip={t(language, 'inspector.op.colorDepthTip')}
                icon={<Palette size={ICON} aria-hidden="true" />}
                reason={blockedReason}
                onClick={() => void splitObjectByColor(primary.id, { depthMm: OPERATION_DEFAULTS.colorSplit.depthMm })}
              />
              <button
                type="button"
                className="kura-btn kura-btn-sm kura-op-variant"
                aria-expanded={colorSplitOpen}
                aria-label={t(language, 'rediseno3b.ops.chooseDepth')}
                title={t(language, 'rediseno3b.ops.variants', { name: t(language, 'inspector.op.splitColors') })}
                onClick={() => setColorSplitOpen((v) => !v)}
              >
                <ChevronDown size={11} aria-hidden="true" />
              </button>
            </span>
          </div>
          {colorSplitOpen && (
            <div className="kura-op-variants">
              <ColorSplitControl primary={primary} />
            </div>
          )}
        </section>
      </PanelFold>

      <PanelFold id="prep" title="inspector.pro.title">
        <section className="kura-card" aria-labelledby="kura-ctx-prep-title">
          <h3 className="kura-section-label" id="kura-ctx-prep-title">{t(language, 'inspector.pro.title')}</h3>
          <div className="kura-ctx-ops-row" role="group" aria-labelledby="kura-ctx-prep-title">
            {dialogOp('inspector.pro.mold', <PaintBucket size={ICON} aria-hidden="true" />, () => setActiveDialog('mold'), busyReason, 'Shift+M')}
            {dialogOp('inspector.pro.project', <Type size={ICON} aria-hidden="true" />, () => setActiveDialog('project'), blockedReason)}
            {dialogOp('inspector.pro.thread', <Bolt size={ICON} aria-hidden="true" />, () => setActiveDialog('thread'), busyReason)}
          </div>
        </section>
      </PanelFold>
    </>
  );
};
