// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Punto de entrada principal de escritorio para Kurra3D Studio en Windows/macOS/Linux.
// Delega la inicialización completa de Tauri v2 al módulo de librería `kura3d_lib`.

// Evita abrir una ventana de consola adicional en compilaciones Release de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kura3d_lib::run()
}
