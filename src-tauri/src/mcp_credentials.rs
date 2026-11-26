// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: AGPL-3.0-or-later
// Descripción: Token del puente MCP local guardado en el almacén de credenciales del
// sistema operativo (crate `keyring`), en una ranura propia `mcp-bridge` separada de
// las claves IA. A diferencia de esas claves, el webview sí necesita leer el token:
// lo usa para conectarse al puente en 127.0.0.1 y para que el usuario lo copie a la
// configuración de su cliente MCP. Nunca se escribe en `localStorage` ni en logs, y
// los errores no incluyen el valor.

use crate::ai_credentials::SecretStore;

const SERVICE: &str = "com.nicolasgroth.kura3d.mcp";
/// Única ranura permitida.
pub const ACCOUNT: &str = "mcp-bridge";
/// Mismo mínimo que exige el servidor MCP (`MIN_TOKEN_LENGTH`).
pub const MIN_TOKEN_CHARS: usize = 16;
const MAX_TOKEN_CHARS: usize = 512;

/// Almacén real sobre el llavero del sistema operativo.
pub struct OsMcpTokenStore;

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, ACCOUNT).map_err(|_| "mcp-token-store-unavailable".to_string())
}

impl SecretStore for OsMcpTokenStore {
    fn get(&self, _account: &str) -> Result<Option<String>, String> {
        match entry()?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("mcp-token-store-read-failed".into()),
        }
    }

    fn set(&self, _account: &str, secret: &str) -> Result<(), String> {
        entry()?
            .set_password(secret)
            .map_err(|_| "mcp-token-store-write-failed".into())
    }

    fn delete(&self, _account: &str) -> Result<(), String> {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("mcp-token-store-delete-failed".into()),
        }
    }
}

/// Rechaza tokens cortos, demasiado largos, con espacios o con caracteres de control.
pub fn validate_token(token: &str) -> Result<(), String> {
    let chars = token.chars().count();
    if chars < MIN_TOKEN_CHARS
        || chars > MAX_TOKEN_CHARS
        || token.chars().any(|c| c.is_control() || c.is_whitespace())
    {
        return Err("mcp-token-invalid".into());
    }
    Ok(())
}

pub fn get_token(store: &impl SecretStore) -> Result<Option<String>, String> {
    // Un valor dañado en el llavero no se entrega: el webview generará uno nuevo.
    Ok(store.get(ACCOUNT)?.filter(|t| validate_token(t).is_ok()))
}

pub fn set_token(store: &impl SecretStore, token: &str) -> Result<(), String> {
    validate_token(token)?;
    store.set(ACCOUNT, token)
}

pub fn delete_token(store: &impl SecretStore) -> Result<(), String> {
    store.delete(ACCOUNT)
}

/// Devuelve el token guardado (o `None`).
#[tauri::command]
pub fn mcp_token_get() -> Result<Option<String>, String> {
    get_token(&OsMcpTokenStore)
}

#[tauri::command]
pub fn mcp_token_set(token: String) -> Result<(), String> {
    set_token(&OsMcpTokenStore, &token)
}

#[tauri::command]
pub fn mcp_token_delete() -> Result<(), String> {
    delete_token(&OsMcpTokenStore)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::collections::HashMap;

    #[derive(Default)]
    struct MemoryStore(RefCell<HashMap<String, String>>);

    impl SecretStore for MemoryStore {
        fn get(&self, account: &str) -> Result<Option<String>, String> {
            Ok(self.0.borrow().get(account).cloned())
        }
        fn set(&self, account: &str, secret: &str) -> Result<(), String> {
            self.0.borrow_mut().insert(account.into(), secret.into());
            Ok(())
        }
        fn delete(&self, account: &str) -> Result<(), String> {
            self.0.borrow_mut().remove(account);
            Ok(())
        }
    }

    #[test]
    fn token_round_trips_in_its_own_slot() {
        let store = MemoryStore::default();
        set_token(&store, "0123456789abcdef0123").unwrap();
        assert_eq!(get_token(&store).unwrap().as_deref(), Some("0123456789abcdef0123"));
        assert!(store.0.borrow().contains_key("mcp-bridge"));
        delete_token(&store).unwrap();
        assert_eq!(get_token(&store).unwrap(), None);
    }

    #[test]
    fn short_or_malformed_tokens_are_rejected_without_echoing_them() {
        let store = MemoryStore::default();
        let long = "x".repeat(MAX_TOKEN_CHARS + 1);
        for token in ["", "fifteen-chars-x", "with space 0123456789", "line\nbreak0123456789", long.as_str()] {
            let error = set_token(&store, token).unwrap_err();
            assert!(token.is_empty() || !error.contains(token), "{token}");
        }
        assert!(store.0.borrow().is_empty());
        // 16 caracteres exactos: válido (límite inferior inclusivo).
        assert!(set_token(&store, "sixteen-chars-xx").is_ok());
    }

    #[test]
    fn corrupted_stored_values_are_not_returned() {
        let store = MemoryStore::default();
        store.0.borrow_mut().insert(ACCOUNT.into(), "tiny".into());
        assert_eq!(get_token(&store).unwrap(), None);
    }
}
