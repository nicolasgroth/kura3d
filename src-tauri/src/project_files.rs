// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Comandos nativos de Tauri para abrir y guardar proyectos .kura con
// autorización de rutas por sesión, escritura atómica y límite de tamaño.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tempfile::NamedTempFile;
use uuid::Uuid;

// Keep this limit in sync with MAX_PROJECT_BYTES in the web project codec.
pub(crate) const MAX_PROJECT_BYTES: usize = 128 * 1024 * 1024;
const MAX_METADATA_BYTES: usize = 64 * 1024;
const TOO_LARGE: &str = "kura-project-too-large";

/// Tracks files chosen in the main window for the lifetime of the desktop process.
/// Locations that came from the recents registry (no native dialog) are flagged until the
/// user confirms overwriting them in a native dialog (see `save_confirmation`).
#[derive(Default)]
pub struct ProjectLocations(Mutex<LocationState>);

#[derive(Default)]
struct LocationState {
    paths: HashMap<String, PathBuf>,
    unconfirmed: HashSet<String>,
}

impl ProjectLocations {
    /// Registers a path the user picked in a native dialog: writable without further asking.
    pub(crate) fn remember(&self, target: PathBuf) -> Result<String, String> {
        self.remember_with(target, true)
    }

    /// Registers a path reopened from the recents registry. A path already chosen in a
    /// dialog this session stays confirmed; otherwise it needs confirmation before saving.
    pub(crate) fn remember_from_recent(&self, target: PathBuf) -> Result<String, String> {
        self.remember_with(target, false)
    }

    fn remember_with(&self, target: PathBuf, confirmed: bool) -> Result<String, String> {
        let mut state = self.0.lock().map_err(|err| err.to_string())?;
        let existing = state.paths.iter().find(|(_, path)| **path == target).map(|(l, _)| l.clone());
        let Some(location) = existing else {
            let location = Uuid::new_v4().to_string();
            state.paths.insert(location.clone(), target);
            if !confirmed {
                state.unconfirmed.insert(location.clone());
            }
            return Ok(location);
        };
        if confirmed {
            state.unconfirmed.remove(&location);
        }
        Ok(location)
    }

    pub(crate) fn resolve(&self, location: &str) -> Result<PathBuf, String> {
        self.0
            .lock()
            .map_err(|err| err.to_string())?
            .paths
            .get(location)
            .cloned()
            .ok_or_else(|| "El destino original de este proyecto ya no está disponible.".into())
    }

    pub(crate) fn needs_confirmation(&self, location: &str) -> bool {
        self.0.lock().map(|state| state.unconfirmed.contains(location)).unwrap_or(true)
    }

    pub(crate) fn confirm(&self, location: &str) {
        if let Ok(mut state) = self.0.lock() {
            state.unconfirmed.remove(location);
        }
    }
}

#[derive(Deserialize)]
struct SaveRequest {
    name: String,
    location: Option<String>,
}

#[derive(Serialize)]
pub struct ProjectFile {
    name: String,
    location: String,
}

fn project_dialog(
    window: &WebviewWindow,
) -> Result<tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>, String> {
    if window.label() != "main" {
        return Err("El diálogo de proyectos requiere la ventana principal.".into());
    }
    let dialog = window.dialog().file().add_filter("Kurra3D Studio", &["kura"]);
    #[cfg(desktop)]
    let dialog = dialog.set_parent(window);
    Ok(dialog)
}

pub(crate) fn is_project_path(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("kura"))
}

/// The suggested name may only be a bare `*.kura` file name: no directories,
/// drive prefixes or traversal components.
fn validate_new_project_name(name: &str) -> Result<(), String> {
    let path = Path::new(name);
    if !matches!(path.components().next(), Some(Component::Normal(_)))
        || path.file_name() != Some(path.as_os_str())
        || !is_project_path(path)
    {
        return Err("El nombre del proyecto debe tener extensión .kura.".into());
    }
    Ok(())
}

fn selected_path(selected: FilePath) -> Result<PathBuf, String> {
    let path = selected.into_path().map_err(|err| err.to_string())?;
    if !is_project_path(&path) {
        return Err("Elige un archivo con extensión .kura.".into());
    }
    let parent = path.parent().ok_or("El archivo no tiene directorio.")?;
    let name = path.file_name().ok_or("El archivo no tiene nombre.")?;
    let parent = parent.canonicalize().map_err(|err| err.to_string())?;
    Ok(parent.join(name))
}

fn file_name(path: &Path) -> Result<String, String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .ok_or_else(|| "El archivo no tiene nombre.".into())
}

// A four-byte little-endian length followed by UTF-8 JSON and raw project bytes
// avoids encoding large geometry buffers as JSON arrays over IPC.
fn read_save_request(body: &InvokeBody) -> Result<(SaveRequest, &[u8]), String> {
    let InvokeBody::Raw(body) = body else {
        return Err("El proyecto debe enviarse como datos binarios.".into());
    };
    let (length, rest) = body
        .split_first_chunk::<4>()
        .ok_or("Solicitud de guardado incompleta.")?;
    let length = u32::from_le_bytes(*length) as usize;
    if length > MAX_METADATA_BYTES || length > rest.len() {
        return Err("Metadatos de guardado inválidos.".into());
    }
    let (metadata, bytes) = rest.split_at(length);
    if bytes.len() > MAX_PROJECT_BYTES {
        return Err(TOO_LARGE.into());
    }
    let request = serde_json::from_slice(metadata).map_err(|err| err.to_string())?;
    Ok((request, bytes))
}

pub(crate) fn write_atomically(
    target: &Path,
    write: impl FnOnce(&mut File) -> io::Result<()>,
) -> io::Result<()> {
    match fs::symlink_metadata(target) {
        Ok(metadata) if !metadata.is_file() => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "El destino no es un archivo normal.",
            ));
        }
        Err(err) if err.kind() != io::ErrorKind::NotFound => return Err(err),
        _ => {}
    }
    let parent = target.parent().ok_or(io::ErrorKind::InvalidInput)?;
    let mut temporary = NamedTempFile::new_in(parent)?;
    write(temporary.as_file_mut())?;
    temporary.as_file().sync_all()?;
    temporary.persist(target)?;
    Ok(())
}

/// Checks that `target` is a regular `.kura` file within the size cap. Errors are stable
/// codes the web UI maps to messages (`kura-project-missing`, `kura-project-invalid`,
/// `kura-project-too-large`).
pub(crate) fn validate_project_file(target: &Path, max_bytes: u64) -> Result<fs::Metadata, String> {
    if !is_project_path(target) {
        return Err("kura-project-invalid".into());
    }
    let metadata = fs::symlink_metadata(target).map_err(|err| {
        if err.kind() == io::ErrorKind::NotFound {
            "kura-project-missing".to_string()
        } else {
            err.to_string()
        }
    })?;
    if !metadata.is_file() {
        return Err("kura-project-invalid".into());
    }
    if metadata.len() > max_bytes {
        return Err(TOO_LARGE.into());
    }
    Ok(metadata)
}

/// Reads the project at `target` and builds the IPC response (length-prefixed JSON
/// metadata followed by the raw project bytes), registering its session location.
pub(crate) fn project_response(
    window: &WebviewWindow,
    target: PathBuf,
    from_recent: bool,
) -> Result<Response, String> {
    let metadata = validate_project_file(&target, MAX_PROJECT_BYTES as u64)?;
    let file = File::open(&target).map_err(|err| err.to_string())?;
    let name = file_name(&target)?;
    let locations = window.state::<ProjectLocations>();
    let location = if from_recent {
        locations.remember_from_recent(target.clone())?
    } else {
        locations.remember(target.clone())?
    };
    let metadata_bytes =
        serde_json::to_vec(&ProjectFile { name, location }).map_err(|err| err.to_string())?;
    let prefix_len = 4 + metadata_bytes.len();
    let mut response = Vec::with_capacity(prefix_len + metadata.len() as usize);
    response.extend_from_slice(&(metadata_bytes.len() as u32).to_le_bytes());
    response.extend_from_slice(&metadata_bytes);
    file.take(MAX_PROJECT_BYTES as u64 + 1)
        .read_to_end(&mut response)
        .map_err(|err| err.to_string())?;
    if response.len() - prefix_len > MAX_PROJECT_BYTES {
        return Err(TOO_LARGE.into());
    }
    crate::recent_projects::record_best_effort(window, &target);
    Ok(Response::new(response))
}

#[tauri::command]
pub async fn open_kura_project(window: WebviewWindow) -> Result<Response, String> {
    let Some(selected) = project_dialog(&window)?.blocking_pick_file() else {
        return Ok(Response::new(Vec::<u8>::new()));
    };
    project_response(&window, selected_path(selected)?, false)
}

#[tauri::command]
pub async fn save_kura_project(
    window: WebviewWindow,
    request: Request<'_>,
) -> Result<Option<ProjectFile>, String> {
    let dialog = project_dialog(&window)?;
    let (request, bytes) = read_save_request(request.body())?;
    let locations = window.state::<ProjectLocations>();
    let target = if let Some(location) = request.location {
        let target = locations.resolve(&location)?;
        // Locations reopened from Recents need a native confirmation before the first write.
        if locations.needs_confirmation(&location) {
            let (win, path) = (window.clone(), target.clone());
            tauri::async_runtime::spawn_blocking(move || {
                let state = win.state::<ProjectLocations>();
                let confirmer = crate::save_confirmation::NativeConfirmer(&win);
                crate::save_confirmation::authorize_save(&state, &location, &path, &confirmer)
            })
            .await
            .map_err(|err| err.to_string())??;
        }
        target
    } else {
        validate_new_project_name(&request.name)?;
        let Some(selected) = dialog.set_file_name(request.name).blocking_save_file() else {
            return Ok(None);
        };
        selected_path(selected)?
    };
    let name = file_name(&target)?;
    write_atomically(&target, |file| file.write_all(bytes)).map_err(|err| err.to_string())?;
    let location = locations.remember(target.clone())?;
    crate::recent_projects::record_best_effort(&window, &target);
    Ok(Some(ProjectFile { name, location }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_write_preserves_previous_project_and_removes_temporary_file() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();

        let result = write_atomically(&project, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("write failed"))
        });

        assert!(result.is_err());
        assert_eq!(fs::read(&project).unwrap(), b"original");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn successful_write_replaces_existing_project() {
        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();

        write_atomically(&project, |file| file.write_all(b"new")).unwrap();

        assert_eq!(fs::read(&project).unwrap(), b"new");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[cfg(windows)]
    #[test]
    fn locked_destination_survives_failed_replacement() {
        use std::os::windows::fs::OpenOptionsExt;

        let directory = tempfile::tempdir().unwrap();
        let project = directory.path().join("modelo.kura");
        fs::write(&project, b"original").unwrap();
        let lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(0)
            .open(&project)
            .unwrap();

        let result = write_atomically(&project, |file| file.write_all(b"new"));

        drop(lock);
        assert!(result.is_err());
        assert_eq!(fs::read(&project).unwrap(), b"original");
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn suggested_project_names_cannot_escape_the_dialog() {
        for valid in ["modelo.kura", "Modelo Final.KURA", "pieza-2.kura"] {
            assert!(validate_new_project_name(valid).is_ok(), "{valid}");
        }
        let mut invalid_names = vec![
            "",
            "modelo",
            "modelo.stl",
            "modelo.kura.exe",
            "../modelo.kura",
            "..",
            "carpeta/modelo.kura",
            "/tmp/modelo.kura",
        ];
        if cfg!(windows) {
            invalid_names.extend(["carpeta\\modelo.kura", "C:\\modelo.kura", "C:modelo.kura"]);
        }
        for invalid in invalid_names {
            assert!(validate_new_project_name(invalid).is_err(), "{invalid}");
        }
    }

    #[test]
    fn selected_paths_must_be_kura_files_in_an_existing_directory() {
        let directory = tempfile::tempdir().unwrap();
        let chosen = directory.path().join("modelo.kura");
        let resolved = selected_path(FilePath::Path(chosen)).unwrap();
        assert!(resolved.is_absolute());
        assert_eq!(resolved.file_name().unwrap(), "modelo.kura");

        let wrong_extension = directory.path().join("modelo.stl");
        assert!(selected_path(FilePath::Path(wrong_extension)).is_err());
        let missing_parent = directory.path().join("no-existe").join("modelo.kura");
        assert!(selected_path(FilePath::Path(missing_parent)).is_err());
    }

    #[test]
    fn oversized_or_malformed_save_requests_are_rejected() {
        let metadata = br#"{"name":"modelo.kura","location":null}"#;
        let mut body = (metadata.len() as u32).to_le_bytes().to_vec();
        body.extend_from_slice(metadata);
        body.extend_from_slice(b"bytes");
        let body = InvokeBody::Raw(body);
        let (request, bytes) = read_save_request(&body).unwrap();
        assert_eq!(request.name, "modelo.kura");
        assert_eq!(bytes, b"bytes");

        let mut lying_length = (u32::MAX).to_le_bytes().to_vec();
        lying_length.extend_from_slice(metadata);
        assert!(read_save_request(&InvokeBody::Raw(lying_length)).is_err());
        assert!(read_save_request(&InvokeBody::Raw(vec![1, 0])).is_err());
        assert!(read_save_request(&InvokeBody::Json(serde_json::json!({}))).is_err());
    }

    #[test]
    fn location_has_to_match_a_previously_selected_file() {
        let locations = ProjectLocations::default();
        let path = PathBuf::from("modelo.kura");
        assert!(locations.resolve("modelo.kura").is_err());
        let location = locations.remember(path.clone()).unwrap();
        assert_eq!(locations.resolve(&location).unwrap(), path);
        assert_eq!(locations.remember(path).unwrap(), location);
    }

    #[test]
    fn recent_locations_are_flagged_until_confirmed_or_chosen_in_a_dialog() {
        let locations = ProjectLocations::default();
        let recent = locations.remember_from_recent(PathBuf::from("a.kura")).unwrap();
        assert!(locations.needs_confirmation(&recent));
        locations.confirm(&recent);
        assert!(!locations.needs_confirmation(&recent));

        let other = locations.remember_from_recent(PathBuf::from("b.kura")).unwrap();
        assert!(locations.needs_confirmation(&other));
        // Picking the same file in a native dialog confirms it.
        assert_eq!(locations.remember(PathBuf::from("b.kura")).unwrap(), other);
        assert!(!locations.needs_confirmation(&other));

        // Reopening from Recents never downgrades a dialog-chosen path.
        let chosen = locations.remember(PathBuf::from("c.kura")).unwrap();
        assert_eq!(locations.remember_from_recent(PathBuf::from("c.kura")).unwrap(), chosen);
        assert!(!locations.needs_confirmation(&chosen));
    }
}
