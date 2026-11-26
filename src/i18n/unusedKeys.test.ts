/**
 * @file src/i18n/unusedKeys.test.ts
 * @description Lista las claves de i18n que ningún archivo de `src/**` referencia (ni por su nombre completo ni por un
 * prefijo construido con `${…}` o con `+`) y falla si aparece alguna: una clave huérfana sobra en los 6 idiomas. Las
 * únicas excepciones son claves que ninguna pantalla cita pero que usan las pruebas como muestra (lista corta y
 * justificada).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import { TRANSLATIONS_ES } from './translations';

/** Claves sin referencia en las pantallas, conservadas a propósito (motivo por clave). */
const KEY_EXCEPTIONS: Record<string, string> = {
  'split.warn.rotated': 'muestra de plural en línea de `inlinePlural.test.ts`',
  'splitJoints.note.weak': 'la lee `SplitPrefs.test.tsx` para comprobar el texto del refuerzo',
};

const SOURCES = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Texto de todo el código que usa claves: sin diccionarios (definen las claves) ni pruebas. */
function codeText(): string {
  return Object.entries(SOURCES)
    .filter(([path]) => !/\.test\.(ts|tsx)$/.test(path) && !path.includes('/__tests__/'))
    .filter(([path]) => !path.startsWith('../i18n/locales/') && path !== '../i18n/translations.ts')
    .map(([, text]) => text)
    .join('\n');
}

describe('claves de i18n sin uso', () => {
  it('toda clave del diccionario se referencia en el código (o está en la lista de excepciones)', () => {
    const text = codeText();
    // Prefijos dinámicos: `mold.part.${x}`, 'split.joint.' + x.
    const prefixes = new Set<string>();
    for (const m of text.matchAll(/[`'"]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\.)(?:\$\{|['"`]\s*\+)/g)) prefixes.add(m[1]);
    const quoted = (key: string) => text.includes(`'${key}'`) || text.includes(`"${key}"`) || text.includes(`\`${key}\``);
    const unused = Object.keys(TRANSLATIONS_ES).filter((key) => {
      if (key in KEY_EXCEPTIONS || quoted(key)) return false;
      for (const p of prefixes) if (key.startsWith(p)) return false;
      // Plurales armados como `${base}.one` / `${base}.other` (p. ej. `stepTip`): basta con que se cite la base.
      const base = key.replace(/\.(zero|one|two|few|many|other)$/, '');
      return !(base !== key && quoted(base));
    });
    expect(unused, `Claves huérfanas (bórralas en los 6 idiomas):\n${unused.join('\n')}`).toEqual([]);
  });

  it('las excepciones existen en el diccionario', () => {
    for (const key of Object.keys(KEY_EXCEPTIONS)) expect(key in TRANSLATIONS_ES).toBe(true);
  });
});
