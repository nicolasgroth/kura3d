/**
 * @file src/components/scene/SceneColorSwatch.tsx
 * @description Muestra del color de un objeto en su fila del árbol de la escena, junto al icono de tipo: un
 * cuadradito de un color; partido en dos si el objeto está pintado con dos; hasta 3 puntitos y «+N» con más.
 * Es decorativa: el color se anuncia en texto accesible con su nombre («Color: Rojo»), no solo con color.
 * Los colores distintos de una malla pintada se calculan una vez por arreglo de colores (caché débil).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import React from 'react';
import { t } from '../../i18n';
import type { LanguageCode, SceneObject } from '../../types/kura';
import { colorName } from '../../utils/colorNames';
import '../../styles/sceneTreeSwatch.css';

const MAX_DOTS = 3;
const distinctCache = new WeakMap<readonly string[], string[]>();

/** Colores distintos del objeto: los de sus caras pintadas o, sin pintura, su color base. */
export function objectColors(obj: SceneObject): string[] {
  const faces = obj.mesh.faceColors;
  if (!faces || faces.length === 0) return [obj.color.toLowerCase()];
  let distinct = distinctCache.get(faces);
  if (!distinct) {
    distinct = Array.from(new Set(faces.map((c) => c.toLowerCase())));
    distinctCache.set(faces, distinct);
  }
  return distinct;
}

/**
 * `part`: «visual» pinta solo la muestra (decorativa) y «spoken» solo el texto accesible. La fila del árbol los
 * separa para que el nombre accesible empiece por el rótulo de la pieza y el color se anuncie después.
 */
export const SceneColorSwatch: React.FC<{ obj: SceneObject; language: LanguageCode; part?: 'both' | 'visual' | 'spoken' }> = ({ obj, language, part = 'both' }) => {
  const colors = objectColors(obj);
  const names = colors.slice(0, MAX_DOTS).map((hex) => colorName(language, hex));
  const extra = colors.length - MAX_DOTS;
  const spoken = colors.length === 1
    ? t(language, 'r3a.swatch.one', { name: names[0] })
    : t(language, 'r3a.swatch.many', { names: [...names, ...(extra > 0 ? [t(language, 'r3a.swatch.more', { count: extra })] : [])].join(', ') });

  let visual: React.ReactNode;
  if (colors.length <= 2) {
    const background = colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)`;
    visual = <span className="kura-tree-swatch" style={{ background }} />;
  } else {
    visual = (
      <span className="kura-tree-swatch-dots">
        {colors.slice(0, MAX_DOTS).map((hex) => (
          <span key={hex} className="kura-tree-swatch-dot" style={{ background: hex }} />
        ))}
        {extra > 0 && <span className="kura-tree-swatch-more">{t(language, 'r3a.swatch.more', { count: extra })}</span>}
      </span>
    );
  }

  return (
    <>
      {part !== 'spoken' && <span className="kura-tree-swatch-wrap" aria-hidden="true" title={spoken}>{visual}</span>}
      {part !== 'visual' && <span className="sr-only">, {spoken}</span>}
    </>
  );
};
