/**
 * @file src/i18n/locales/ux7.ts
 * @description Textos del lote ux7 en los 6 idiomas: acciones de avisos que no se pierden (historial con
 * botones y motivo si ya no aplican), enlace de unidades en el inspector, árbol de escena (ayuda «?»),
 * menú contextual con varios objetos, Medir › Capacidad, colores, exportar y recuperación. Cada clave se
 * escribe una vez con sus 6 idiomas; `UX7_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = { es: string; en: string; de: string; fr: string; hi: string; zh: string };

const UX7 = {
  // Acciones de avisos en el historial
  'ux7.toast.applied': { es: 'Ya se aplicó', en: 'Already applied', de: 'Bereits angewendet', fr: 'Déjà appliqué', hi: 'पहले ही लागू किया गया', zh: '已应用' },
  'ux7.toast.gone': { es: 'El objeto ya no existe', en: 'The object no longer exists', de: 'Das Objekt existiert nicht mehr', fr: 'L’objet n’existe plus', hi: 'वस्तु अब मौजूद नहीं है', zh: '对象已不存在' },
  'ux7.toast.stale': { es: 'Ya no aplica: la escena cambió', en: 'No longer applies: the scene changed', de: 'Gilt nicht mehr: Die Szene hat sich geändert', fr: 'Ne s’applique plus : la scène a changé', hi: 'अब लागू नहीं: दृश्य बदल गया', zh: '不再适用:场景已更改' },
} as const satisfies Record<string, Row>;

type Lang = keyof Row;
type Dict = { [K in keyof typeof UX7]: string };

function pick(lang: Lang): Dict {
  return Object.fromEntries(Object.entries(UX7).map(([key, row]) => [key, row[lang]])) as Dict;
}

export const UX7_ES = pick('es');
export const UX7_EN = pick('en');
export const UX7_DE = pick('de');
export const UX7_FR = pick('fr');
export const UX7_HI = pick('hi');
export const UX7_ZH = pick('zh');
