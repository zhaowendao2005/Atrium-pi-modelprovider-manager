// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod service;

use rusqlite::Connection;
use tauri::Manager;
use std::sync::Mutex;

use service::config::{db_get_path, get_storage_dir};
use service::db::{
    app_meta_load, app_meta_save, db_backup, db_delete_model, db_delete_provider, db_export_json,
    db_get_health, db_get_stats, db_load_all, db_save_model, db_save_provider, init_sqlite_db, DbState,
};
use service::http_client::native_http_request;
use service::preset::{get_preset_index, get_provider_preset};
use service::test_runner::{
    abort_pi_agent_rpc, create_test_workspace, open_workspace_in_explorer, start_pi_agent_rpc,
};

#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

fn main() {
    let storage_dir = get_storage_dir().expect("Failed to get storage directory");
    let db_path = storage_dir.join("manager.db");
    let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
    init_sqlite_db(&conn).expect("Failed to initialize SQLite schema");

    let mut context = tauri::generate_context!();
    if service::config::is_development() {
        context.config_mut().identifier.push_str(".dev");
        for window in &mut context.config_mut().app.windows {
            window.title.push_str(" [Development]");
        }
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .manage(DbState {
            conn: Mutex::new(conn),
        })
        .invoke_handler(tauri::generate_handler![
            // Database and storage domain
            db_get_path,
            // Database Domain
            db_load_all,
            db_save_provider,
            db_save_model,
            db_delete_provider,
            db_delete_model,
            app_meta_load,
            app_meta_save,
            db_backup,
            db_export_json,
            db_get_health,
            db_get_stats,
            // Preset Domain
            get_preset_index,
            get_provider_preset,
            // Test Runner & Pi Agent RPC Domain
            create_test_workspace,
            start_pi_agent_rpc,
            abort_pi_agent_rpc,
            open_workspace_in_explorer,
            // DevTools
            toggle_devtools,
            // Native HTTP Client
            native_http_request
        ])
        .run(context)
        .expect("error while running tauri application");
}
