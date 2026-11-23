/**
 * @file src/i18n/locales/ux3Edicion.ts
 * @description Textos de la tercera revisión de usabilidad de edición (F4, árbol de Escena, Organizar, avisos de
 * operaciones, pintura, reparación) en los 6 idiomas. Cada clave lleva [es, en, de, fr, hi, zh].
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const UX3_EDICION_TABLE = {
  'ux3.repeat.dropToBed': ['Apoyar en la cama', 'Drop to bed', 'Aufs Druckbett legen', 'Poser sur le plateau', 'बेड पर रखें', '放到打印床上'],
  'ux3.repeat.resetOrientation': ['Restablecer orientación', 'Reset orientation', 'Ausrichtung zurücksetzen', 'Réinitialiser l’orientation', 'अभिविन्यास रीसेट करें', '重置方向'],
  'ux3.repeat.resetRotation': ['Restablecer rotación', 'Reset rotation', 'Drehung zurücksetzen', 'Réinitialiser la rotation', 'घुमाव रीसेट करें', '重置旋转'],
  'ux3.repeat.resetScale': ['Restablecer escala', 'Reset scale', 'Skalierung zurücksetzen', 'Réinitialiser l’échelle', 'स्केल रीसेट करें', '重置缩放'],
  'ux3.repeat.align': ['Alinear objetos', 'Align objects', 'Objekte ausrichten', 'Aligner les objets', 'ऑब्जेक्ट संरेखित करें', '对齐对象'],
  'ux3.repeat.arrange': ['Distribuir en la cama', 'Arrange on the bed', 'Auf dem Druckbett verteilen', 'Répartir sur le plateau', 'बेड पर व्यवस्थित करें', '在打印床上排列'],
  'ux3.repeat.material': ['Aplicar material', 'Apply material', 'Material anwenden', 'Appliquer le matériau', 'सामग्री लागू करें', '应用材料'],
  'ux3.tree.more': ['Más acciones de {name}', 'More actions for {name}', 'Weitere Aktionen für {name}', 'Plus d’actions pour {name}', '{name} के लिए और क्रियाएँ', '{name} 的更多操作'],
  'ux3.tree.moreTip': [
    'Más acciones: apoyar en la cama, duplicar, eliminar… (Mayús+F10)',
    'More actions: drop to bed, duplicate, delete… (Shift+F10)',
    'Weitere Aktionen: aufs Druckbett legen, duplizieren, löschen … (Umschalt+F10)',
    'Plus d’actions : poser sur le plateau, dupliquer, supprimer… (Maj+F10)',
    'और क्रियाएँ: बेड पर रखें, डुप्लिकेट, हटाएँ… (Shift+F10)',
    '更多操作:放到打印床、复制、删除…(Shift+F10)',
  ],
  'ux3.organize.groupDesc': [
    'Se mueven juntos; siguen siendo objetos separados',
    'They move together; they stay separate objects',
    'Bewegen sich gemeinsam; bleiben getrennte Objekte',
    'Ils bougent ensemble ; ils restent des objets séparés',
    'साथ चलते हैं; अलग ऑब्जेक्ट बने रहते हैं',
    '一起移动;仍是独立对象',
  ],
  'ux3.organize.combineDesc': [
    'Un solo objeto con varias piezas, sin fundirlas',
    'One object with several parts, not merged',
    'Ein Objekt aus mehreren Teilen, nicht verschmolzen',
    'Un seul objet avec plusieurs pièces, non fusionnées',
    'कई भागों वाला एक ऑब्जेक्ट, बिना मिलाए',
    '一个对象包含多个部件,不融合',
  ],
  'ux3.organize.unionDesc': [
    'Funde los volúmenes en un solo sólido',
    'Merges the volumes into one solid',
    'Verschmilzt die Volumen zu einem Körper',
    'Fusionne les volumes en un seul solide',
    'आयतनों को एक ठोस में मिलाता है',
    '将体积融合为一个实体',
  ],
  'ux3.organize.separateSingle': [
    'Este objeto tiene un solo cuerpo: no hay nada que separar',
    'This object has a single body: there is nothing to separate',
    'Dieses Objekt hat nur einen Körper: Es gibt nichts zu trennen',
    'Cet objet n’a qu’un seul corps : rien à séparer',
    'इस ऑब्जेक्ट में एक ही बॉडी है: अलग करने को कुछ नहीं',
    '该对象只有一个实体:无可分离',
  ],
} as const satisfies Record<string, Row>;

type Ux3EdicionKey = keyof typeof UX3_EDICION_TABLE;

const pick = (index: number): Record<Ux3EdicionKey, string> =>
  Object.fromEntries(Object.entries(UX3_EDICION_TABLE).map(([key, row]) => [key, row[index]])) as Record<Ux3EdicionKey, string>;

export const UX3_EDICION_ES = pick(0);
export const UX3_EDICION_EN = pick(1);
export const UX3_EDICION_DE = pick(2);
export const UX3_EDICION_FR = pick(3);
export const UX3_EDICION_HI = pick(4);
export const UX3_EDICION_ZH = pick(5);
