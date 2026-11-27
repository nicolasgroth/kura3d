/**
 * @file src/components/split/assemblyInstructionsDownload.ts
 * @description «Descargar instrucciones» del panel de armado: arma el Markdown o el HTML imprimible, lo guarda con el
 * diálogo nativo (escritorio) o como descarga (web) y avisa el resultado. Un fallo de escritura se avisa, no se oculta.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license AGPL-3.0-or-later
 */

import { instructionsFileName, instructionsHtml, instructionsMarkdown, type InstructionsDocument } from '../../core/assembly/assemblyInstructionsExport';
import { t } from '../../i18n';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { saveBinaryFile } from '../../utils/platformBridge';

export async function downloadInstructions(language: LanguageCode, doc: InstructionsDocument, format: 'md' | 'html'): Promise<boolean> {
  const name = instructionsFileName(doc.model, format);
  const text = format === 'md' ? instructionsMarkdown(language, doc) : instructionsHtml(language, doc);
  const filters = [format === 'md' ? { name: 'Markdown', extensions: ['md'] } : { name: 'HTML', extensions: ['html'] }];
  const toast = useKuraStore.getState().addToast;
  try {
    const saved = await saveBinaryFile(name, new TextEncoder().encode(text), filters);
    if (saved) toast(t(language, 'asmInstr.download.done', { name }), 'success');
    return saved;
  } catch {
    toast(t(language, 'asmInstr.download.failed'), 'error');
    return false;
  }
}
