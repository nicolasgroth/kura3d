/**
 * @file src/test/spanishWords.ts
 * @description Lista corta de palabras españolas frecuentes para detectar texto sin traducir en la interfaz inglesa.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

export const SPANISH_WORDS =
  /(?<![\p{L}])(pieza|piezas|malla|mallas|cama|guardar|ruta|estrella|emblema|agujero|agujeros|ahuecar|cilindro|cubo|esfera|engranaje|unir|restar|aplicar|ajustes|herramienta|archivo|archivos|escena|mover|girar|escalar|cortar|molde|rosca|tornillo)(?![\p{L}])/iu;
