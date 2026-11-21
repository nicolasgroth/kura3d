// Autor: Nicolás Groth <ngroth@gmail.com>
// Organización: ISGROTH — Innovación y Soluciones GROTH
// Licencia: MIT
// Descripción: Claves API de proveedores IA guardadas en el almacén de credenciales
// del sistema operativo (crate `keyring`). Solo expone leer, guardar y borrar por
// proveedor permitido; no existe un comando para listar. Los errores nunca incluyen
// el valor de la clave.

const SERVICE: &str = "com.nicolasgroth.kura3d.ai";
const PROVIDERS: [&str; 4] = ["gemini", "openai", "anthropic", "ollama"];
const MAX_SECRET_BYTES: usize = 4096;

/// Almacén mínimo de secretos. Permite probar la validación sin tocar el sistema.
pub trait SecretStore {
    fn get(&self, account: &str) -> Result<Option<String>, String>;
    fn set(&self, account: &str, secret: &str) -> Result<(), String>;
    fn delete(&self, account: &str) -> Result<(), String>;
}

/// Implementación real sobre el almacén de credenciales del sistema operativo.
pub struct OsSecretStore;

fn entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, account).map_err(|_| "ai-key-store-unavailable".to_string())
}

impl SecretStore for OsSecretStore {
    fn get(&self, account: &str) -> Result<Option<String>, String> {
        match entry(account)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err("ai-key-store-read-failed".into()),
        }
    }

    fn set(&self, account: &str, secret: &str) -> Result<(), String> {
        entry(account)?
            .set_password(secret)
            .map_err(|_| "ai-key-store-write-failed".into())
    }

    fn delete(&self, account: &str) -> Result<(), String> {
        match entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err("ai-key-store-delete-failed".into()),
        }
    }
}

/// Convierte el proveedor en el nombre de cuenta del almacén, solo si está permitido.
pub fn account_for(provider: &str) -> Result<String, String> {
    if PROVIDERS.contains(&provider) {
        Ok(format!("provider:{provider}"))
    } else {
        Err("ai-provider-not-allowed".into())
    }
}

/// Rechaza claves vacías, demasiado largas o con caracteres de control.
pub fn validate_secret(secret: &str) -> Result<(), String> {
    if secret.is_empty() || secret.len() > MAX_SECRET_BYTES || secret.chars().any(char::is_control)
    {
        return Err("ai-key-invalid".into());
    }
    Ok(())
}

pub fn get_key(store: &impl SecretStore, provider: &str) -> Result<Option<String>, String> {
    store.get(&account_for(provider)?)
}

pub fn set_key(store: &impl SecretStore, provider: &str, secret: &str) -> Result<(), String> {
    let account = account_for(provider)?;
    validate_secret(secret)?;
    store.set(&account, secret)
}

pub fn delete_key(store: &impl SecretStore, provider: &str) -> Result<(), String> {
    store.delete(&account_for(provider)?)
}

#[tauri::command]
pub fn ai_key_get(provider: String) -> Result<Option<String>, String> {
    get_key(&OsSecretStore, &provider)
}

#[tauri::command]
pub fn ai_key_set(provider: String, secret: String) -> Result<(), String> {
    set_key(&OsSecretStore, &provider, &secret)
}

#[tauri::command]
pub fn ai_key_delete(provider: String) -> Result<(), String> {
    delete_key(&OsSecretStore, &provider)
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
    fn keys_are_scoped_per_allowed_provider() {
        let store = MemoryStore::default();
        set_key(&store, "openai", "test-value-1").unwrap();
        assert_eq!(get_key(&store, "openai").unwrap().as_deref(), Some("test-value-1"));
        assert_eq!(get_key(&store, "gemini").unwrap(), None);
        delete_key(&store, "openai").unwrap();
        assert_eq!(get_key(&store, "openai").unwrap(), None);
    }

    #[test]
    fn unknown_providers_are_rejected_before_touching_the_store() {
        let store = MemoryStore::default();
        for provider in ["", "OpenAI", "openai ", "../openai", "provider:openai", "mcp"] {
            assert!(set_key(&store, provider, "value").is_err(), "{provider}");
            assert!(get_key(&store, provider).is_err(), "{provider}");
            assert!(delete_key(&store, provider).is_err(), "{provider}");
        }
        assert!(store.0.borrow().is_empty());
    }

    #[test]
    fn invalid_secrets_are_rejected_without_echoing_them() {
        let store = MemoryStore::default();
        let long = "x".repeat(MAX_SECRET_BYTES + 1);
        for secret in ["", "line\nbreak", "nul\0", long.as_str()] {
            let error = set_key(&store, "anthropic", secret).unwrap_err();
            assert!(secret.is_empty() || !error.contains(secret));
        }
        assert!(store.0.borrow().is_empty());
    }
}
