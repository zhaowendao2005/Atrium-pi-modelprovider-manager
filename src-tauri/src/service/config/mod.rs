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
pub fn get_config_path() -> Result<String, String> {
    let dir = get_storage_dir()?;
    let config_path = dir.join("config.yaml");
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_yaml_config() -> Result<String, String> {
    let dir = get_storage_dir()?;
    let config_path = dir.join("config.yaml");
    if config_path.exists() {
        fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Err("Config file does not exist".into())
    }
}

#[tauri::command]
pub fn write_yaml_config(content: String) -> Result<(), String> {
    let dir = get_storage_dir()?;
    let config_path = dir.join("config.yaml");
    fs::write(&config_path, content).map_err(|e| e.to_string())
}
