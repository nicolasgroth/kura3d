/**
 * @file src/components/shell/ViewIcon.tsx
 * @description Icono de vista de cámara: un cubo en perspectiva con la cara mirada rellena (arriba, frente o
 * derecha; la isométrica rellena las tres en tonos). Se entiende sin texto y sigue el color del botón.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React from 'react';

type View = 'iso' | 'top' | 'front' | 'right';

// Caras del cubo en una caja de 20×20: arriba, frente (izquierda) y derecha.
const TOP = 'M10 2.5 17 6.2 10 9.9 3 6.2Z';
const FRONT = 'M3 6.2 10 9.9V17.5L3 13.8Z';
const RIGHT = 'M10 9.9 17 6.2V13.8L10 17.5Z';

export const ViewIcon: React.FC<{ view: View }> = ({ view }) => {
  const fill = (face: View) => (view === face ? 'currentColor' : 'none');
  return (
    <svg width={16} height={16} viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="kura-view-icon">
      <g stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
        <path d={TOP} fill={view === 'iso' ? 'currentColor' : fill('top')} fillOpacity={view === 'iso' ? 0.55 : 0.9} />
        <path d={FRONT} fill={view === 'iso' ? 'currentColor' : fill('front')} fillOpacity={view === 'iso' ? 0.25 : 0.9} />
        <path d={RIGHT} fill={view === 'iso' ? 'currentColor' : fill('right')} fillOpacity={view === 'iso' ? 0.8 : 0.9} />
      </g>
    </svg>
  );
};
