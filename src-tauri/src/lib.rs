pub mod coverage;
pub mod detail;
pub mod launch;
pub mod project;
pub mod strictdoc;
pub mod traceability;

use launch::LaunchConfig;

#[tauri::command]
fn get_project_root(config: tauri::State<'_, LaunchConfig>) -> String {
    config.project_root.to_string_lossy().into_owned()
}

#[tauri::command]
async fn get_project(config: tauri::State<'_, LaunchConfig>) -> Result<project::Project, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    project::read_project(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_case_detail(
    config: tauri::State<'_, LaunchConfig>,
    case_uid: String,
    scenario_uid: String,
    at_commit: String,
) -> Result<detail::CaseDetail, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    detail::read_case_detail(
        &runner,
        &config.project_root,
        &case_uid,
        &scenario_uid,
        &at_commit,
    )
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
        .invoke_handler(tauri::generate_handler![
            get_project_root,
            get_project,
            get_case_detail
        ])
        .run(tauri::generate_context!())
        .expect("failed to run markharness-gui");
}
