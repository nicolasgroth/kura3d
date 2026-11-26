/**
 * @file src/brandAssets.ts
 * @description Rutas de los archivos de la marca (ícono y logos en `public/branding/`), resueltas con
 * `import.meta.env.BASE_URL` para que funcionen también si la app se publica bajo una subruta. Separado de
 * `brand.ts` porque ese módulo lo usa también el servidor MCP en Node, donde `import.meta.env` no existe.
 * `index.html` no puede importar esta constante: allí la ruta del favicon queda escrita con un comentario.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

const base = import.meta.env.BASE_URL ?? '/';
const asset = (name: string) => `${base.endsWith('/') ? base : `${base}/`}branding/${name}`;

/** Ícono cuadrado de la marca (barra superior, pantalla de inicio, Ajustes, favicon). */
export const BRAND_ICON = asset('kurra-studio-icono.svg');
/** Logo completo (proporción 1050 x 430) para fondo claro y oscuro. */
export const BRAND_LOGO_LIGHT = asset('kurra-studio-logo.svg');
export const BRAND_LOGO_DARK = asset('kurra-studio-logo-oscuro.svg');
