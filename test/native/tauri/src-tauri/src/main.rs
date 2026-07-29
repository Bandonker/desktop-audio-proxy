use std::io::{self, Write};

#[tauri::command]
fn smoke_config() -> String {
    format!(
        r#"{{"host":"tauri","proxy":"{}","upstream":"{}"}}"#,
        std::env::var("DAP_SMOKE_PROXY").expect("DAP_SMOKE_PROXY is required"),
        std::env::var("DAP_SMOKE_UPSTREAM").expect("DAP_SMOKE_UPSTREAM is required")
    )
}

#[tauri::command]
fn report_smoke(app: tauri::AppHandle, result: String) {
    println!("DAP_NATIVE_SMOKE:{result}");
    let _ = io::stdout().flush();
    let passed = result.contains("\"ok\":true");
    app.exit(if passed { 0 } else { 1 });
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![smoke_config, report_smoke])
        .run(tauri::generate_context!())
        .expect("failed to run Tauri native smoke fixture");
}
