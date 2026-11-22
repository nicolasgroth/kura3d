/**
 * @file src/components/viewport/GroupEnterOnDoubleClick.tsx
 * @description Doble clic en el visor sobre un objeto agrupado «entra» un nivel en su grupo (el primer
 * clic ya eligió el objeto: el store recuerda cuál). Escape sale (atajo global).
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useKuraStore } from '../../store/useKuraStore';

export function GroupEnterOnDoubleClick(): null {
  const element = useThree((s) => s.gl.domElement);
  useEffect(() => {
    const onDoubleClick = () => {
      const st = useKuraStore.getState();
      if (st.activeTool !== 'select' || st.groups.length === 0 || !st.lastPickedId) return;
      if (!st.selectedIds.includes(st.lastPickedId)) return;
      st.enterGroup(st.lastPickedId);
    };
    element.addEventListener('dblclick', onDoubleClick);
    return () => element.removeEventListener('dblclick', onDoubleClick);
  }, [element]);
  return null;
}
