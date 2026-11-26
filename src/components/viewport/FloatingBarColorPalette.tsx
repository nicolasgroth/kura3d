/**
 * @file src/components/viewport/FloatingBarColorPalette.tsx
 * @description Paleta de color de la barra flotante: las mismas muestras del inspector (`PRINT_COLOR_PALETTE`, con sus
 * nombres) y, como última opción, «Otro color…» que abre el selector libre del navegador. Cada muestra lleva nombre
 * accesible, tooltip y estado pulsado (marca visible, no solo color).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React, { useEffect, useRef } from 'react';
import { Pipette } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { PRINT_COLOR_PALETTE } from '../../types/kura';
import { colorName, colorNameWithHex } from '../../utils/colorNames';

interface Props {
  /** Color base actual de la pieza principal (marca la muestra igual). */
  current: string | null;
  onPick: (hex: string) => void;
  onCustom: () => void;
}

export const FloatingBarColorPalette: React.FC<Props> = ({ current, onPick, onCustom }) => {
  const language = useKuraStore((s) => s.language);
  const ref = useRef<HTMLDivElement | null>(null);
  // Al abrirse, el foco pasa a la muestra activa (o a la primera).
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('.is-active, button')?.focus();
  }, []);
  return (
    <div ref={ref} className="kura-floating-bar-palette" role="group" aria-label={t(language, 'inspector.field.color')} data-testid="floating-bar-palette">
      {PRINT_COLOR_PALETTE.map((hex) => {
        const active = current?.toLowerCase() === hex.toLowerCase();
        return (
          <button
            key={hex}
            type="button"
            className={`kura-swatch kura-floating-bar-swatch${active ? ' is-active' : ''}`}
            style={{ backgroundColor: hex }}
            aria-label={colorName(language, hex)}
            aria-pressed={active}
            title={colorNameWithHex(language, hex)}
            onClick={() => onPick(hex)}
          />
        );
      })}
      <button
        type="button"
        className="kura-floating-bar-custom"
        aria-label={t(language, 'floatingBar.color.custom')}
        title={t(language, 'floatingBar.color.custom.tip')}
        onClick={onCustom}
      >
        <Pipette size={14} aria-hidden="true" />
        <span>{t(language, 'floatingBar.color.custom')}</span>
      </button>
    </div>
  );
};
