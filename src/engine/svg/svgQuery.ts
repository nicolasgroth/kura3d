/**
 * @file src/engine/svg/svgQuery.ts
 * @description `querySelectorAll`/`querySelector` mínimos para el árbol de `@xmldom/xmldom`, que no
 * los trae. `THREE.SVGLoader` (desde r18x) los usa en `parseGradients` con listas de etiquetas
 * (`'linearGradient, radialGradient'`, `'stop'`). Se soporta solo: etiquetas separadas por coma,
 * `#id` y `*`. Cualquier otro selector no encuentra nada (no lanza). Procesa archivos de terceros:
 * sin regex, recorrido iterativo (sin recursión) y lineal en nodos, con topes al selector.
 * @author Nicolás Groth <ngroth@gmail.com>
 * @organization ISGROTH — Innovación y Soluciones GROTH
 * @license MIT
 */

/** Lo que se usa de un nodo de xmldom. */
export type QueryNode = {
  nodeType: number;
  nodeName: string;
  localName?: string | null;
  childNodes: ArrayLike<QueryNode>;
  getAttribute?(name: string): string | null;
};

/** Topes: un selector legítimo de SVGLoader mide pocas decenas de caracteres. */
const MAX_SELECTOR_LENGTH = 256;
const MAX_SELECTOR_PARTS = 16;

type Matcher = { tags: Set<string>; ids: Set<string>; any: boolean };

function isNameChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 45 || code === 95 || code === 58 // - _ :
  );
}

function isName(text: string): boolean {
  if (text.length === 0) return false;
  for (let i = 0; i < text.length; i++) if (!isNameChar(text.charCodeAt(i))) return false;
  return true;
}

/** Interpreta el selector; `null` si tiene alguna parte no soportada (entonces no coincide nada). */
function compile(selector: string): Matcher | null {
  if (selector.length > MAX_SELECTOR_LENGTH) return null;
  const parts = selector.split(',');
  if (parts.length > MAX_SELECTOR_PARTS) return null;
  const m: Matcher = { tags: new Set(), ids: new Set(), any: false };
  for (const raw of parts) {
    const part = raw.trim();
    if (part === '*') m.any = true;
    else if (part.startsWith('#') && isName(part.slice(1))) m.ids.add(part.slice(1));
    else if (isName(part)) m.tags.add(part);
    else return null;
  }
  return m;
}

function matches(node: QueryNode, m: Matcher): boolean {
  if (m.any) return true;
  // En documentos XML el navegador compara la etiqueta sin prefijo (`svg:stop` coincide con `stop`).
  const local = node.localName ?? node.nodeName;
  if (m.tags.has(local) || m.tags.has(node.nodeName)) return true;
  if (m.ids.size > 0) {
    const id = node.getAttribute?.('id');
    if (id && m.ids.has(id)) return true;
  }
  return false;
}

/** Recorre los descendientes de `root` en orden de documento; `visit` devuelve `true` para cortar. */
function walk(root: QueryNode, visit: (n: QueryNode) => boolean): void {
  // Pila explícita de (nodo, índice del siguiente hijo): sin recursión, cada nodo se visita una vez.
  const nodes: QueryNode[] = [root];
  const next: number[] = [0];
  while (nodes.length > 0) {
    const top = nodes.length - 1;
    const parent = nodes[top];
    const i = next[top];
    if (i >= parent.childNodes.length) {
      nodes.pop();
      next.pop();
      continue;
    }
    next[top] = i + 1;
    const child = parent.childNodes[i];
    if (child.nodeType !== 1) continue;
    if (visit(child)) return;
    nodes.push(child);
    next.push(0);
  }
}

/** Equivalente a `root.querySelectorAll(selector)` (devuelve un arreglo, iterable como `NodeList`). */
export function querySelectorAllIn(root: QueryNode, selector: string): QueryNode[] {
  const m = compile(String(selector));
  const out: QueryNode[] = [];
  if (!m) return out;
  walk(root, (n) => {
    if (matches(n, m)) out.push(n);
    return false;
  });
  return out;
}

/** Equivalente a `root.querySelector(selector)`: el primero en orden de documento o `null`. */
export function querySelectorIn(root: QueryNode, selector: string): QueryNode | null {
  const m = compile(String(selector));
  if (!m) return null;
  let found: QueryNode | null = null;
  walk(root, (n) => {
    if (!matches(n, m)) return false;
    found = n;
    return true;
  });
  return found;
}

/** Métodos para colgar de un nodo: usan `this`, así todos los nodos comparten las mismas funciones. */
export const queryMethods = {
  querySelectorAll(this: QueryNode, selector: string): QueryNode[] {
    return querySelectorAllIn(this, selector);
  },
  querySelector(this: QueryNode, selector: string): QueryNode | null {
    return querySelectorIn(this, selector);
  },
};
