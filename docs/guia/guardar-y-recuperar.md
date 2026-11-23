# Guardar y recuperar

Tu trabajo se guarda en un **proyecto `.kura`**, que conserva la escena, los materiales, la pintura y el historial de deshacer. Además, Kura3D hace un **borrador automático** por si cierras o se cae algo.

## Guardar un proyecto

1. Abre el menú **Proyecto** (barra superior). Arriba ves el nombre («Escena sin título») y si hay *Cambios sin guardar*; un punto rojo junto al botón avisa lo mismo.
2. Elige **Guardar proyecto** (**Ctrl+S**). La primera vez te pide un nombre. **Guardar proyecto como…** (**Ctrl+Mayús+S**) crea una copia con otro nombre.
3. **Nuevo proyecto** (**Ctrl+N**) y **Abrir proyecto…** (**Ctrl+O**) te preguntan antes si hay cambios sin guardar.

En la versión web, guardar descarga el archivo `.kura` a tu carpeta de descargas y un aviso lo confirma; para abrirlo, usa **Abrir proyecto…** o arrástralo al visor. En la aplicación de escritorio, el menú también lista los **Proyectos recientes** (se puede desactivar en *Ajustes*).

![Menú Proyecto con nuevo, abrir, guardar y guardar como](img/guardar-y-recuperar-01-menu.png)

## El borrador de recuperación

Mientras trabajas, la barra de estado muestra «Guardando borrador…» y luego «Borrador local guardado». Es una copia de seguridad automática en tu navegador o equipo, no un reemplazo de guardar el proyecto.

1. Si cierras la pestaña o la app sin guardar y vuelves a abrir Kura3D, aparece arriba el aviso **Borradores locales** con la fecha del borrador.
2. Pulsa **Recuperar** para volver a tu escena, **Descartar** para borrarlo o **Posponer** para decidir después.
3. Si hay varios borradores, **Elegir borrador** te deja escoger.

![Aviso Borradores locales al reabrir: Recuperar o Descartar](img/guardar-y-recuperar-02-borrador.png)

Con escenas muy pesadas el borrador se guarda por bloques; si no cabe, Kura3D lo dice en la barra de estado en vez de fallar en silencio.

## Problemas frecuentes

- **No encuentro mi archivo guardado en la web:** busca `.kura` en la carpeta de descargas del navegador.
- **No aparece el aviso de borrador:** los borradores son locales a ese navegador y perfil; no los verás en otro navegador, en modo privado ni tras borrar los datos del sitio.
- **Guardé pero el punto rojo sigue:** hubo cambios después de guardar; guarda otra vez.
- **Abrí un proyecto y perdí el actual:** Kura3D pregunta antes; si lo descartaste, mira si queda un borrador.

Anterior: [Exportar](exportar.md) · [Índice](README.md)
