/**
 * @file src/engine/io/exportBrand.ts
 * @description Marca de autoría que los exportadores escriben en cabeceras y metadatos (3MF, OBJ,
 * PLY, GLB). El motor no conoce la marca de la app: la recibe de quien llama (`BRAND` de
 * `src/brand.ts`); sin ella, los archivos quedan con textos neutros.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

/** Marca que entrega quien exporta. */
export interface ExportBrand {
  name: string;
  author?: string;
  organization?: string;
}

/** «Nombre by Autor» (o solo el nombre); `null` sin marca. */
export function brandSignature(brand?: ExportBrand | null): string | null {
  if (!brand?.name) return null;
  return brand.author ? `${brand.name} by ${brand.author}` : brand.name;
}
