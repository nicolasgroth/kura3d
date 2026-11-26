/**
 * @file src/components/__tests__/uxTextoViews.test.tsx
 * @description Recorre las vistas principales renderizadas: en inglés no deben aparecer palabras españolas
 * (fuera de nombres escritos por el usuario) y en es/de ningún número decimal con punto ("2.5 g").
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKuraStore } from '../../store/useKuraStore';
import { fakeBox } from '../../test/fakeObjects';
import { SPANISH_WORDS } from '../../test/spanishWords';
import { AiChatDrawer } from '../AiChatDrawer';
import { LeftSidebar } from '../LeftSidebar';
import { RightInspector } from '../RightInspector';
import { StatusBar } from '../StatusBar';
import { McpSetupPanel } from '../settings/McpSetupPanel';
import { SvgImportModal } from '../dialogs/SvgImportModal';

/** Texto visible + atributos accesibles de un contenedor. */
function visibleText(root: HTMLElement): string {
  const parts: string[] = [root.textContent ?? ''];
  root.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => {
    for (const attr of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(attr);
      if (v) parts.push(v);
    }
  });
  return parts.join('\n');
}

const VIEWS: Array<[string, () => React.ReactElement]> = [
  ['LeftSidebar', () => <LeftSidebar />],
  ['RightInspector', () => <RightInspector />],
  ['StatusBar', () => <StatusBar />],
  ['AiChatDrawer', () => <AiChatDrawer />],
  ['McpSetupPanel', () => <McpSetupPanel />],
  ['SvgImportModal', () => <SvgImportModal open onClose={() => undefined} />],
];

function seed(language: 'en' | 'es' | 'de') {
  useKuraStore.setState({
    language,
    objects: [{ ...fakeBox('a', 'My part'), volumeMm3: 15190.7 }],
    selectedIds: ['a'],
    aiMessages: [{ id: 'welcome', role: 'assistant', content: 'x', timestamp: 0 }],
  } as never);
}

describe('vistas principales en inglés', () => {
  for (const [name, view] of VIEWS) {
    it(`${name} no muestra palabras españolas`, () => {
      seed('en');
      const { container } = render(view());
      const text = visibleText(container).replace(/My part/g, '');
      const hit = text.match(SPANISH_WORDS);
      expect(hit?.[0]).toBeUndefined();
    });
  }
});

describe('vistas principales sin decimales con punto en es y de', () => {
  for (const lang of ['es', 'de'] as const) {
    for (const [name, view] of VIEWS) {
      it(`${name} (${lang}) no tiene "1.5 mm"`, () => {
        seed(lang);
        const { container } = render(view());
        const text = visibleText(container);
        // Un decimal con punto seguido de unidad (excluye versiones "0.5.0" y miles "15.190").
        const hit = text.match(/(?<![\d.])\d+\.\d{1,2}\s?(?:mm³|mm²|mm|cm|g|%|°|s|min|kg)(?![\p{L}\d])/u);
        expect(hit?.[0]).toBeUndefined();
      });
    }
  }
});
