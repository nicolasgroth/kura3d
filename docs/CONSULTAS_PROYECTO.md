# Consultas pendientes

Dudas que necesitan al autor. Cada una dice qué se hace mientras tanto, para que nada quede detenido. Las ya resueltas pasan a [DECISIONES.md](DECISIONES.md).

Actualizado el 23 de noviembre de 2026 a las 22:15.

## Abiertas

Ninguna detiene el trabajo. Lo ya respondido está en `docs/DECISIONES.md`. Actualizado el 26-nov a las 14:50.

### 1. Alerta de seguridad de `glib` en GitHub
Severidad media, en las librerías de Linux que usa Tauri (no en código propio), sin arreglo hasta que Tauri actualice su base. Propuesta: descartarla en GitHub como «sin arreglo disponible». Es una acción sobre la cuenta: se hace solo con tu visto bueno.

### 2. Probar el 3MF con bandejas en OrcaSlicer y Bambu Studio
Funciona en Elegoo Slicer. Falta abrir `kurra-3-placas-v12.3mf` (en `.eval-tmp/laminador/v12/`) en los otros dos para saber si la misma receta sirve tal cual.

### 3. Acuerdo de contribuyentes: revisión legal y firma
`CLA.md` es una adaptación del acuerdo individual de Apache (v2.2): cambia el receptor a ti, quita la cláusula propia de una fundación sin fines de lucro y el formulario en papel. Está marcado como pendiente de revisión legal y, hasta entonces, la guía de contribución dice que no se incorporan aportes de terceros. Falta: (a) que un abogado lo revise; (b) decidir si la firma se automatiza con una aplicación de GitHub (se instala en tu cuenta) o basta el comentario en el pedido de cambios, que es lo que dice hoy.

### 4. Licencia de las recetas de ejemplo y de terceros
Las recetas de ejemplo que trae la app siguen marcadas como MIT, y la lista de licencias que se aceptan en recetas de terceros no cambió. Es coherente dejarlo así (son datos, y que los ejemplos sean permisivos facilita que otros partan de ellos), pero es tu decisión: ¿las recetas propias quedan en MIT o pasan a AGPL, y se agrega AGPL a la lista aceptada?
