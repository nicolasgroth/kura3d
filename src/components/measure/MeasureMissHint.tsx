/**
 * @file src/components/measure/MeasureMissHint.tsx
 * @description Con Medir activo, un clic (sin arrastrar) sobre el vacío o el suelo muestra una pista
 * breve junto al cursor: "Toca un punto de la pieza". Es una sola pista que se reemplaza (no apila
 * avisos) y se anuncia por una región `status`. Vive dentro del lienzo 3D y crea su elemento DOM.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import { measureHitFor } from './measurePointer';
import '../../styles/realesUi.css';

const HINT_MS = 1600;
const CLICK_SLOP_PX = 5;

export const MeasureMissHint: React.FC = () => {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const host = canvas.parentElement ?? document.body;
    const hint = document.createElement('div');
    hint.className = 'kura-measure-miss-hint';
    hint.setAttribute('role', 'status');
    hint.setAttribute('data-testid', 'measure-miss-hint');
    hint.hidden = true;
    host.appendChild(hint);
    let down: { x: number; y: number; event: PointerEvent } | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Si el clic tocó una pieza se sabe al soltar (el visor ya procesó ese `pointerdown`).
    const onDown = (e: PointerEvent) => {
      down = e.button === 0 ? { x: e.clientX, y: e.clientY, event: e } : null;
    };
    const onUp = (e: PointerEvent) => {
      const start = down;
      down = null;
      if (!start || measureHitFor(start.event) || Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return;
      const rect = host.getBoundingClientRect();
      hint.textContent = t(useKuraStore.getState().language, 'realesUi.measure.hint');
      hint.style.left = `${e.clientX - rect.left + 14}px`;
      hint.style.top = `${e.clientY - rect.top + 14}px`;
      hint.hidden = false;
      clearTimeout(timer);
      timer = setTimeout(() => { hint.hidden = true; }, HINT_MS);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      clearTimeout(timer);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      hint.remove();
    };
  }, [gl]);

  return null;
};
