/**
 * @file src/components/paint/PaintPalette.tsx
 * @description Muestras de color de Pintar, personalizables: clic elige el color; clic derecho, Mayús+F10 o la
 * tecla Menú sobre una muestra abre su edición (cambiar el color con el selector o quitarla); «+» agrega el color
 * actual del pincel y «…» abre las opciones (paletas predefinidas, colores del proyecto, volver a la original).
 * Cada muestra se nombra por su color (`colorName`) y marca la elegida con `aria-pressed` y un anillo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { t, type TranslationKey } from '../../i18n';
import {
  addColor,
  applyPreset,
  canAddColor,
  DEFAULT_PALETTE,
  fromProjectColors,
  PALETTE_MIN,
  PALETTE_PRESET_IDS,
  PALETTE_VISIBLE,
  projectPaintColors,
  removeColorAt,
  replaceColor,
  updatePaintPalette,
  usePaintPalette,
  type PalettePresetId,
} from '../../store/paintPalette';
import { useKuraStore } from '../../store/useKuraStore';
import { colorName, colorNameWithHex } from '../../utils/colorNames';
import { choosePaintColor, usePaintEraser } from './paintEraser';
import { PalettePopover } from './PalettePopover';
import '../../styles/paintPalette.css';
import '../../styles/ux8Paint.css';

/** Luminancia relativa aproximada: las muestras claras llevan borde para verse sobre fondos claros. */
export function isLightColor(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 186;
}

type Open = { kind: 'swatch'; index: number; opener: HTMLElement } | { kind: 'options'; opener: HTMLElement } | null;

export const PaintPalette: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const paintColor = useKuraStore((s) => s.paintColor);
  const objects = useKuraStore((s) => s.objects);
  const eraser = usePaintEraser((s) => s.eraser);
  const colors = usePaintPalette((s) => s.colors);
  const preset = usePaintPalette((s) => s.preset);
  const [open, setOpen] = useState<Open>(null);
  // Muchas muestras (p. ej. los colores de un proyecto multicolor): se dibujan las primeras y el resto a pedido.
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = Math.max(0, colors.length - PALETTE_VISIBLE);
  const presetFieldId = useId();
  // Recorre todas las caras: solo con las opciones abiertas, no en cada trazo.
  const optionsOpen = open?.kind === 'options';
  const projectColors = useMemo(() => (optionsOpen ? projectPaintColors(objects) : []), [objects, optionsOpen]);
  const current = paintColor.toLowerCase();
  const addable = canAddColor({ preset, colors }, current);
  const isOriginal = preset === 'original' && colors.join() === DEFAULT_PALETTE.colors.join();

  const openEditor = (index: number, opener: HTMLElement) => setOpen({ kind: 'swatch', index, opener });

  const onSwatchKey = (index: number) => (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
      e.preventDefault();
      e.stopPropagation();
      openEditor(index, e.currentTarget);
    }
  };

  const changeSwatch = (index: number, hex: string) => {
    const before = colors[index];
    updatePaintPalette((s) => replaceColor(s, index, hex));
    // Si era el color del pincel, el pincel sigue a la muestra.
    if (before === current && usePaintPalette.getState().colors[index] !== before) choosePaintColor(usePaintPalette.getState().colors[index]);
  };

  const removeSwatch = (index: number) => {
    updatePaintPalette((s) => removeColorAt(s, index));
    setOpen(null);
  };

  const editing = open?.kind === 'swatch' ? colors[open.index] : null;

  return (
    <div className="kura-paint-palette">
      <div className={`kura-swatch-row ${expanded ? 'is-expanded' : ''}`} role="group" aria-label={t(language, 'viewport.paint.color')}>
        {(expanded ? colors : colors.slice(0, PALETTE_VISIBLE)).map((hex, index) => {
          const active = !eraser && current === hex;
          return (
            <button
              key={hex}
              type="button"
              className={`kura-swatch ${active ? 'is-active' : ''} ${isLightColor(hex) ? 'is-light' : ''}`}
              style={{ backgroundColor: hex }}
              onClick={() => choosePaintColor(hex)}
              onContextMenu={(e) => {
                e.preventDefault();
                openEditor(index, e.currentTarget);
              }}
              onKeyDown={onSwatchKey(index)}
              aria-label={colorName(language, hex)}
              aria-pressed={active}
              aria-haspopup="dialog"
              aria-keyshortcuts="Shift+F10"
              title={`${colorNameWithHex(language, hex)} — ${t(language, 'rediseno3b.palette.editHint')}`}
              data-swatch={hex}
            />
          );
        })}
        {hiddenCount > 0 && (
          <button
            type="button"
            className="kura-btn kura-btn-sm kura-palette-toggle"
            aria-expanded={expanded}
            title={t(language, expanded ? 'rediseno3b.palette.less' : 'rediseno3b.palette.more', { count: hiddenCount })}
            onClick={() => setExpanded((v) => !v)}
          >
            {t(language, expanded ? 'rediseno3b.palette.less' : 'rediseno3b.palette.more', { count: hiddenCount })}
          </button>
        )}
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-palette-add"
          aria-disabled={addable ? undefined : true}
          aria-label={t(language, 'rediseno3b.palette.add')}
          title={addable ? t(language, 'rediseno3b.palette.add') : t(language, 'rediseno3b.palette.addOff')}
          onClick={() => {
            if (addable) updatePaintPalette((s) => addColor(s, current));
          }}
        >
          <Plus size={13} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-palette-more"
          aria-label={t(language, 'rediseno3b.palette.options')}
          title={t(language, 'rediseno3b.palette.options')}
          aria-haspopup="dialog"
          aria-expanded={open?.kind === 'options'}
          onClick={(e) => setOpen(open?.kind === 'options' ? null : { kind: 'options', opener: e.currentTarget })}
        >
          <MoreHorizontal size={13} aria-hidden="true" />
        </button>
      </div>

      {open?.kind === 'swatch' && editing && (
        <PalettePopover
          label={t(language, 'rediseno3b.palette.editTitle', { name: colorName(language, editing) })}
          opener={open.opener}
          onClose={() => setOpen(null)}
        >
          <label className="kura-palette-field">
            <span>{t(language, 'rediseno3b.palette.change')}</span>
            <input
              type="color"
              value={editing}
              onChange={(e) => changeSwatch(open.index, e.target.value)}
              aria-label={t(language, 'rediseno3b.palette.change')}
              title={t(language, 'rediseno3b.palette.change')}
            />
            <code>{editing.toUpperCase()}</code>
          </label>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={colors.length <= PALETTE_MIN}
            title={colors.length <= PALETTE_MIN ? t(language, 'rediseno3b.palette.removeOff') : t(language, 'rediseno3b.palette.remove')}
            onClick={() => removeSwatch(open.index)}
          >
            <Trash2 size={13} aria-hidden="true" />
            <span>{t(language, 'rediseno3b.palette.remove')}</span>
          </button>
        </PalettePopover>
      )}

      {open?.kind === 'options' && (
        <PalettePopover label={t(language, 'rediseno3b.palette.options')} opener={open.opener} onClose={() => setOpen(null)}>
          <label className="kura-palette-field" htmlFor={presetFieldId}>
            <span>{t(language, 'rediseno3b.palette.preset')}</span>
          </label>
          <select
            id={presetFieldId}
            className="kura-select"
            value={preset}
            onChange={(e) => updatePaintPalette(() => applyPreset(e.target.value as PalettePresetId))}
            title={t(language, 'rediseno3b.palette.preset')}
          >
            {PALETTE_PRESET_IDS.map((id) => (
              <option key={id} value={id}>{t(language, `rediseno3b.palette.preset.${id}` as TranslationKey)}</option>
            ))}
            {preset === 'custom' && <option value="custom" disabled>{t(language, 'rediseno3b.palette.preset.custom')}</option>}
          </select>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={projectColors.length === 0}
            title={projectColors.length === 0 ? t(language, 'rediseno3b.palette.projectOff') : t(language, 'rediseno3b.palette.projectTip', { count: projectColors.length })}
            onClick={() => updatePaintPalette((s) => fromProjectColors(s, useKuraStore.getState().objects))}
          >
            {t(language, 'rediseno3b.palette.project')}
          </button>
          <button
            type="button"
            className="kura-btn kura-btn-sm"
            disabled={isOriginal}
            title={t(language, 'rediseno3b.palette.reset')}
            onClick={() => updatePaintPalette(() => applyPreset('original'))}
          >
            {t(language, 'rediseno3b.palette.reset')}
          </button>
        </PalettePopover>
      )}
    </div>
  );
};
