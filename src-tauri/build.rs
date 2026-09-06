fn main() {
    println!("cargo:rerun-if-changed=templates/test_tasks");
    tauri_build::build()
}
