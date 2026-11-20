// Autor: Nicolás Groth <ngroth@gmail.com>
//! Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Script de compilación de Tauri v2 encargado de generar metadatos,
// recursos de Windows (icono y manifiesto) y permisos de capacidades.

fn main() {
    // Ejecuta la macro de construcción oficial de Tauri v2
    tauri_build::build()
}
