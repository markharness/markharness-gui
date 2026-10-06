pub mod coverage;
pub mod detail;
pub mod edit;
pub mod impact;
pub mod launch;
pub mod refs;
pub mod strictdoc;
pub mod strictdoc_export;
pub mod traceability;

use launch::LaunchConfig;

#[tauri::command]
fn get_project_root(config: tauri::State<'_, LaunchConfig>) -> String {
    config.project_root.to_string_lossy().into_owned()
}

/// The working tree, including edits that are not committed yet.
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

/// The committed content at `HEAD`; `coverage` cannot read the working tree.
#[tauri::command]
async fn get_coverage(
    config: tauri::State<'_, LaunchConfig>,
) -> Result<coverage::Coverage, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    coverage::read_coverage(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

/// The tags to offer as the base of a comparison; empty when `git` cannot list them.
#[tauri::command]
async fn get_tags(config: tauri::State<'_, LaunchConfig>) -> Result<Vec<String>, String> {
    Ok(refs::read_tags(&refs::CommandGitRunner, &config.project_root).await)
}

/// The committed content between `base` and `HEAD`; it cannot read the working tree.
#[tauri::command]
async fn get_impact(
    config: tauri::State<'_, LaunchConfig>,
    base: String,
) -> Result<impact::ChangeImpact, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    impact::read_impact(&runner, &config.project_root, &base)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_case_detail(
    config: tauri::State<'_, LaunchConfig>,
    case_uid: String,
    scenario_uid: String,
) -> Result<detail::CaseDetail, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    detail::read_case_detail(&runner, &config.project_root, &case_uid, &scenario_uid)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_strictdoc(
    config: tauri::State<'_, LaunchConfig>,
    skip_saved: bool,
) -> Result<Option<strictdoc::StrictDoc>, String> {
    let runner = strictdoc_export::CommandStrictDocRunner {
        bin: "strictdoc".into(),
    };
    strictdoc_export::load_strictdoc(&runner, &config.project_root, skip_saved)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_requirement_descriptions(
    config: tauri::State<'_, LaunchConfig>,
    uids: Vec<String>,
) -> Result<Vec<detail::RequirementDescription>, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    detail::read_requirement_descriptions(&runner, &config.project_root, &uids)
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
            get_traceability,
            get_coverage,
            get_tags,
            get_impact,
            get_case_detail,
            get_strictdoc,
            get_requirement_descriptions
        ])
        .run(tauri::generate_context!())
        .expect("failed to run markharness-gui");
}
