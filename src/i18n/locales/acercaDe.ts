/**
 * @file src/i18n/locales/acercaDe.ts
 * @description Textos del diálogo «Acerca de» y del mensaje del huevo de pascua en los 6 idiomas.
 * El nombre del producto nunca va escrito: se interpola con `{name}` (y `{author}`, `{organization}`,
 * `{license}`, `{version}`) desde `BRAND`, para que un cambio de marca sea de una línea.
 * Cada clave lleva [es, en, de, fr, hi, zh]; `ACERCA_<IDIOMA>` se mezcla en cada diccionario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

type Row = readonly [es: string, en: string, de: string, fr: string, hi: string, zh: string];

const ACERCA_TABLE = {
  'about.title': ['Acerca de {name}', 'About {name}', 'Über {name}', 'À propos de {name}', '{name} के बारे में', '关于 {name}'],
  'about.menuTip': [
    'Qué es {name}, cómo se construyó y con qué está hecho',
    'What {name} is, how it was built and what it is made with',
    'Was {name} ist, wie es entstanden ist und woraus es besteht',
    'Ce qu’est {name}, comment il a été construit et avec quoi',
    '{name} क्या है, कैसे बना और किससे बना है',
    '{name} 是什么、如何构建以及使用了哪些组件',
  ],
  'about.badgeLabel': [
    'Versión {version}. Abrir Acerca de {name}',
    'Version {version}. Open About {name}',
    'Version {version}. Über {name} öffnen',
    'Version {version}. Ouvrir À propos de {name}',
    'संस्करण {version}। {name} के बारे में खोलें',
    '版本 {version}。打开“关于 {name}”',
  ],
  'about.whatTitle': ['Qué es', 'What it is', 'Was es ist', 'Ce que c’est', 'यह क्या है', '它是什么'],
  'about.what': [
    '{name} es un estudio abierto para modelar y preparar piezas que se imprimen en 3D, en la web y en el escritorio.',
    '{name} is an open studio for modelling and preparing parts to 3D print, on the web and on the desktop.',
    '{name} ist ein offenes Studio zum Modellieren und Vorbereiten von Teilen für den 3D-Druck, im Web und auf dem Desktop.',
    '{name} est un studio ouvert pour modéliser et préparer des pièces à imprimer en 3D, sur le web et sur ordinateur.',
    '{name} 3D प्रिंट के लिए भाग बनाने और तैयार करने का एक खुला स्टूडियो है, वेब और डेस्कटॉप दोनों पर।',
    '{name} 是一个开放的工作室,用于建模并准备 3D 打印零件,可在网页和桌面端使用。',
  ],
  'about.purposeTitle': ['El sentido', 'The idea behind it', 'Der Sinn', 'Le sens', 'इसका अर्थ', '初衷'],
  'about.purpose': [
    'Modelar es imaginar juntos: {name} existe para que cualquiera pueda dar forma a una idea y compartirla, porque el mundo se construye mejor entre todos.',
    'Modelling is imagining together: {name} exists so that anyone can give shape to an idea and share it, because the world is built better by all of us.',
    'Modellieren heißt gemeinsam sich etwas vorstellen: {name} gibt jedem die Möglichkeit, einer Idee Form zu geben und sie zu teilen, denn die Welt entsteht besser gemeinsam.',
    'Modéliser, c’est imaginer ensemble : {name} existe pour que chacun puisse donner forme à une idée et la partager, car le monde se construit mieux à plusieurs.',
    'मॉडलिंग का मतलब है साथ मिलकर कल्पना करना: {name} इसलिए है कि कोई भी किसी विचार को आकार दे सके और साझा कर सके, क्योंकि दुनिया सबके साथ मिलकर बेहतर बनती है।',
    '建模就是一起想象:{name} 的存在,是为了让任何人都能把想法变成形状并与他人分享,因为世界由大家一起建造会更好。',
  ],
  'about.howTitle': ['Cómo se construyó', 'How it was built', 'Wie es entstanden ist', 'Comment il a été construit', 'यह कैसे बना', '如何构建'],
  'about.how': [
    'Lo hizo su autor trabajando con asistentes de inteligencia artificial como un equipo: unos desarrollan, otros prueban e intentan romper cada cambio y otros lo evalúan a ciegas, sin saber quién lo escribió. Cada función se apoya en algoritmos y geometría; la inteligencia artificial es solo una ayuda opcional encima. El código es abierto para que otras personas lo lean, lo mejoren y lo adapten.',
    'Its author built it working with artificial intelligence assistants as a team: some develop, others test and try to break each change, and others evaluate it blind, without knowing who wrote it. Every feature rests on algorithms and geometry; artificial intelligence is only an optional help on top. The code is open so that others can read it, improve it and adapt it.',
    'Sein Autor hat es im Team mit KI-Assistenten gebaut: Die einen entwickeln, die anderen testen jede Änderung und versuchen, sie zu brechen, wieder andere bewerten sie blind, ohne zu wissen, wer sie geschrieben hat. Jede Funktion beruht auf Algorithmen und Geometrie; die künstliche Intelligenz ist nur eine optionale Hilfe obendrauf. Der Code ist offen, damit andere ihn lesen, verbessern und anpassen können.',
    'Son auteur l’a construit en équipe avec des assistants d’intelligence artificielle : les uns développent, d’autres testent et tentent de casser chaque changement, d’autres encore l’évaluent à l’aveugle, sans savoir qui l’a écrit. Chaque fonction repose sur des algorithmes et de la géométrie ; l’intelligence artificielle n’est qu’une aide facultative par-dessus. Le code est ouvert pour que d’autres puissent le lire, l’améliorer et l’adapter.',
    'इसके लेखक ने इसे कृत्रिम बुद्धिमत्ता सहायकों के साथ एक टीम की तरह बनाया: कुछ विकसित करते हैं, कुछ हर बदलाव को परखकर तोड़ने की कोशिश करते हैं और कुछ उसे बिना जाने कि किसने लिखा, निष्पक्ष रूप से जाँचते हैं। हर सुविधा एल्गोरिदम और ज्यामिति पर टिकी है; कृत्रिम बुद्धिमत्ता केवल ऊपर से एक वैकल्पिक मदद है। कोड खुला है ताकि दूसरे लोग उसे पढ़ें, सुधारें और अपनाएँ।',
    '作者与人工智能助手像团队一样协作完成了它:有的负责开发,有的测试并试图破坏每次改动,有的在不知道作者是谁的情况下进行盲评。每项功能都以算法和几何为基础,人工智能只是可选的辅助。代码是开放的,方便他人阅读、改进和改编。',
  ],
  'about.authorTitle': ['Autoría y licencia', 'Authorship and license', 'Urheberschaft und Lizenz', 'Auteur et licence', 'लेखक और लाइसेंस', '作者与许可'],
  'about.author': [
    'Creado por {author} · {organization}',
    'Created by {author} · {organization}',
    'Erstellt von {author} · {organization}',
    'Créé par {author} · {organization}',
    '{author} द्वारा निर्मित · {organization}',
    '作者:{author} · {organization}',
  ],
  'about.version': ['Versión {version}', 'Version {version}', 'Version {version}', 'Version {version}', 'संस्करण {version}', '版本 {version}'],
  'about.license': [
    'Licencia {license}: puedes usar, copiar, modificar y distribuir el programa, incluso con fines comerciales, conservando el aviso de autoría.',
    '{license} license: you may use, copy, modify and distribute the program, even commercially, as long as you keep the copyright notice.',
    'Lizenz {license}: Du darfst das Programm nutzen, kopieren, verändern und weitergeben, auch kommerziell, sofern der Urheberhinweis erhalten bleibt.',
    'Licence {license} : tu peux utiliser, copier, modifier et distribuer le programme, même à des fins commerciales, en conservant la mention d’auteur.',
    '{license} लाइसेंस: आप प्रोग्राम का उपयोग, प्रतिलिपि, संशोधन और वितरण कर सकते हैं, व्यावसायिक रूप से भी, बशर्ते लेखक की सूचना बनी रहे।',
    '{license} 许可:你可以使用、复制、修改和分发本程序,包括商业用途,但需保留作者声明。',
  ],
  'about.linksTitle': ['Enlaces', 'Links', 'Links', 'Liens', 'लिंक', '链接'],
  'about.linkGuides': ['Guías de uso', 'User guides', 'Anleitungen', 'Guides d’utilisation', 'उपयोग गाइड', '使用指南'],
  'about.linkRepo': ['Repositorio del código', 'Source code repository', 'Code-Repository', 'Dépôt du code', 'कोड रिपॉज़िटरी', '代码仓库'],
  'about.linkNote': ['Se abre en una pestaña nueva', 'Opens in a new tab', 'Öffnet in einem neuen Tab', 'S’ouvre dans un nouvel onglet', 'नए टैब में खुलता है', '在新标签页中打开'],
  'about.libsTitle': ['Con qué está hecho', 'What it is made with', 'Woraus es besteht', 'Avec quoi il est fait', 'यह किससे बना है', '使用的组件'],
  'about.libsIntro': [
    'Las principales bibliotecas abiertas que usa {name}, cada una con su licencia.',
    'The main open libraries {name} uses, each with its license.',
    'Die wichtigsten offenen Bibliotheken, die {name} verwendet, jeweils mit ihrer Lizenz.',
    'Les principales bibliothèques ouvertes utilisées par {name}, chacune avec sa licence.',
    '{name} द्वारा उपयोग की गई मुख्य खुली लाइब्रेरी, अपने-अपने लाइसेंस के साथ।',
    '{name} 使用的主要开源库及其许可。',
  ],
  'about.libsCaption': ['Bibliotecas abiertas y licencias', 'Open libraries and licenses', 'Offene Bibliotheken und Lizenzen', 'Bibliothèques ouvertes et licences', 'खुली लाइब्रेरी और लाइसेंस', '开源库与许可'],
  'about.libsColName': ['Biblioteca', 'Library', 'Bibliothek', 'Bibliothèque', 'लाइब्रेरी', '库'],
  'about.libsColUse': ['Para qué', 'Used for', 'Wofür', 'Pour quoi', 'किसलिए', '用途'],
  'about.libsColLicense': ['Licencia', 'License', 'Lizenz', 'Licence', 'लाइसेंस', '许可'],
  'about.lib.react': ['Interfaz', 'Interface', 'Oberfläche', 'Interface', 'इंटरफ़ेस', '界面'],
  'about.lib.three': ['Gráficos 3D en el visor', '3D graphics in the viewport', '3D-Grafik im Viewport', 'Graphismes 3D du visualiseur', 'व्यूअर में 3D ग्राफ़िक्स', '视图中的 3D 图形'],
  'about.lib.r3f': ['Visor 3D dentro de React', '3D viewport inside React', '3D-Viewport in React', 'Visualiseur 3D dans React', 'React में 3D व्यूअर', 'React 中的 3D 视图'],
  'about.lib.manifold': ['Motor de geometría (booleanas, cortes)', 'Geometry engine (booleans, cuts)', 'Geometrie-Engine (Boolesche Operationen, Schnitte)', 'Moteur de géométrie (booléens, coupes)', 'ज्यामिति इंजन (बूलियन, कट)', '几何引擎(布尔运算、切割)'],
  'about.lib.zustand': ['Estado de la aplicación', 'Application state', 'Anwendungszustand', 'État de l’application', 'ऐप की स्थिति', '应用状态'],
  'about.lib.tauri': ['Versión de escritorio', 'Desktop version', 'Desktop-Version', 'Version de bureau', 'डेस्कटॉप संस्करण', '桌面版'],
  'about.lib.vite': ['Construcción y servidor de desarrollo', 'Build and dev server', 'Build und Entwicklungsserver', 'Build et serveur de développement', 'बिल्ड और डेवलपमेंट सर्वर', '构建与开发服务器'],
  'about.lib.lucide': ['Iconos', 'Icons', 'Symbole', 'Icônes', 'आइकन', '图标'],
  'about.egg.button': ['Ver una pequeña animación', 'Play a small animation', 'Eine kleine Animation zeigen', 'Voir une petite animation', 'एक छोटा एनिमेशन देखें', '播放一段小动画'],
  'about.egg.message': [
    'Piedra a piedra se levanta un mundo.',
    'Stone by stone, a world rises.',
    'Stein für Stein entsteht eine Welt.',
    'Pierre à pierre, un monde s’élève.',
    'पत्थर-पत्थर जोड़कर एक दुनिया खड़ी होती है।',
    '一砖一石,筑起一个世界。',
  ],
} as const satisfies Record<string, Row>;

type AcercaKey = keyof typeof ACERCA_TABLE;

function pick(index: number): Record<AcercaKey, string> {
  const out = {} as Record<AcercaKey, string>;
  for (const key of Object.keys(ACERCA_TABLE) as AcercaKey[]) out[key] = ACERCA_TABLE[key][index];
  return out;
}

export const ACERCA_ES = pick(0);
export const ACERCA_EN = pick(1);
export const ACERCA_DE = pick(2);
export const ACERCA_FR = pick(3);
export const ACERCA_HI = pick(4);
export const ACERCA_ZH = pick(5);
