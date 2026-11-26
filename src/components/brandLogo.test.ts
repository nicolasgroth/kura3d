/**
 * @file src/components/brandLogo.test.ts
 * @description Comprueba que cada variante del logo existe en public/branding y que la elección por tema es la esperada.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest';
import darkSvg from '../../public/branding/kurra-studio-logo-oscuro.svg?raw';
import lightSvg from '../../public/branding/kurra-studio-logo.svg?raw';
import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT, brandLogoSrc } from './BrandLogo';

describe('BrandLogo', () => {
  it('elige la variante según el esquema', () => {
    expect(brandLogoSrc(true)).toBe(BRAND_LOGO_DARK);
    expect(brandLogoSrc(false)).toBe(BRAND_LOGO_LIGHT);
  });
  it('los archivos existen y la variante oscura no usa el texto casi negro', () => {
    expect(lightSvg).toContain('#332150');
    expect(darkSvg).not.toContain('#332150');
    expect(BRAND_LOGO_DARK).toContain('oscuro');
  });
});
