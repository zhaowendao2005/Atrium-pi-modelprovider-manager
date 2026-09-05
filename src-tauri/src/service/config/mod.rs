use dirs::home_dir;
use std::fs;
use std::path::PathBuf;

pub fn get_storage_dir() -> Result<PathBuf, String> {
    let home = home_dir().ok_or("Cannot resolve home directory")?;
    let dir = home.join(".pi").join("pi-modelprovider-manager-data");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn db_get_path() -> Result<String, String> {
    Ok(get_storage_dir()?.join("manager.db").to_string_lossy().to_string())
}
