// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Registro persistente de rutas de proyectos .kura abiertos o guardados con el
// diálogo nativo, para reabrirlos con un clic. Vive en el directorio de datos de la app, guarda
// como máximo 12 rutas `.kura` y la webview nunca envía una ruta: solo el id de la entrada.

use crate::project_files::{self, is_project_path, write_atomically, MAX_PROJECT_BYTES};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::Response;
use tauri::{Manager, WebviewWindow};
use uuid::Uuid;

/// Maximum number of remembered projects.
pub(crate) const MAX_RECENT: usize = 12;
const REGISTRY_FILE: &str = "recent_projects.json";
const MAX_REGISTRY_BYTES: u64 = 256 * 1024;
const UNKNOWN_ID: &str = "kura-recent-unknown";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct Entry {
    id: String,
    path: String,
    #[serde(rename = "openedAt")]
    opened_at: u64,
}

fn enabled_by_default() -> bool {
    true
}

#[derive(Serialize, Deserialize, Debug)]
struct Registry {
    #[serde(default = "enabled_by_default")]
    enabled: bool,
    #[serde(default)]
    entries: Vec<Entry>,
}

impl Default for Registry {
    fn default() -> Self {
        Self { enabled: true, entries: Vec::new() }
    }
}

/// Entry as shown to the webview: it never carries anything the webview could send back.
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    id: String,
    name: String,
    folder: String,
    opened_at: u64,
    exists: bool,
}

#[derive(Serialize, Debug)]
pub struct RecentList {
    enabled: bool,
    items: Vec<RecentItem>,
}

impl Registry {
    /// Drops malformed entries (not `.kura`, duplicated paths or ids) and caps the list.
    fn sanitized(mut self) -> Self {
        let mut seen_paths: Vec<String> = Vec::new();
        let mut seen_ids: Vec<String> = Vec::new();
        self.entries.retain(|entry| {
            let keep = !entry.id.is_empty()
                && is_project_path(Path::new(&entry.path))
                && !seen_paths.contains(&entry.path)
                && !seen_ids.contains(&entry.id);
            if keep {
                seen_paths.push(entry.path.clone());
                seen_ids.push(entry.id.clone());
            }
            keep
        });
        self.entries.truncate(MAX_RECENT);
        self
    }

    /// Moves (or adds) `path` to the front, keeping its id. No-op when remembering is off,
    /// the path is not a `.kura` file or it is not valid UTF-8.
    fn record(&mut self, path: &Path, now: u64) {
        let Some(text) = path.to_str() else { return };
        if !self.enabled || !is_project_path(path) {
            return;
        }
        let id = match self.entries.iter().position(|e| e.path == text) {
            Some(index) => self.entries.remove(index).id,
            None => Uuid::new_v4().to_string(),
        };
        self.entries.insert(0, Entry { id, path: text.to_string(), opened_at: now });
        self.entries.truncate(MAX_RECENT);
    }

    fn resolve(&self, id: &str) -> Result<PathBuf, String> {
        self.entries
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| PathBuf::from(&entry.path))
            .ok_or_else(|| UNKNOWN_ID.to_string())
    }

    fn remove(&mut self, id: &str) -> Result<(), String> {
        let before = self.entries.len();
        self.entries.retain(|entry| entry.id != id);
        if self.entries.len() == before { Err(UNKNOWN_ID.into()) } else { Ok(()) }
    }

    fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.entries.clear();
        }
    }

    fn view(&self) -> RecentList {
        let items = self
            .entries
            .iter()
            .map(|entry| {
                let path = Path::new(&entry.path);
                RecentItem {
                    id: entry.id.clone(),
                    name: path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
                    folder: path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
                    opened_at: entry.opened_at,
                    exists: project_files::validate_project_file(path, MAX_PROJECT_BYTES as u64).is_ok(),
                }
            })
            .collect();
        RecentList { enabled: self.enabled, items }
    }
}

/// Persistent registry in the app data directory; every read-modify-write holds the lock.
pub struct RecentStore {
    file: PathBuf,
    lock: Mutex<()>,
}

impl RecentStore {
    pub fn new(directory: PathBuf) -> Self {
        Self { file: directory.join(REGISTRY_FILE), lock: Mutex::new(()) }
    }

    /// A missing, oversized or corrupt registry reads as empty (and enabled).
    fn load(&self) -> Registry {
        let usable = fs::metadata(&self.file).is_ok_and(|m| m.is_file() && m.len() <= MAX_REGISTRY_BYTES);
        if !usable {
            return Registry::default();
        }
        fs::read(&self.file)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Registry>(&bytes).ok())
            .map(Registry::sanitized)
            .unwrap_or_default()
    }

    fn save(&self, registry: &Registry) -> Result<(), String> {
        let parent = self.file.parent().ok_or("Directorio de datos inválido.")?;
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        let json = serde_json::to_vec(registry).map_err(|err| err.to_string())?;
        write_atomically(&self.file, |file| std::io::Write::write_all(file, &json)).map_err(|err| err.to_string())
    }

    fn update<R>(&self, change: impl FnOnce(&mut Registry) -> Result<R, String>) -> Result<R, String> {
        let _guard = self.lock.lock().map_err(|err| err.to_string())?;
        let mut registry = self.load();
        let result = change(&mut registry)?;
        self.save(&registry)?;
        Ok(result)
    }

    fn read<R>(&self, read: impl FnOnce(&Registry) -> R) -> Result<R, String> {
        let _guard = self.lock.lock().map_err(|err| err.to_string())?;
        Ok(read(&self.load()))
    }
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

/// Remembers a project the user opened or saved with the native dialog. Failures never
/// interrupt opening or saving.
pub(crate) fn record_best_effort(window: &WebviewWindow, path: &Path) {
    if let Some(store) = window.try_state::<RecentStore>() {
        let _ = store.update(|registry| {
            registry.record(path, now_ms());
            Ok(())
        });
    }
}

fn store<'a>(window: &'a WebviewWindow) -> Result<tauri::State<'a, RecentStore>, String> {
    if window.label() != "main" {
        return Err("Los proyectos recientes requieren la ventana principal.".into());
    }
    window.try_state::<RecentStore>().ok_or_else(|| "Registro de recientes no disponible.".to_string())
}

#[tauri::command]
pub async fn recent_projects_list(window: WebviewWindow) -> Result<RecentList, String> {
    store(&window)?.read(Registry::view)
}

/// Reopens an entry by id. The path comes from the registry, never from the webview, and is
/// validated again (still exists, regular `.kura` file, within the size cap) before reading.
#[tauri::command]
pub async fn recent_project_open(window: WebviewWindow, id: String) -> Result<Response, String> {
    let path = store(&window)?.read(|registry| registry.resolve(&id))??;
    project_files::project_response(&window, path)
}

#[tauri::command]
pub async fn recent_projects_remove(window: WebviewWindow, id: String) -> Result<RecentList, String> {
    store(&window)?.update(|registry| {
        registry.remove(&id)?;
        Ok(registry.view())
    })
}

#[tauri::command]
pub async fn recent_projects_clear(window: WebviewWindow) -> Result<RecentList, String> {
    store(&window)?.update(|registry| {
        registry.entries.clear();
        Ok(registry.view())
    })
}

/// Turns remembering on or off; turning it off also erases the stored paths.
#[tauri::command]
pub async fn recent_projects_set_enabled(window: WebviewWindow, enabled: bool) -> Result<RecentList, String> {
    store(&window)?.update(|registry| {
        registry.set_enabled(enabled);
        Ok(registry.view())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(directory: &Path, name: &str) -> PathBuf {
        let path = directory.join(name);
        fs::write(&path, b"{}").unwrap();
        path
    }

    #[test]
    fn records_most_recent_first_and_keeps_the_id_of_a_repeated_path() {
        let dir = tempfile::tempdir().unwrap();
        let (a, b) = (project(dir.path(), "a.kura"), project(dir.path(), "b.kura"));
        let mut registry = Registry::default();
        registry.record(&a, 1);
        registry.record(&b, 2);
        let a_id = registry.entries[1].id.clone();
        registry.record(&a, 3);
        assert_eq!(registry.entries.len(), 2);
        assert_eq!(registry.entries[0].id, a_id);
        assert_eq!(registry.entries[0].opened_at, 3);
        assert_eq!(registry.resolve(&a_id).unwrap(), a);
    }

    #[test]
    fn list_is_capped_at_twelve() {
        let dir = tempfile::tempdir().unwrap();
        let mut registry = Registry::default();
        for n in 0..15 {
            registry.record(&project(dir.path(), &format!("p{n}.kura")), n);
        }
        assert_eq!(registry.entries.len(), MAX_RECENT);
        assert!(registry.entries[0].path.ends_with("p14.kura"));
        assert!(!registry.entries.iter().any(|e| e.path.ends_with("p0.kura")));
    }

    #[test]
    fn only_kura_paths_are_recorded_or_loaded() {
        let dir = tempfile::tempdir().unwrap();
        let mut registry = Registry::default();
        registry.record(&project(dir.path(), "modelo.stl"), 1);
        assert!(registry.entries.is_empty());

        let tampered = Registry {
            enabled: true,
            entries: vec![
                Entry { id: "1".into(), path: dir.path().join("x.txt").to_string_lossy().into(), opened_at: 1 },
                Entry { id: "2".into(), path: dir.path().join("ok.kura").to_string_lossy().into(), opened_at: 2 },
            ],
        }
        .sanitized();
        assert_eq!(tampered.entries.len(), 1);
        assert_eq!(tampered.entries[0].id, "2");
    }

    #[test]
    fn unknown_id_is_rejected_for_open_and_remove() {
        let mut registry = Registry::default();
        assert_eq!(registry.resolve("nope").unwrap_err(), UNKNOWN_ID);
        assert_eq!(registry.remove("nope").unwrap_err(), UNKNOWN_ID);
    }

    #[test]
    fn missing_file_is_flagged_and_cannot_be_opened() {
        let dir = tempfile::tempdir().unwrap();
        let path = project(dir.path(), "a.kura");
        let mut registry = Registry::default();
        registry.record(&path, 1);
        assert!(registry.view().items[0].exists);
        fs::remove_file(&path).unwrap();
        assert!(!registry.view().items[0].exists);
        assert_eq!(project_files::validate_project_file(&path, 1024).unwrap_err(), "kura-project-missing");
    }

    #[test]
    fn changed_extension_directory_and_oversized_files_fail_validation() {
        let dir = tempfile::tempdir().unwrap();
        let renamed = project(dir.path(), "a.txt");
        assert_eq!(project_files::validate_project_file(&renamed, 1024).unwrap_err(), "kura-project-invalid");
        let folder = dir.path().join("carpeta.kura");
        fs::create_dir(&folder).unwrap();
        assert_eq!(project_files::validate_project_file(&folder, 1024).unwrap_err(), "kura-project-invalid");
        let big = dir.path().join("grande.kura");
        fs::write(&big, vec![0u8; 2048]).unwrap();
        assert_eq!(project_files::validate_project_file(&big, 1024).unwrap_err(), "kura-project-too-large");
        assert!(project_files::validate_project_file(&big, 4096).is_ok());
    }

    #[test]
    fn disabling_erases_paths_and_stops_recording() {
        let dir = tempfile::tempdir().unwrap();
        let mut registry = Registry::default();
        registry.record(&project(dir.path(), "a.kura"), 1);
        registry.set_enabled(false);
        assert!(registry.entries.is_empty());
        registry.record(&project(dir.path(), "b.kura"), 2);
        assert!(registry.entries.is_empty());
        registry.set_enabled(true);
        registry.record(&project(dir.path(), "b.kura"), 3);
        assert_eq!(registry.entries.len(), 1);
    }

    #[test]
    fn store_persists_across_instances_and_survives_a_corrupt_file() {
        let data = tempfile::tempdir().unwrap();
        let projects = tempfile::tempdir().unwrap();
        let path = project(projects.path(), "a.kura");
        let store = RecentStore::new(data.path().join("sub"));
        store.update(|r| { r.record(&path, 5); Ok(()) }).unwrap();

        let again = RecentStore::new(data.path().join("sub"));
        let list = again.read(Registry::view).unwrap();
        assert_eq!(list.items.len(), 1);
        assert_eq!(list.items[0].name, "a.kura");
        assert_eq!(list.items[0].opened_at, 5);

        fs::write(data.path().join("sub").join(REGISTRY_FILE), b"{not json").unwrap();
        let list = again.read(Registry::view).unwrap();
        assert!(list.enabled && list.items.is_empty());
    }
}
