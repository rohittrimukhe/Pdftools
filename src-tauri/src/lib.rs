// The desktop shell only hosts the web app and lends it the system "Save as"
// dialog. All document work happens in the web view, on this computer.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Happy PDF");
}
