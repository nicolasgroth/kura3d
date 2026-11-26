/**
 * @file src/components/magnet/MagnetPresetPicker.tsx
 * @description Preajustes del alojamiento de imán: el selector común de agregados (`AddonPresetPicker`) con los
 * imanes incluidos y los del usuario (`useMagnetPresets`). Elegir uno carga sus medidas; «Personalizado» cuando no
 * calzan con ninguno; guardar con nombre y eliminar el propio con Deshacer.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import React, { useMemo } from 'react';
import { BUILTIN_MAGNET_PRESETS, magnetSizeLabel, sameMagnet } from '../../core/addons/magnetPresets';
import type { MagnetParams } from '../../core/addons/magnetPocket';
import { t } from '../../i18n';
import { setMagnetParams, useMagnetPanel, useMagnetPresets } from '../../store/magnetPanel';
import { useKuraStore } from '../../store/useKuraStore';
import type { LanguageCode } from '../../types/kura';
import { AddonPresetPicker } from '../addons/AddonPresetPicker';

export function builtinPresetLabel(values: MagnetParams, language: LanguageCode): string {
  const size = magnetSizeLabel(values, language);
  const key = values.shape === 'square' ? 'magnet.preset.square' : values.shape === 'rect' ? 'magnet.preset.rect' : 'magnet.preset.round';
  return t(language, key, { size });
}

export const MagnetPresetPicker: React.FC = () => {
  const language = useKuraStore((s) => s.language);
  const params = useMagnetPanel((s) => s.params);
  const builtins = useMemo(
    () => BUILTIN_MAGNET_PRESETS.map((p) => ({ id: p.id, values: p.values, label: builtinPresetLabel(p.values, language) })),
    [language],
  );
  return (
    <AddonPresetPicker
      textPrefix="magnet"
      testId="magnet"
      values={params}
      builtins={builtins}
      presets={useMagnetPresets}
      same={sameMagnet}
      // Un preajuste trae todo el imán: sin ancho ni giro propios no hereda los del rectangular anterior.
      onPick={(v) => setMagnetParams({ widthMm: undefined, turn90: undefined, ...v })}
    />
  );
};
