/**
 * @file src/utils/workTimer.ts
 * @description Contador sobrio del tiempo de trabajo del proyecto: suma segundos solo mientras la app está en primer
 * plano (pestaña visible y con foco) y hubo actividad (puntero, teclado, rueda o toque) en los últimos 2 minutos.
 * Sin telemetría: el total solo se guarda en el `.kura` (`info.workSeconds`) y en el borrador de recuperación.
 * El reloj es inyectable para probarlo sin esperar. `useWorkTimer` lo conecta al store y a los eventos del navegador.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { useKuraStore } from '../store/useKuraStore';

/** Sin actividad durante este tiempo, el reloj se detiene. */
export const WORK_IDLE_MS = 120_000;
/** Cada cuánto se revisa y se vuelca al store. */
export const WORK_TICK_MS = 15_000;
/** Un intervalo mayor que esto (equipo suspendido, pestaña congelada) no se cuenta entero. */
const MAX_GAP_MS = WORK_TICK_MS * 2;

export interface WorkTimerDeps {
  now: () => number;
  /** Pestaña visible y ventana con foco. */
  isForeground: () => boolean;
  /** Recibe segundos enteros nuevos. */
  onSeconds: (seconds: number) => void;
}

export interface WorkTimer {
  /** Marca actividad de la persona (puntero, teclado…). */
  activity: () => void;
  /** Suma el tiempo transcurrido desde la última revisión si corresponde. */
  tick: () => void;
}

export function createWorkTimer({ now, isForeground, onSeconds }: WorkTimerDeps): WorkTimer {
  let lastActivity = now();
  let lastTick = now();
  /** Fracción de segundo pendiente (el store solo recibe enteros). */
  let carryMs = 0;
  return {
    activity: () => { lastActivity = now(); },
    tick: () => {
      const current = now();
      // Cuenta el tramo desde la última revisión hasta la última actividad (nunca más allá del tope de inactividad).
      const gap = Math.min(Math.max(current - lastTick, 0), MAX_GAP_MS);
      lastTick = current;
      if (!isForeground() || current - lastActivity > WORK_IDLE_MS) return;
      carryMs += gap;
      const whole = Math.floor(carryMs / 1000);
      if (whole <= 0) return;
      carryMs -= whole * 1000;
      onSeconds(whole);
    },
  };
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

/** Conecta el contador a la app: eventos de actividad y un reloj cada `WORK_TICK_MS`. Úsalo una vez, en `App`. */
export function useWorkTimer(): void {
  useEffect(() => {
    const timer = createWorkTimer({
      now: Date.now,
      isForeground: () => document.visibilityState === 'visible' && document.hasFocus(),
      onSeconds: (seconds) => useKuraStore.getState().addProjectWorkSeconds(seconds),
    });
    // Los eventos solo marcan una hora: no hay trabajo por evento, ni se guarda qué se hizo.
    const mark = () => timer.activity();
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, mark, { passive: true });
    const interval = window.setInterval(timer.tick, WORK_TICK_MS);
    return () => {
      window.clearInterval(interval);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark);
    };
  }, []);
}
