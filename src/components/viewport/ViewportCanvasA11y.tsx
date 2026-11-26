/**
 * @file src/components/viewport/ViewportCanvasA11y.tsx
 * @description Hace el lienzo del visor enfocable por teclado (Tab): `tabindex=0`, rol de
 * aplicación y nombre accesible con la ayuda de teclas. Con el foco en el visor siguen valiendo los
 * atajos globales y las flechas que mueven el plano elegido. El contorno de foco vive en
 * `styles/viewportFocus.css`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import '../../styles/viewportFocus.css';

export function ViewportCanvasA11y(): null {
  const gl = useThree((s) => s.gl);
  const language = useKuraStore((s) => s.language);
  // Las flechas mueven un plano solo con Cortar o Dividir a la vista; en otro caso el nombre no habla de planos.
  const planes = useKuraStore((s) => s.activeTool === 'cut' || s.activeDialog === 'cut' || s.activeDialog === 'splitForBed');
  useEffect(() => {
    const el = gl.domElement;
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-label', t(language, planes ? 'viewport.canvasLabel' : 'viewport.canvasLabelBase'));
    el.setAttribute('aria-roledescription', t(language, 'viewport.canvasRole'));
    el.classList.add('kura-viewport-canvas');
  }, [gl, language, planes]);
  return null;
}
