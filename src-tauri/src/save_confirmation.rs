// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Confirmación nativa antes de sobrescribir un proyecto reabierto desde Recientes.
// La webview solo obtiene permiso de escritura sobre un archivo cuando el usuario lo elige en un
// diálogo del sistema o, para los recientes, lo acepta en un diálogo nativo la primera vez.

use crate::project_files::ProjectLocations;
use std::path::Path;
use tauri::WebviewWindow;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Stable error code the web UI maps to a notice (not a hard failure).
pub(crate) const NOT_CONFIRMED: &str = "kura-save-not-confirmed";

/// Asks the user whether a project opened from Recents may be overwritten. A trait so the
/// native dialog can be simulated in tests.
pub(crate) trait SaveConfirmer {
    fn confirm_save(&self, name: &str, folder: &str) -> bool;
}

pub(crate) struct NativeConfirmer<'a>(pub &'a WebviewWindow);

impl SaveConfirmer for NativeConfirmer<'_> {
    fn confirm_save(&self, name: &str, folder: &str) -> bool {
        self.0
            .dialog()
            .message(format!(
                "¿Guardar los cambios en {name}? Se abrió desde Recientes.\n\
                 Save changes to {name}? It was opened from Recent.\n\n{folder}"
            ))
            .title("Kura3D")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancel)
            .blocking_show()
    }
}

/// Lets a save through when `location` is already confirmed; otherwise asks once and
/// remembers an acceptance for the rest of the session. A refusal writes nothing.
pub(crate) fn authorize_save(
    locations: &ProjectLocations,
    location: &str,
    target: &Path,
    confirmer: &dyn SaveConfirmer,
) -> Result<(), String> {
    if !locations.needs_confirmation(location) {
        return Ok(());
    }
    let name = target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let folder = target.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default();
    if !confirmer.confirm_save(&name, &folder) {
        return Err(NOT_CONFIRMED.into());
    }
    locations.confirm(location);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    use std::fs;
    use std::path::PathBuf;

    struct Fake {
        answer: bool,
        asked: Cell<u32>,
    }

    impl Fake {
        fn new(answer: bool) -> Self {
            Self { answer, asked: Cell::new(0) }
        }
    }

    impl SaveConfirmer for Fake {
        fn confirm_save(&self, _name: &str, _folder: &str) -> bool {
            self.asked.set(self.asked.get() + 1);
            self.answer
        }
    }

    /// Mirrors the command: authorize, then write only when allowed.
    fn save(locations: &ProjectLocations, location: &str, confirmer: &Fake) -> Result<(), String> {
        let target = locations.resolve(location)?;
        authorize_save(locations, location, &target, confirmer)?;
        fs::write(&target, b"nuevo").map_err(|e| e.to_string())
    }

    fn setup() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.kura");
        fs::write(&path, b"original").unwrap();
        (dir, path)
    }

    #[test]
    fn recent_location_asks_the_first_time_then_not_again() {
        let (_dir, path) = setup();
        let locations = ProjectLocations::default();
        let location = locations.remember_from_recent(path.clone()).unwrap();
        let yes = Fake::new(true);
        save(&locations, &location, &yes).unwrap();
        save(&locations, &location, &yes).unwrap();
        assert_eq!(yes.asked.get(), 1);
        assert_eq!(fs::read(&path).unwrap(), b"nuevo");
    }

    #[test]
    fn cancelled_confirmation_writes_nothing_and_asks_again_next_time() {
        let (_dir, path) = setup();
        let locations = ProjectLocations::default();
        let location = locations.remember_from_recent(path.clone()).unwrap();
        let no = Fake::new(false);
        assert_eq!(save(&locations, &location, &no).unwrap_err(), NOT_CONFIRMED);
        assert_eq!(fs::read(&path).unwrap(), b"original");
        assert_eq!(save(&locations, &location, &no).unwrap_err(), NOT_CONFIRMED);
        assert_eq!(no.asked.get(), 2);
        assert_eq!(fs::read(&path).unwrap(), b"original");
    }

    #[test]
    fn dialog_chosen_location_never_asks() {
        let (_dir, path) = setup();
        let locations = ProjectLocations::default();
        let location = locations.remember(path.clone()).unwrap();
        let no = Fake::new(false);
        save(&locations, &location, &no).unwrap();
        assert_eq!(no.asked.get(), 0);
        assert_eq!(fs::read(&path).unwrap(), b"nuevo");
    }
}
