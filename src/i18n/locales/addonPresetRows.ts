/**
 * @file src/i18n/locales/addonPresetRows.ts
 * @description Textos comunes del selector de preajustes de un agregado (`AddonPresetPicker`) para un prefijo dado:
 * «Medida», incluidas por verificar, las del usuario, guardar, eliminar con deshacer y los errores. Cada fila lleva
 * [es, en, de, fr, hi, zh]; los archivos de cada agregado los mezclan en su tabla (ojo de cerradura, paso de cable).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const ROWS = {
  '': ['Medida', 'Size', 'Größe', 'Taille', 'माप', '规格'],
  '.custom': ['Personalizada', 'Custom', 'Eigene', 'Personnalisée', 'कस्टम', '自定义'],
  '.builtin': ['Incluidas (por verificar)', 'Included (to be verified)', 'Enthalten (zu prüfen)', 'Incluses (à vérifier)', 'शामिल (जाँचना बाकी)', '内置（待验证）'],
  '.mine': ['Mis medidas', 'My sizes', 'Meine Größen', 'Mes tailles', 'मेरे माप', '我的规格'],
  '.name': ['Nombre del preajuste', 'Preset name', 'Name der Vorgabe', 'Nom du préréglage', 'प्रीसेट का नाम', '预设名称'],
  '.save': ['Guardar', 'Save', 'Speichern', 'Enregistrer', 'सहेजें', '保存'],
  '.delete': ['Eliminar el preajuste propio', 'Delete my preset', 'Eigene Vorgabe löschen', 'Supprimer mon préréglage', 'मेरा प्रीसेट हटाएँ', '删除我的预设'],
  '.nameInvalid': [
    'Escribe un nombre de 1 a 40 caracteres.',
    'Type a name of 1 to 40 characters.',
    'Gib einen Namen mit 1 bis 40 Zeichen ein.',
    'Saisis un nom de 1 à 40 caractères.',
    '1 से 40 अक्षरों का नाम लिखें।',
    '请输入 1 到 40 个字符的名称。',
  ],
  '.full': [
    'Ya tienes {max} preajustes: elimina uno para guardar otro.',
    'You already have {max} presets: delete one to save another.',
    'Du hast bereits {max} Vorgaben: lösche eine, um eine neue zu speichern.',
    'Tu as déjà {max} préréglages : supprimes-en un pour en enregistrer un autre.',
    'आपके पास पहले से {max} प्रीसेट हैं: नया सहेजने के लिए एक हटाएँ।',
    '已有 {max} 个预设：请先删除一个再保存。',
  ],
  '.storageFailed': [
    'No se pudo guardar en este navegador (almacenamiento lleno o bloqueado).',
    'Could not save in this browser (storage full or blocked).',
    'Speichern in diesem Browser nicht möglich (Speicher voll oder gesperrt).',
    'Impossible d’enregistrer dans ce navigateur (stockage plein ou bloqué).',
    'इस ब्राउज़र में सहेजा नहीं जा सका (स्टोरेज भरा या अवरुद्ध)।',
    '无法在此浏览器中保存（存储已满或被阻止）。',
  ],
  '.valuesInvalid': [
    'Las medidas actuales no son válidas: corrígelas antes de guardar.',
    'The current sizes are not valid: fix them before saving.',
    'Die aktuellen Maße sind ungültig: korrigiere sie vor dem Speichern.',
    'Les mesures actuelles ne sont pas valides : corrige-les avant d’enregistrer.',
    'मौजूदा माप मान्य नहीं हैं: सहेजने से पहले ठीक करें।',
    '当前尺寸无效：请先修正再保存。',
  ],
  '.saved': ['Preajuste «{name}» guardado.', 'Preset “{name}” saved.', 'Vorgabe „{name}“ gespeichert.', 'Préréglage « {name} » enregistré.', 'प्रीसेट “{name}” सहेजा गया।', '已保存预设“{name}”。'],
  '.deleted': ['Preajuste «{name}» eliminado.', 'Preset “{name}” deleted.', 'Vorgabe „{name}“ gelöscht.', 'Préréglage « {name} » supprimé.', 'प्रीसेट “{name}” हटाया गया।', '已删除预设“{name}”。'],
  '.undoDelete': [
    'Deshacer eliminación del preajuste {name}',
    'Undo deletion of preset {name}',
    'Löschen der Vorgabe {name} rückgängig machen',
    'Annuler la suppression du préréglage {name}',
    'प्रीसेट {name} हटाना पूर्ववत करें',
    '撤销删除预设 {name}',
  ],
} as const satisfies Record<string, Row>;

type Suffix = keyof typeof ROWS;

/** Filas `<prefijo>.preset*` del selector de preajustes. */
export function presetRows<P extends string>(prefix: P): Record<`${P}.preset${Suffix}`, Row> {
  return Object.fromEntries(Object.entries(ROWS).map(([suffix, row]) => [`${prefix}.preset${suffix}`, row])) as Record<`${P}.preset${Suffix}`, Row>;
}

/** Diccionario de un idioma (índice de la fila) a partir de una tabla. */
export function pickColumn<K extends string>(table: Record<K, Row>, index: number): Record<K, string> {
  return Object.fromEntries(Object.entries(table).map(([key, row]) => [key, (row as Row)[index]])) as Record<K, string>;
}
