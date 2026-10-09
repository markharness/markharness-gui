pub mod axes;
pub mod bindings;
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

/// What the core records as the axes and the description of a requirement, a feature or a behavior.
#[tauri::command]
async fn get_element_detail(
    config: tauri::State<'_, LaunchConfig>,
    uid: String,
) -> Result<detail::ElementDetail, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    detail::read_element_detail(&runner, &config.project_root, &uid)
        .await
        .map_err(|e| e.to_string())
}

/// The axes the project defines, to choose from when an element is edited.
#[tauri::command]
async fn get_axes(config: tauri::State<'_, LaunchConfig>) -> Result<Vec<axes::Axis>, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    axes::read_axes(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

/// What the core records as the description and the implementation note of a scenario.
#[tauri::command]
async fn get_scenario_detail(
    config: tauri::State<'_, LaunchConfig>,
    uid: String,
) -> Result<detail::ScenarioDetail, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    detail::read_scenario_detail(&runner, &config.project_root, &uid)
        .await
        .map_err(|e| e.to_string())
}

/// The ids of the axes no requirement, feature or behavior uses.
#[tauri::command]
async fn get_unused_axes(config: tauri::State<'_, LaunchConfig>) -> Result<Vec<String>, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    axes::read_unused_axes(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

/// Deletes every axis nobody uses.
#[tauri::command]
async fn delete_unused_axes(config: tauri::State<'_, LaunchConfig>) -> Result<Vec<String>, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    axes::delete_unused_axes(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

/// Registers a new axis; the label defaults to the id in the core when omitted.
#[tauri::command]
async fn add_axis(
    config: tauri::State<'_, LaunchConfig>,
    id: String,
    label: Option<String>,
) -> Result<(), String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    axes::add_axis(&runner, &config.project_root, &id, label.as_deref()).await
}

/// What each case declares as its verification means, in the working tree.
#[tauri::command]
async fn get_bindings(
    config: tauri::State<'_, LaunchConfig>,
) -> Result<Vec<bindings::Binding>, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    bindings::read_bindings(&runner, &config.project_root)
        .await
        .map_err(|e| e.to_string())
}

/// Declares the verification means of a case, replacing the one it had.
#[tauri::command]
async fn set_binding(
    config: tauri::State<'_, LaunchConfig>,
    case_uid: String,
    mode: String,
    reference: Option<String>,
) -> Result<(), String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    bindings::set_binding(
        &runner,
        &config.project_root,
        &case_uid,
        &mode,
        reference.as_deref(),
    )
    .await
}

/// Writes one edit through the core, then regenerates the test cases from the knowledge.
#[tauri::command]
async fn edit_knowledge(
    config: tauri::State<'_, LaunchConfig>,
    edit: edit::Edit,
) -> Result<(), String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    edit::apply_edit(&runner, &config.project_root, &edit).await
}

/// Creates one element through the core, then regenerates the test cases; returns the new uid.
#[tauri::command]
async fn create_element(
    config: tauri::State<'_, LaunchConfig>,
    create: edit::Create,
) -> Result<String, String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    edit::apply_create(&runner, &config.project_root, &create).await
}

/// Deletes one element through the core, then regenerates the test cases.
#[tauri::command]
async fn remove_element(
    config: tauri::State<'_, LaunchConfig>,
    kind: edit::RemoveKind,
    uid: String,
) -> Result<(), String> {
    let runner = traceability::CommandRunner {
        bin: config.markharness_bin.clone(),
    };
    edit::apply_remove(&runner, &config.project_root, kind, &uid).await
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
            get_requirement_descriptions,
            get_element_detail,
            get_scenario_detail,
            get_axes,
            add_axis,
            get_unused_axes,
            delete_unused_axes,
            edit_knowledge,
            create_element,
            remove_element,
            get_bindings,
            set_binding
        ])
        .run(tauri::generate_context!())
        .expect("failed to run markharness-gui");
}
