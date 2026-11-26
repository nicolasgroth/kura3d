/**
 * @file src/i18n/locales/encaje.ts
 * @description Textos de "Comprobar encaje": recomendaciones por regla (separar, agrandar el alojamiento,
 * dar holgura), resumen general, notas (mallas abiertas, restas, simplificación, cortes), direcciones en
 * ejes del usuario y estados de un par, en los 6 idiomas. Se define por clave con sus 6 traducciones
 * [es, en, de, fr, hi, zh] y se mezcla en cada diccionario de `translations.ts` y `locales/*.ts`.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const FIT_CHECK_TABLE = {
  'fitCheck.rec.separate': [
    '«{a}» se cruza con «{b}» {volumeMm3} mm³ cerca de X {x}, Y {y}, Z {z}: separa unos {distanceMm} mm hacia {direction} (estimado).',
    '"{a}" overlaps "{b}" by {volumeMm3} mm³ near X {x}, Y {y}, Z {z}: move it about {distanceMm} mm toward {direction} (estimate).',
    '„{a}“ überschneidet „{b}“ um {volumeMm3} mm³ bei X {x}, Y {y}, Z {z}: etwa {distanceMm} mm nach {direction} verschieben (geschätzt).',
    '« {a} » chevauche « {b} » de {volumeMm3} mm³ près de X {x}, Y {y}, Z {z} : décalez d’environ {distanceMm} mm vers {direction} (estimation).',
    '“{a}” और “{b}” {volumeMm3} mm³ आपस में घुसते हैं, X {x}, Y {y}, Z {z} के पास: लगभग {distanceMm} mm {direction} की ओर हटाएँ (अनुमान)।',
    '“{a}”与“{b}”在 X {x}, Y {y}, Z {z} 附近重叠 {volumeMm3} mm³:向 {direction} 移开约 {distanceMm} mm(估计)。',
  ],
  'fitCheck.rec.enlarge': [
    '«{inner}» no cabe en «{outer}»: se cruzan {volumeMm3} mm³ alrededor de X {x}, Y {y}, Z {z}. Agranda el alojamiento unos {perSideMm} mm por lado en {axes} o achica «{inner}» (estimado).',
    '"{inner}" does not fit in "{outer}": they overlap by {volumeMm3} mm³ around X {x}, Y {y}, Z {z}. Enlarge the pocket about {perSideMm} mm per side in {axes} or shrink "{inner}" (estimate).',
    '„{inner}“ passt nicht in „{outer}“: {volumeMm3} mm³ Überschneidung um X {x}, Y {y}, Z {z}. Aufnahme um etwa {perSideMm} mm pro Seite in {axes} vergrößern oder „{inner}“ verkleinern (geschätzt).',
    '« {inner} » ne rentre pas dans « {outer} » : chevauchement de {volumeMm3} mm³ autour de X {x}, Y {y}, Z {z}. Agrandissez le logement d’environ {perSideMm} mm par côté en {axes} ou réduisez « {inner} » (estimation).',
    '“{inner}” “{outer}” में नहीं समाता: X {x}, Y {y}, Z {z} के आसपास {volumeMm3} mm³ आपस में घुसते हैं। खाँचे को {axes} में हर तरफ़ लगभग {perSideMm} mm बड़ा करें या “{inner}” छोटा करें (अनुमान)।',
    '“{inner}”放不进“{outer}”:在 X {x}, Y {y}, Z {z} 附近重叠 {volumeMm3} mm³。将安装槽在 {axes} 方向每侧加大约 {perSideMm} mm,或缩小“{inner}”(估计)。',
  ],
  'fitCheck.rec.tight': [
    'Holgura de {gapMm} mm entre «{a}» y «{b}» cerca de X {x}, Y {y}, Z {z}, menor que {targetMm} mm: agranda el hueco o achica la pieza {missingMm} mm, o sepáralas {missingMm} mm hacia {direction}.',
    'Clearance of {gapMm} mm between "{a}" and "{b}" near X {x}, Y {y}, Z {z}, below {targetMm} mm: enlarge the opening or shrink the part by {missingMm} mm, or move them {missingMm} mm apart toward {direction}.',
    'Spiel von {gapMm} mm zwischen „{a}“ und „{b}“ bei X {x}, Y {y}, Z {z}, unter {targetMm} mm: Öffnung vergrößern oder Teil um {missingMm} mm verkleinern, oder {missingMm} mm nach {direction} auseinanderrücken.',
    'Jeu de {gapMm} mm entre « {a} » et « {b} » près de X {x}, Y {y}, Z {z}, inférieur à {targetMm} mm : agrandissez l’ouverture ou réduisez la pièce de {missingMm} mm, ou écartez-les de {missingMm} mm vers {direction}.',
    '“{a}” और “{b}” के बीच X {x}, Y {y}, Z {z} के पास {gapMm} mm की गुंजाइश है, {targetMm} mm से कम: छेद बड़ा करें या भाग {missingMm} mm छोटा करें, या उन्हें {direction} की ओर {missingMm} mm अलग करें।',
    '“{a}”与“{b}”在 X {x}, Y {y}, Z {z} 附近间隙为 {gapMm} mm,小于 {targetMm} mm:把孔加大或把零件缩小 {missingMm} mm,或向 {direction} 分开 {missingMm} mm。',
  ],
  'fitCheck.summary.none': [
    'No hay pares que comprobar entre {objects} objetos: hacen falta dos piezas, o una pieza y una referencia.',
    'Nothing to check among {objects} objects: it takes two parts, or a part and a reference.',
    'Unter {objects} Objekten gibt es nichts zu prüfen: nötig sind zwei Teile oder ein Teil und eine Referenz.',
    'Rien à vérifier parmi {objects} objets : il faut deux pièces, ou une pièce et une référence.',
    '{objects} वस्तुओं में जाँचने को कुछ नहीं: दो भाग, या एक भाग और एक संदर्भ चाहिए।',
    '{objects} 个对象之间没有可检查的组合:需要两个零件,或一个零件和一个参考。',
  ],
  'fitCheck.summary.clean': [
    'Pares revisados: {pairs}. Ninguno choca ni queda justo.',
    'Pairs checked: {pairs}. None overlap or are too tight.',
    'Geprüfte Paare: {pairs}. Keine Überschneidung, nichts zu eng.',
    'Paires vérifiées : {pairs}. Aucun chevauchement ni jeu insuffisant.',
    'जाँचे गए जोड़े: {pairs}। कोई आपस में नहीं घुसता, न ही कोई बहुत तंग है।',
    '已检查组合:{pairs}。没有重叠,也没有过紧。',
  ],
  'fitCheck.summary.issues': [
    'Pares revisados: {pairs} · con choque: {clashes} · justos: {tight}. Peor caso: «{a}» y «{b}».',
    'Pairs checked: {pairs} · overlapping: {clashes} · too tight: {tight}. Worst: "{a}" and "{b}".',
    'Geprüfte Paare: {pairs} · mit Überschneidung: {clashes} · zu eng: {tight}. Schlimmster Fall: „{a}“ und „{b}“.',
    'Paires vérifiées : {pairs} · en chevauchement : {clashes} · trop justes : {tight}. Pire cas : « {a} » et « {b} ».',
    'जाँचे गए जोड़े: {pairs} · आपस में घुसते: {clashes} · बहुत तंग: {tight}। सबसे बुरा: “{a}” और “{b}”।',
    '已检查组合:{pairs} · 重叠:{clashes} · 过紧:{tight}。最严重:“{a}”与“{b}”。',
  ],
  'fitCheck.note.openMesh': [
    '«{name}» no es una malla cerrada: sus resultados son aproximados.',
    '"{name}" is not a closed mesh: its results are approximate.',
    '„{name}“ ist kein geschlossenes Netz: die Ergebnisse sind Näherungen.',
    '« {name} » n’est pas un maillage fermé : ses résultats sont approximatifs.',
    '“{name}” बंद मेश नहीं है: इसके परिणाम अनुमानित हैं।',
    '“{name}”不是封闭网格:其结果为近似值。',
  ],
  'fitCheck.note.subtractionFailed': [
    'No se pudieron aplicar las restas pendientes a «{name}» (malla abierta): se compara sin ellas.',
    'Pending subtractions could not be applied to "{name}" (open mesh): it is compared without them.',
    'Ausstehende Subtraktionen ließen sich nicht auf „{name}“ anwenden (offenes Netz): Vergleich ohne sie.',
    'Les soustractions en attente n’ont pas pu être appliquées à « {name} » (maillage ouvert) : comparaison sans elles.',
    '“{name}” पर बाकी घटाव लागू नहीं हो सके (खुला मेश): उनके बिना तुलना की गई।',
    '无法对“{name}”应用待处理的减法(网格不封闭):按未减去的形状比较。',
  ],
  'fitCheck.note.subtractionsIgnored': [
    'Negativos sin aplicar ignorados: {count}. El resultado no refleja esos agujeros.',
    'Unapplied negatives ignored: {count}. The result does not include those holes.',
    'Nicht angewendete Negative ignoriert: {count}. Das Ergebnis enthält diese Löcher nicht.',
    'Négatifs non appliqués ignorés : {count}. Le résultat n’inclut pas ces trous.',
    'लागू न किए गए नेगेटिव अनदेखे: {count}। परिणाम में वे छेद शामिल नहीं हैं।',
    '已忽略未应用的负形:{count}。结果不包含这些孔。',
  ],
  'fitCheck.note.simplified': [
    '«{a}» y «{b}» son muy densas: el choque se calculó sobre una copia simplificada ({toleranceMm} mm).',
    '"{a}" and "{b}" are very dense: the overlap was computed on a simplified copy ({toleranceMm} mm).',
    '„{a}“ und „{b}“ sind sehr dicht: die Überschneidung wurde an einer vereinfachten Kopie berechnet ({toleranceMm} mm).',
    '« {a} » et « {b} » sont très denses : le chevauchement a été calculé sur une copie simplifiée ({toleranceMm} mm).',
    '“{a}” और “{b}” बहुत घने हैं: टकराव सरल की गई प्रति पर निकाला गया ({toleranceMm} mm)।',
    '“{a}”与“{b}”非常密集:重叠在简化副本上计算({toleranceMm} mm)。',
  ],
  'fitCheck.note.truncated': [
    'Se revisaron {evaluated} de {candidates} pares cercanos (tope de pares).',
    'Checked {evaluated} of {candidates} nearby pairs (pair limit).',
    '{evaluated} von {candidates} nahen Paaren geprüft (Paar-Obergrenze).',
    '{evaluated} paires proches vérifiées sur {candidates} (limite de paires).',
    '{candidates} में से {evaluated} पास के जोड़े जाँचे गए (जोड़ों की सीमा)।',
    '已检查 {candidates} 个相邻组合中的 {evaluated} 个(组合上限)。',
  ],
  'fitCheck.note.timeBudget': [
    'Se revisaron {evaluated} de {candidates} pares cercanos (tope de {seconds} s).',
    'Checked {evaluated} of {candidates} nearby pairs ({seconds} s limit).',
    '{evaluated} von {candidates} nahen Paaren geprüft (Zeitlimit {seconds} s).',
    '{evaluated} paires proches vérifiées sur {candidates} (limite de {seconds} s).',
    '{candidates} में से {evaluated} पास के जोड़े जाँचे गए ({seconds} s की सीमा)।',
    '已检查 {candidates} 个相邻组合中的 {evaluated} 个(时限 {seconds} 秒)。',
  ],
  'fitCheck.dir.right': ['+X (derecha)', '+X (right)', '+X (rechts)', '+X (droite)', '+X (दाएँ)', '+X(右)'],
  'fitCheck.dir.left': ['−X (izquierda)', '−X (left)', '−X (links)', '−X (gauche)', '−X (बाएँ)', '−X(左)'],
  'fitCheck.dir.back': ['+Y (fondo)', '+Y (back)', '+Y (hinten)', '+Y (arrière)', '+Y (पीछे)', '+Y(后)'],
  'fitCheck.dir.front': ['−Y (frente)', '−Y (front)', '−Y (vorne)', '−Y (avant)', '−Y (आगे)', '−Y(前)'],
  'fitCheck.dir.top': ['+Z (arriba)', '+Z (up)', '+Z (oben)', '+Z (haut)', '+Z (ऊपर)', '+Z(上)'],
  'fitCheck.dir.bottom': ['−Z (abajo)', '−Z (down)', '−Z (unten)', '−Z (bas)', '−Z (नीचे)', '−Z(下)'],
  'fitCheck.status.interferes': ['Choque', 'Overlap', 'Überschneidung', 'Chevauchement', 'टकराव', '重叠'],
  'fitCheck.status.tight': ['Justo', 'Too tight', 'Zu eng', 'Trop juste', 'बहुत तंग', '过紧'],
  'fitCheck.status.cutJoint': ['Unión del corte', 'Cut joint', 'Schnittverbindung', 'Jonction de coupe', 'कट जोड़', '切口接合'],
  'fitCheck.status.ok': ['Bien', 'OK', 'OK', 'OK', 'ठीक', '合适'],
  'fitCheck.status.far': ['Lejos', 'Apart', 'Entfernt', 'Éloigné', 'दूर', '远离'],
  'fitCheck.estimate': ['Estimado', 'Estimate', 'Geschätzt', 'Estimation', 'अनुमान', '估计'],
  'fitCheck.approximate': ['Aproximado', 'Approximate', 'Näherung', 'Approximatif', 'अनुमानित', '近似'],
} as const satisfies Record<string, Row>;

type FitCheckKey = keyof typeof FIT_CHECK_TABLE;

const pick = (index: number): Record<FitCheckKey, string> =>
  Object.fromEntries(Object.entries(FIT_CHECK_TABLE).map(([key, row]) => [key, row[index]])) as Record<FitCheckKey, string>;

export const FIT_CHECK_ES = pick(0);
export const FIT_CHECK_EN = pick(1);
export const FIT_CHECK_DE = pick(2);
export const FIT_CHECK_FR = pick(3);
export const FIT_CHECK_HI = pick(4);
export const FIT_CHECK_ZH = pick(5);
