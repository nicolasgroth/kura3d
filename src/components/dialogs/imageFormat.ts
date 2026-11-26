/**
 * @file src/components/dialogs/imageFormat.ts
 * @description Reconoce por su firma los formatos de imagen que admite Imagen→3D (PNG, JPG, WebP, BMP); lo demás
 * (SVG, GIF, texto…) se rechaza antes de intentar decodificarlo.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Tipo MIME según los primeros bytes, o null si no es un formato admitido. */
export function detectImageFormat(bytes: Uint8Array): string | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 8 && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 3 && startsWith([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytes.length >= 12 && startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (bytes.length >= 2 && startsWith([0x42, 0x4d])) return 'image/bmp';
  return null;
}
