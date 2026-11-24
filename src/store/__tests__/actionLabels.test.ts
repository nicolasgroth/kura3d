/**
 * @file src/store/__tests__/actionLabels.test.ts
 * @description Un comando se llama igual en todas partes: el nombre canónico (`rediseno.action.*`) existe para cada
 * acción del catálogo en los 6 idiomas, los rótulos alternos conocidos (`ACTION_ALIAS_KEYS`) dicen lo mismo, los
 * menús (Acciones, contextual) y la paleta de comandos usan `actionName` y nadie vuelve a rotular una acción con
 * una clave propia (guardia estática sobre el código fuente).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { describe, expect, it } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../../types/kura';
import { t, type TranslationKey } from '../../i18n';
import { ACTION_GROUPS, type ActionId } from '../actionsCatalog';
import { ACTION_ALIAS_KEYS, actionLabelKey, actionName } from '../actionLabels';

const LANGUAGES = SUPPORTED_LANGUAGES.map((l) => l.code);
const ALL_ACTIONS = ACTION_GROUPS.flatMap((g) => [...g.items]) as ActionId[];

/** La elipsis final solo marca que la acción abre un diálogo; no es parte del nombre. */
const bare = (s: string) => s.replace(/(…|\.\.\.)\s*$/, '').trim();

describe('nombre único por comando', () => {
  it('toda acción del catálogo tiene su nombre canónico en los 6 idiomas', () => {
    for (const lang of LANGUAGES) {
      for (const id of ALL_ACTIONS) {
        const name = actionName(lang, id);
        expect(name, `${lang}/${id}`).not.toBe(actionLabelKey(id));
        expect(name.trim().length, `${lang}/${id}`).toBeGreaterThan(0);
      }
    }
  });

  it('los rótulos alternos de un comando dicen lo mismo que su nombre canónico', () => {
    const mismatches: string[] = [];
    for (const [id, keys] of Object.entries(ACTION_ALIAS_KEYS) as [ActionId, readonly TranslationKey[]][]) {
      for (const lang of LANGUAGES) {
        for (const key of keys) {
          if (bare(t(lang, key)) !== bare(actionName(lang, id))) mismatches.push(`${lang} ${id}: «${t(lang, key)}» (${key}) ≠ «${actionName(lang, id)}»`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('el código no rotula una acción con una clave propia fuera de la fuente única', () => {
    const sources = import.meta.glob('../../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const code = Object.entries(sources)
      .filter(([path]) => !/\.test\.(ts|tsx)$/.test(path) && !path.includes('/__tests__/') && !path.includes('/i18n/'))
      .map(([path, text]) => ({ path, text }));
    // Claves que antes rotulaban el mismo comando con otro texto (menú contextual y paleta): ya no existen.
    const retired = [
      'ctx.hollowOpen', 'ctx.generateMold', 'ctx.projectSurface', 'ctx.unionSelection', 'ctx.applyHoles', 'ctx.dropToBed',
      'ctx.validatePrint', 'ctx.detectStructures', 'cmd.pro.mold', 'cmd.pro.project', 'cmd.pro.validate', 'cmd.pro.detectStructures',
      'cmd.pro.simplify', 'cmd.pro.refine', 'cmd.pro.hull', 'cmd.repairMesh', 'groups.action.separate',
    ];
    const offenders: string[] = [];
    for (const key of retired) for (const { path, text } of code) if (text.includes(`'${key}'`)) offenders.push(`${path}: ${key}`);
    expect(offenders).toEqual([]);
  });
});
