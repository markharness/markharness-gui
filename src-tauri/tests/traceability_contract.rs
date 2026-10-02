//! Runs the real `markharness` against a throwaway project. While the core's
//! `schema_version` stays at 1 whatever the output shape, this is the only
//! check that notices when the output shape changes.

use std::path::{Path, PathBuf};
use std::process::Command;

use markharness_gui_lib::traceability::{read_traceability, CommandRunner, RequirementSource};

fn markharness_bin() -> PathBuf {
    let bin = std::env::var_os("MARKHARNESS_BIN")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("markharness"));
    let runnable = Command::new(&bin)
        .arg("--version")
        .output()
        .is_ok_and(|o| o.status.success());
    assert!(
        runnable,
        "markharness not found: set MARKHARNESS_BIN or put markharness on PATH (tried {})",
        bin.display()
    );
    bin
}

fn run(bin: &Path, args: &[&std::ffi::OsStr]) {
    let output = Command::new(bin)
        .args(args)
        .output()
        .expect("run markharness");
    assert!(
        output.status.success(),
        "markharness {args:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn create_sample_project(bin: &Path) -> PathBuf {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/todo-minimal");
    let project =
        std::env::temp_dir().join(format!("markharness-gui-contract-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&project);
    std::fs::create_dir_all(&project).unwrap();

    run(
        bin,
        &["init".as_ref(), "--dir".as_ref(), project.as_os_str()],
    );
    for axis in std::fs::read_dir(fixtures.join("axes")).unwrap() {
        let axis = axis.unwrap().path();
        std::fs::copy(
            &axis,
            project
                .join(".markharness/axes")
                .join(axis.file_name().unwrap()),
        )
        .unwrap();
    }
    run(
        bin,
        &[
            "knowledge".as_ref(),
            "reconcile".as_ref(),
            fixtures.join("intent.yml").as_os_str(),
            "--dir".as_ref(),
            project.as_os_str(),
        ],
    );
    project
}

#[tokio::test]
async fn reads_the_traceability_of_a_real_project() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin);

    let result = read_traceability(&CommandRunner { bin }, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    let t = result.expect("traceability should be readable");
    assert_eq!(t.requirements.len(), 1);
    assert_eq!(t.requirements[0].requirement_id, "todo-management");
    assert_eq!(t.requirements[0].source, RequirementSource::Native);
    assert_eq!(t.features[0].feature_id, "add-todo");
    assert_eq!(t.behaviors[0].feature_id, "add-todo");
    assert_eq!(t.scenarios[0].scenario_id, "empty-title");
    assert_eq!(t.test_cases[0].scenario_id, "empty-title");
}
