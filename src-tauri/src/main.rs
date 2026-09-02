// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

#[tauri::command]
fn get_config_path() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot resolve home directory")?;
    let config_path = home.join(".pi").join("pi-modelprovider-manager-data").join("config.yaml");
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
fn read_yaml_config() -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Cannot resolve home directory")?;
    let config_path = home.join(".pi").join("pi-modelprovider-manager-data").join("config.yaml");
    if config_path.exists() {
        fs::read_to_string(&config_path).map_err(|e| e.to_string())
    } else {
        Err("Config file does not exist".into())
    }
}

#[tauri::command]
fn write_yaml_config(content: String) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Cannot resolve home directory")?;
    let dir = home.join(".pi").join("pi-modelprovider-manager-data");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let config_path = dir.join("config.yaml");
    fs::write(&config_path, content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_config_path,
            read_yaml_config,
            write_yaml_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
