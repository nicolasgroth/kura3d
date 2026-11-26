/**
 * @file src/i18n/locales/uxCierre.ts
 * @description Textos del cierre de usabilidad en los 6 idiomas: menú contextual de las filas de grupo del
 * árbol de Escena. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const UXCIERRE_TABLE = {
  'uxc.group.menuLabel': ['Menú del grupo {name}', 'Menu for group {name}', 'Menü der Gruppe {name}', 'Menu du groupe {name}', 'समूह {name} का मेनू', '组 {name} 的菜单'],
  'uxc.group.export': ['Exportar grupo…', 'Export group…', 'Gruppe exportieren …', 'Exporter le groupe…', 'समूह निर्यात करें…', '导出组…'],
  'uxc.group.export.tip': [
    'Abre la exportación con los objetos del grupo elegidos',
    'Opens the export dialog with the group’s objects selected',
    'Öffnet den Export mit den Objekten der Gruppe',
    'Ouvre l’export avec les objets du groupe sélectionnés',
    'समूह के ऑब्जेक्ट चुनकर निर्यात खोलता है',
    '以该组的对象打开导出对话框',
  ],
} as const satisfies Record<string, Row>;

type UxCierreKey = keyof typeof UXCIERRE_TABLE;

const pick = (index: number): Record<UxCierreKey, string> =>
  Object.fromEntries(Object.entries(UXCIERRE_TABLE).map(([key, row]) => [key, row[index]])) as Record<UxCierreKey, string>;

export const UXCIERRE_ES = pick(0);
export const UXCIERRE_EN = pick(1);
export const UXCIERRE_DE = pick(2);
export const UXCIERRE_FR = pick(3);
export const UXCIERRE_HI = pick(4);
export const UXCIERRE_ZH = pick(5);
