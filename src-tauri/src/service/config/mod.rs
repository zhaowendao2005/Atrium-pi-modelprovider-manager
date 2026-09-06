use dirs::home_dir;
use std::fs;
use std::path::PathBuf;

pub fn is_development() -> bool {
    match std::env::var("PI_MODEL_MANAGER_ENV").as_deref() {
        Ok("development") => true,
        Ok("production") => false,
        _ => cfg!(debug_assertions),
    }
}

pub fn get_storage_dir() -> Result<PathBuf, String> {
    let home = home_dir().ok_or("Cannot resolve home directory")?;
    let root = home.join(".pi").join("pi-modelprovider-manager-data");
    let dir = if is_development() { root.join("dev-cache") } else { root };
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn db_get_path() -> Result<String, String> {
    Ok(get_storage_dir()?.join("manager.db").to_string_lossy().to_string())
}
