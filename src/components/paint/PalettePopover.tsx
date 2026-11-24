/**
 * @file src/components/paint/PalettePopover.tsx
 * @description Ventana flotante no modal de la paleta de pintura (editar una muestra u opciones de la paleta):
 * toma el foco al abrirse, se cierra con Esc, con «Cerrar» o con un clic fuera y devuelve el foco al control que
 * la abrió.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';

const FOCUSABLE = 'input:not([disabled]), select:not([disabled]), button:not([disabled])';

export const PalettePopover: React.FC<{
  label: string;
  /** Control que la abrió: recibe el foco al cerrar. */
  opener: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ label, opener, onClose, children }) => {
  const language = useKuraStore((s) => s.language);
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && (ref.current?.contains(target) || opener?.contains(target))) return;
      closeRef.current();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [opener]);

  const close = () => {
    onClose();
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return;
    // Esc cierra solo esta ventana (no sale de la herramienta ni del panel).
    e.preventDefault();
    e.stopPropagation();
    close();
  };

  return (
    <div ref={ref} className="kura-palette-popover" role="dialog" aria-label={label} onKeyDown={onKeyDown}>
      <div className="kura-palette-popover-head">
        <strong>{label}</strong>
        <button
          type="button"
          className="kura-btn kura-btn-sm kura-btn-icon"
          aria-label={t(language, 'rediseno3b.palette.close')}
          title={t(language, 'rediseno3b.palette.close')}
          onClick={close}
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  );
};
