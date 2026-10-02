pub mod launch;
pub mod traceability;

use launch::LaunchConfig;

#[tauri::command]
fn get_project_root(config: tauri::State<'_, LaunchConfig>) -> String {
    config.project_root.to_string_lossy().into_owned()
}

#[tauri::command]
async fn get_traceability(
    config: tauri::State<'_, LaunchConfig>,
) -> Result<traceability::Traceability, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    traceability::read_traceability(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let config = launch::resolve(&args, std::env::var("MARKHARNESS_BIN").ok().as_deref())
        .unwrap_or_else(|e| {
            eprintln!("{e}");
            std::process::exit(2);
        });

    tauri::Builder::default()
        .manage(config)
        .invoke_handler(tauri::generate_handler![get_project_root, get_traceability])
        .run(tauri::generate_context!())
        .expect("failed to run markharness-gui");
}
