/**
 * @file src/components/split/SplitSection.tsx
 * @description Sección plegable del panel Dividir (Cama y cortes · Uniones · Marcas · Avanzado). Usa `<details>`:
 * el título es un `summary` operable con teclado, con foco visible y estado expandido/plegado anunciado.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import '../../styles/splitSection.css';

export const SplitSection: React.FC<{
  title: string;
  /** Texto breve bajo el título cuando está plegada (resumen o ayuda). */
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, hint, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <details
      className="kura-split-section"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      data-testid="split-section"
    >
      <summary className="kura-split-section-summary" aria-describedby={hint ? `${id}-hint` : undefined}>
        <ChevronRight size={14} aria-hidden="true" className="kura-split-section-chevron" />
        <span>{title}</span>
      </summary>
      {hint && !open && <small id={`${id}-hint`} className="kura-cut-hint kura-split-section-hint">{hint}</small>}
      <div role="group" aria-label={title} className="kura-split-section-body">
        {children}
      </div>
    </details>
  );
};
