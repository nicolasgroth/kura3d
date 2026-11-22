/**
 * @file src/i18n/locales/splitCoupling.ts
 * @description Textos de "dividir para imprimir" que conectan motor e interfaz: conteo exacto del plan,
 * unión pegada por choque de conectores y detalle del armado al dividir (uniones débiles), en los 6
 * idiomas. Se mezclan en cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const SPLITCOUPLING_ES = {
  'split.sum.piecesExactValue': '{count} (rejilla {grid})',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': 'La unión {label} ({a}–{b}) pasó a «para pegar»: sus conectores chocaban con otros o quedaban sin pared suficiente.',
  'splitJoints.result.weak': 'Uniones débiles: {labels}',
};

export const SPLITCOUPLING_EN = {
  'split.sum.piecesExactValue': '{count} (grid {grid})',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': 'Joint {label} ({a}–{b}) was changed to glue-only: its connectors clashed with others or lacked enough wall.',
  'splitJoints.result.weak': 'Weak joints: {labels}',
};

export const SPLITCOUPLING_DE = {
  'split.sum.piecesExactValue': '{count} (Raster {grid})',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': 'Verbindung {label} ({a}–{b}) wurde auf Kleben umgestellt: ihre Verbinder kollidierten mit anderen oder hatten zu wenig Wand.',
  'splitJoints.result.weak': 'Schwache Verbindungen: {labels}',
};

export const SPLITCOUPLING_FR = {
  'split.sum.piecesExactValue': '{count} (grille {grid})',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': 'La jonction {label} ({a}–{b}) est passée à coller : ses connecteurs heurtaient d’autres connecteurs ou manquaient de paroi.',
  'splitJoints.result.weak': 'Jonctions faibles : {labels}',
};

export const SPLITCOUPLING_HI = {
  'split.sum.piecesExactValue': '{count} (ग्रिड {grid})',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': 'जोड़ {label} ({a}–{b}) को केवल चिपकाने वाला बनाया गया: इसके कनेक्टर दूसरों से टकरा रहे थे या उनके चारों ओर पर्याप्त दीवार नहीं थी।',
  'splitJoints.result.weak': 'कमज़ोर जोड़: {labels}',
};

export const SPLITCOUPLING_ZH = {
  'split.sum.piecesExactValue': '{count}（网格 {grid}）',
  'engineWarning.ASSEMBLY_JOINT_GLUED_FOR_CLASH': '接合 {label}（{a}–{b}）已改为仅粘合：其连接件与其他连接件相撞或壁厚不足。',
  'splitJoints.result.weak': '薄弱接合：{labels}',
};
