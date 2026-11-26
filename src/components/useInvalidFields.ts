/**
 * @file src/components/useInvalidFields.ts
 * @description Campos numéricos con texto inválido o fuera de rango en un panel de operación: cada
 * `PrecisionNumberInput` con `strictRange` avisa por `onInvalidChange` y el panel deshabilita «Aplicar»
 * mientras haya alguno marcado (nada se acota en silencio).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { useCallback, useMemo, useState } from 'react';

export interface InvalidFields {
  /** `onInvalidChange` para el campo `key` (función estable por campo). */
  track: (key: string) => (invalid: boolean) => void;
  /** Hay al menos un campo marcado como inválido. */
  blocked: boolean;
}

export function useInvalidFields(): InvalidFields {
  const [fields, setFields] = useState<ReadonlySet<string>>(() => new Set());
  const cache = useMemo(() => new Map<string, (invalid: boolean) => void>(), []);
  const track = useCallback(
    (key: string) => {
      let fn = cache.get(key);
      if (!fn) {
        fn = (invalid: boolean) =>
          setFields((prev) => {
            if (prev.has(key) === invalid) return prev;
            const next = new Set(prev);
            if (invalid) next.add(key);
            else next.delete(key);
            return next;
          });
        cache.set(key, fn);
      }
      return fn;
    },
    [cache],
  );
  return { track, blocked: fields.size > 0 };
}
