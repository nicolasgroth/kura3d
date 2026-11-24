# Guías de uso de Kura3D

Guías paso a paso, pensadas para quien imprime en 3D y no programa. Cada una tiene pasos numerados, capturas hechas desde la propia app y un apartado de problemas frecuentes. Solo describen lo que funciona hoy; lo que viene está en el [roadmap](../ROADMAP.md).

| Guía | Para qué |
|---|---|
| [Primeros pasos](primeros-pasos.md) | La pantalla, los ejes, crear piezas, moverlas, girarlas, escalarlas y deshacer |
| [Importar y reparar](importar-y-reparar.md) | Abrir STL, 3MF, OBJ o PLY; avisos de unidades; estado de la malla; reparar y simplificar |
| [Dividir para imprimir](dividir-para-imprimir.md) | Partir una pieza más grande que tu cama, con uniones, códigos de pieza y armado |
| [Ajustar a la impresora](ajustar-a-la-impresora.md) | Escalar, girar o dividir para que la pieza quepa en tu cama; tus propias camas |
| [Cortar y ahuecar](cortar-y-ahuecar.md) | Corte con un plano, dónde dejar la mitad que conservas, ahuecar |
| [Sólidos negativos y restas](solidos-negativos-y-restas.md) | Agujeros y rebajes con negativos; unir, restar e intersectar |
| [Objetos de referencia](objetos-de-referencia.md) | Importar una pieza real (placa, tornillo) para diseñar a su medida, sin imprimirla ni exportarla |
| [Comprobar encaje](comprobar-encaje.md) | Saber si una placa entra en su bolsillo o una tapa cierra: choques y holguras entre piezas y referencias |
| [Grupos y escena](grupos-y-escena.md) | Agrupar piezas y ordenarlas en el panel Escena |
| [Medir](medir.md) | Distancias, ángulos, áreas, volumen y capacidad de un recipiente |
| [Colores y pintura](colores-y-pintura.md) | Pintar caras y separar por colores para multicolor |
| [Generadores](generadores.md) | Texto 3D, SVG, imagen a 3D, roscas ISO y moldes |
| [Exportar](exportar.md) | STL, 3MF con grupos y colores, selección o escena |
| [Guardar y recuperar](guardar-y-recuperar.md) | Proyecto `.kura` y borrador de recuperación |

Para conectar un asistente de IA a Kura3D, mira el [servidor MCP](../MCP.md).

## Convenciones de estas guías

- **X** va hacia la derecha, **Y** hacia el fondo y **Z** hacia arriba (altura). Las medidas están en milímetros salvo que cambies la unidad en *Ajustes*.
- `Ctrl` es `⌘` en Mac. **Ctrl+K** abre la paleta de comandos (busca cualquier acción por nombre) y **?** muestra todos los atajos.
- Las capturas se generan con `npm run docs:capturas` (ver abajo), en tema claro y en español.

## Cómo se regeneran las capturas

Cuando cambie la interfaz, las imágenes de `img/` se vuelven a generar sin tocarlas a mano:

```bash
npx vite --host 127.0.0.1 --port 5239 --strictPort &      # la web de Kura3D
KURA_URL=http://127.0.0.1:5239/ npm run docs:capturas       # genera docs/guia/img/*.png
npm run docs:capturas -- -g medir                           # solo una guía
npm run docs:enlaces                                        # revisa enlaces e imágenes
```

El generador es [e2e/docs/](../../e2e/docs/): arma cada escena con piezas creadas en la propia app (nunca modelos de terceros) y guarda PNG de 1440×900. La animación de Dividir para imprimir es un video WebM que genera el mismo script.
