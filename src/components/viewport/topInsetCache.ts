/**
 * @file src/components/viewport/topInsetCache.ts
 * @description Inset superior de la barra flotante (distancia entre el borde superior del visor y la base de la
 * franja fija de la interfaz), cacheado: se remide solo cuando el observador o un `resize` lo invalidan. El hook
 * crea una sola caché por montaje (perezosa, en el efecto) y la libera al desmontar, con su listener `resize`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useEffect, useRef, type MutableRefObject } from 'react';

/** Distancia entre el borde superior del visor y la base de la franja fija de la interfaz (barra de vista). */
export function createTopInsetCache(
  query: (selector: string) => Element | null = (sel) => document.querySelector(sel),
  makeObserver: (cb: () => void) => { observe: (el: Element) => void; disconnect: () => void } | null = (cb) =>
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(cb),
) {
  let dirty = true;
  let value = 0;
  let hud: Element | null = null;
  let wrap: Element | null = null;
  const observer = makeObserver(() => {
    dirty = true;
  });
  const onWindowResize = () => {
    dirty = true;
  };
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindowResize);
  return {
    get(parent: Element | null): number {
      if (parent !== wrap || (hud && !hud.isConnected)) {
        observer?.disconnect();
        wrap = parent;
        hud = null;
        dirty = true;
      }
      if (!hud) {
        hud = query('.kura-hud-top-bar');
        if (hud) observer?.observe(hud);
        if (wrap) observer?.observe(wrap);
        dirty = true;
      }
      if (dirty) {
        value = hud && wrap ? Math.max(0, hud.getBoundingClientRect().bottom - wrap.getBoundingClientRect().top) : 0;
        // Sin franja aún en el DOM se vuelve a buscar en el siguiente cuadro; con ella se cachea.
        dirty = !hud;
      }
      return value;
    },
    dispose() {
      observer?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', onWindowResize);
    },
  };
}

export type TopInsetCache = ReturnType<typeof createTopInsetCache>;

/**
 * Caché del inset para un componente: se crea al montar (no en cada render, donde dejaría un listener `resize`
 * por caché descartada) y se libera al desmontar. `current` es null antes del primer efecto.
 */
export function useTopInsetCache(create: () => TopInsetCache = () => createTopInsetCache()): MutableRefObject<TopInsetCache | null> {
  const ref = useRef<TopInsetCache | null>(null);
  useEffect(() => {
    const cache = create();
    ref.current = cache;
    return () => {
      cache.dispose();
      if (ref.current === cache) ref.current = null;
    };
    // La fábrica solo se usa al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
