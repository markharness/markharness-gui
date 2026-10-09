//! Runs the real `markharness` against a throwaway project. While the core's
//! `schema_version` stays at 1 whatever the output shape, this is the only
//! check that notices when the output shape changes.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicUsize, Ordering};

use markharness_gui_lib::axes::{add_axis, delete_unused_axes, read_axes, read_unused_axes};
use markharness_gui_lib::bindings::{read_bindings, set_binding};
use markharness_gui_lib::coverage::read_coverage;
use markharness_gui_lib::detail::{
    read_case_detail, read_element_detail, read_scenario_detail, ScenarioPhase, ScenarioStep,
};
use markharness_gui_lib::edit::{
    apply_create, apply_edit, apply_remove, Create, Edit, NamedProcedure, RemoveKind,
};
use markharness_gui_lib::impact::{read_impact, ImpactStatus};
use markharness_gui_lib::refs::{read_tags, CommandGitRunner};
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

fn create_sample_project(bin: &Path, fixture: &str) -> PathBuf {
    let fixtures = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures")
        .join(fixture);
    // Tests run in parallel, and two of them may use the same fixture.
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let project = std::env::temp_dir().join(format!(
        "markharness-gui-contract-{fixture}-{}-{}",
        std::process::id(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    ));
    let _ = std::fs::remove_dir_all(&project);
    std::fs::create_dir_all(&project).unwrap();

    run(
        bin,
        &["init".as_ref(), "--dir".as_ref(), project.as_os_str()],
    );
    if let Ok(axes) = std::fs::read_dir(fixtures.join("axes")) {
        for axis in axes {
            let axis = axis.unwrap().path();
            std::fs::copy(
                &axis,
                project
                    .join(".markharness/axes")
                    .join(axis.file_name().unwrap()),
            )
            .unwrap();
        }
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
    let project = create_sample_project(&bin, "todo-minimal");

    let result = read_traceability(&CommandRunner { bin }, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    let t = result.expect("traceability should be readable");
    assert_eq!(t.requirements.len(), 1);
    assert_eq!(t.requirements[0].requirement_id, "todo-management");
    assert_eq!(t.requirements[0].source, RequirementSource::Native);
    assert!(!t.requirements[0].case_uids.is_empty());
    assert_eq!(t.features[0].feature_id, "add-todo");
    assert_eq!(t.behaviors[0].feature_id, "add-todo");
    assert_eq!(t.scenarios[0].scenario_id, "empty-title");
    assert_eq!(t.test_cases[0].scenario_id, "empty-title");
}

#[tokio::test]
async fn resolves_parents_by_uid_when_features_share_a_behavior_slug() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "shared-slugs");

    let result = read_traceability(&CommandRunner { bin }, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    let t = result.expect("traceability should be readable");
    let behavior = |label: &str| {
        t.behaviors
            .iter()
            .find(|b| b.label.as_deref() == Some(label))
            .unwrap()
    };
    let scenario = |label: &str| {
        t.scenarios
            .iter()
            .find(|s| s.label.as_deref() == Some(label))
            .unwrap()
    };
    let feature = |label: &str| {
        t.features
            .iter()
            .find(|f| f.label.as_deref() == Some(label))
            .unwrap()
    };
    assert_eq!(behavior("A-submit").feature_uid, feature("A").feature_uid);
    assert_eq!(behavior("B-submit").feature_uid, feature("B").feature_uid);
    assert_eq!(
        scenario("A-ok").behavior_uid,
        behavior("A-submit").behavior_uid
    );
    assert_eq!(
        scenario("B-ok").behavior_uid,
        behavior("B-submit").behavior_uid
    );
    let case_of = |scenario_label: &str| {
        let uid = &scenario(scenario_label).scenario_uid;
        t.test_cases
            .iter()
            .filter(|c| &c.scenario_uid == uid)
            .count()
    };
    assert_eq!(case_of("A-ok"), 1);
    assert_eq!(case_of("B-ok"), 1);
}

fn git(project: &Path, args: &[&str]) {
    let output = Command::new("git")
        .args(["-c", "user.name=test", "-c", "user.email=test@example.com"])
        .args(args)
        .current_dir(project)
        .output()
        .expect("run git");
    assert!(
        output.status.success(),
        "git {args:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn commit_all(project: &Path) {
    git(project, &["init", "-q"]);
    git(project, &["add", "-A"]);
    git(project, &["commit", "-q", "-m", "sample"]);
}

#[tokio::test]
async fn relates_the_same_cases_to_a_requirement_as_the_coverage_does() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    commit_all(&project);
    let runner = CommandRunner { bin };

    let traceability = read_traceability(&runner, &project).await;
    let coverage = read_coverage(&runner, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    let t = traceability.expect("traceability should be readable");
    let c = coverage.expect("coverage should be readable");
    assert_eq!(c.at_commit.len(), 40);
    let requirement = &t.requirements[0];
    let mut covered: Vec<&String> = c
        .requirements
        .iter()
        .find(|r| r.requirement_uid == requirement.requirement_uid)
        .expect("coverage should report the requirement")
        .cases
        .iter()
        .map(|case| &case.case_uid)
        .collect();
    covered.sort();
    assert!(!covered.is_empty());
    assert_eq!(requirement.case_uids.iter().collect::<Vec<_>>(), covered);
}

#[tokio::test]
async fn reads_the_steps_and_the_description_of_a_case() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project)
        .await
        .expect("traceability should be readable");
    let case = &t.test_cases[0];

    let result = read_case_detail(&runner, &project, &case.case_uid, &case.scenario_uid).await;
    let _ = std::fs::remove_dir_all(&project);

    let d = result.expect("case detail should be readable");
    assert!(!d.phases.is_empty());
    assert!(d.phases.iter().all(|phase| !phase.steps.is_empty()));
}

#[tokio::test]
async fn reads_the_cases_to_confirm_between_a_tag_and_head() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    git(&project, &["init", "-q"]);
    std::fs::write(project.join("README.md"), "sample").unwrap();
    git(&project, &["add", "README.md"]);
    git(&project, &["commit", "-q", "-m", "before"]);
    git(&project, &["tag", "v0"]);
    git(&project, &["add", "-A"]);
    git(&project, &["commit", "-q", "-m", "knowledge"]);

    let tags = read_tags(&CommandGitRunner, &project).await;
    let impact = read_impact(&CommandRunner { bin }, &project, "v0").await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(tags, ["v0"]);
    let impact = impact.expect("impact should be readable");
    let cases: Vec<_> = impact.requirements.iter().flat_map(|r| &r.cases).collect();
    assert!(!cases.is_empty());
    assert!(cases.iter().all(|c| c.status == ImpactStatus::FollowedUp));
}

#[tokio::test]
async fn an_edit_is_written_and_the_generated_cases_follow_it() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin: bin.clone() };
    let t = read_traceability(&runner, &project).await.unwrap();
    let edit = Edit::Scenario {
        feature_uid: t.features[0].feature_uid.clone(),
        behavior_uid: t.behaviors[0].behavior_uid.clone(),
        uid: t.scenarios[0].scenario_uid.clone(),
        // A label the core must quote to read it back (core issue #119).
        id: None,
        label: Some("- 題: 編集".into()),
        description: Some("編集した説明".into()),
        implementation_note: None,
        phases: None,
    };

    let applied = apply_edit(&runner, &project, &edit).await;
    let reread = read_traceability(&runner, &project).await;
    let shown = Command::new(&bin)
        .args(["traceability", "show", "--uid"])
        .arg(&t.scenarios[0].scenario_uid)
        .arg("--dir")
        .arg(&project)
        .output()
        .unwrap();
    // `verify` fails while `generated/` differs from `knowledge/`; the fixture never ran `generate`.
    let verified = Command::new(&bin)
        .arg("verify")
        .arg("--dir")
        .arg(&project)
        .output()
        .unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(applied, Ok(()));
    assert_eq!(
        reread.unwrap().scenarios[0].label.as_deref(),
        Some("- 題: 編集")
    );
    let shown: serde_json::Value = serde_json::from_slice(&shown.stdout).unwrap();
    assert_eq!(shown["description"], "編集した説明\n");
    assert!(
        verified.status.success(),
        "{}",
        String::from_utf8_lossy(&verified.stderr)
    );
}

#[tokio::test]
async fn reads_the_axes_of_a_feature_and_the_axes_to_choose_from() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();

    let detail = read_element_detail(&runner, &project, &t.features[0].feature_uid).await;
    let candidates = read_axes(&runner, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(detail.unwrap().axis, ["ui", "validation"]);
    let ids: Vec<String> = candidates.unwrap().into_iter().map(|a| a.id).collect();
    for id in ["ui", "validation", "workflow"] {
        assert!(ids.iter().any(|i| i == id), "{id} not in {ids:?}");
    }
}

#[tokio::test]
async fn adds_an_axis_that_can_then_be_chosen_and_refuses_the_same_id_again() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };

    let added = add_axis(&runner, &project, "perf", Some("性能")).await;
    let candidates = read_axes(&runner, &project).await;
    let again = add_axis(&runner, &project, "perf", None).await;
    let dash = add_axis(&runner, &project, "-bad", None).await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(added, Ok(()));
    let perf = candidates
        .unwrap()
        .into_iter()
        .find(|a| a.id == "perf")
        .expect("the new axis is offered");
    assert_eq!(perf.label, "性能");
    assert!(again.unwrap_err().contains("already exists"));
    // An id that starts with `-` reaches the core as an id, not as an option the core cannot parse.
    if let Err(message) = dash {
        assert!(!message.contains("unexpected argument"), "{message}");
    }
}

#[tokio::test]
async fn deletes_only_the_axes_no_element_uses() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    add_axis(&runner, &project, "stale", None).await.unwrap();

    let unused = read_unused_axes(&runner, &project).await.unwrap();
    let still_there = read_axes(&runner, &project).await.unwrap();
    let deleted = delete_unused_axes(&runner, &project).await.unwrap();
    let after: Vec<String> = read_axes(&runner, &project)
        .await
        .unwrap()
        .into_iter()
        .map(|a| a.id)
        .collect();
    let _ = std::fs::remove_dir_all(&project);

    assert!(unused.contains(&"stale".to_string()));
    // Reading the report deletes nothing.
    assert!(still_there.iter().any(|a| a.id == "stale"));
    assert!(deleted.contains(&"stale".to_string()));
    assert!(!after.contains(&"stale".to_string()));
    // The feature uses `ui` and `validation`, so they stay.
    assert!(after.contains(&"ui".to_string()));
    assert!(after.contains(&"validation".to_string()));
}

#[tokio::test]
async fn a_behavior_is_edited_and_its_own_description_can_be_sent_back_as_read() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, uid) = (
        t.features[0].feature_uid.clone(),
        t.behaviors[0].behavior_uid.clone(),
    );
    let edit = |description: String, axis: Vec<String>| Edit::Behavior {
        feature_uid: feature_uid.clone(),
        uid: uid.clone(),
        id: None,
        label: Some("新しい名前".into()),
        description: Some(description),
        axis: Some(axis),
        procedures: None,
    };

    let first = apply_edit(
        &runner,
        &project,
        &edit("新しい説明".into(), vec!["ui".into()]),
    )
    .await;
    let read = read_element_detail(&runner, &project, &uid).await.unwrap();
    // What the core returned, with its trailing newline, goes back in without growing.
    let again = apply_edit(
        &runner,
        &project,
        &edit(read.description.clone().unwrap(), read.axis.clone()),
    )
    .await;
    let reread = read_element_detail(&runner, &project, &uid).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(first, Ok(()));
    assert_eq!(read.description.as_deref(), Some("新しい説明\n"));
    assert_eq!(read.axis, ["ui"]);
    assert_eq!(again, Ok(()));
    assert_eq!(reread, read);
}

#[tokio::test]
async fn a_scenario_is_edited_and_its_note_can_be_set_but_not_emptied() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid, uid) = (
        t.features[0].feature_uid.clone(),
        t.behaviors[0].behavior_uid.clone(),
        t.scenarios[0].scenario_uid.clone(),
    );
    let edit = |note: &str| Edit::Scenario {
        feature_uid: feature_uid.clone(),
        behavior_uid: behavior_uid.clone(),
        uid: uid.clone(),
        id: None,
        label: Some("新しい名前".into()),
        description: Some("新しい説明".into()),
        implementation_note: Some(note.into()),
        phases: None,
    };

    let set = apply_edit(&runner, &project, &edit("実装メモ")).await;
    let read = read_scenario_detail(&runner, &project, &uid).await.unwrap();
    let emptied = apply_edit(&runner, &project, &edit("")).await;
    let reread = read_scenario_detail(&runner, &project, &uid).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(set, Ok(()));
    assert_eq!(read.description.as_deref(), Some("新しい説明\n"));
    assert_eq!(read.implementation_note.as_deref(), Some("実装メモ\n"));
    assert!(emptied.unwrap_err().contains("must not be empty"));
    assert_eq!(reread, read);
}

#[tokio::test]
async fn a_native_requirement_is_edited_and_read_back() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let uid = t.requirements[0].requirement_uid.clone();
    let edit = Edit::Requirement {
        uid: uid.clone(),
        id: None,
        label: Some("- 新しい要求: 名前".into()),
        description: Some("新しい説明".into()),
        axis: Some(vec!["workflow".into()]),
    };

    let applied = apply_edit(&runner, &project, &edit).await;
    let detail = read_element_detail(&runner, &project, &uid).await.unwrap();
    let reread = read_traceability(&runner, &project).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(applied, Ok(()));
    assert_eq!(detail.axis, ["workflow"]);
    assert_eq!(
        detail.description.as_deref(),
        Some(
            "新しい説明
"
        )
    );
    assert_eq!(
        reread.requirements[0].label.as_deref(),
        Some("- 新しい要求: 名前")
    );
}

#[tokio::test]
async fn the_phases_of_a_scenario_are_read_as_written_and_sent_back_whole() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid, uid) = (
        t.features[0].feature_uid.clone(),
        t.behaviors[0].behavior_uid.clone(),
        t.scenarios[0].scenario_uid.clone(),
    );
    let edit = |phases: Vec<ScenarioPhase>| Edit::Scenario {
        feature_uid: feature_uid.clone(),
        behavior_uid: behavior_uid.clone(),
        uid: uid.clone(),
        id: None,
        label: None,
        description: None,
        implementation_note: None,
        phases: Some(phases),
    };
    let revision = |t: &markharness_gui_lib::traceability::Traceability| {
        (
            t.test_cases[0].case_uid.clone(),
            t.test_cases[0].case_revision.clone(),
        )
    };

    let before = read_scenario_detail(&runner, &project, &uid).await.unwrap();
    let procedures = read_element_detail(&runner, &project, &behavior_uid)
        .await
        .unwrap()
        .procedures;
    let same = apply_edit(&runner, &project, &edit(before.phases)).await;
    let unchanged = read_traceability(&runner, &project).await.unwrap();
    let procedure = procedures
        .keys()
        .next()
        .expect("the fixture declares one")
        .clone();
    let changed = apply_edit(
        &runner,
        &project,
        &edit(vec![
            ScenarioPhase {
                steps: vec![
                    ScenarioStep::Use(procedure.clone()),
                    ScenarioStep::Action("新しい手順".into()),
                ],
                results: vec!["新しい結果".into()],
            },
            ScenarioPhase {
                steps: vec![ScenarioStep::Action("もう一つ".into())],
                results: vec!["もう一つの結果".into()],
            },
        ]),
    )
    .await;
    let after = read_scenario_detail(&runner, &project, &uid).await.unwrap();
    let edited = read_traceability(&runner, &project).await.unwrap();
    let empty = apply_edit(
        &runner,
        &project,
        &edit(vec![ScenarioPhase {
            steps: vec![],
            results: vec!["結果".into()],
        }]),
    )
    .await;
    let unknown = apply_edit(
        &runner,
        &project,
        &edit(vec![ScenarioPhase {
            steps: vec![ScenarioStep::Use("no-such-procedure".into())],
            results: vec!["結果".into()],
        }]),
    )
    .await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(same, Ok(()));
    assert_eq!(changed, Ok(()));
    assert_eq!(after.phases.len(), 2);
    assert_eq!(after.phases[0].steps[0], ScenarioStep::Use(procedure));
    // The case keeps its identity, so what is bound to it stays; only its revision moves.
    assert_eq!(revision(&unchanged).0, revision(&edited).0);
    assert_ne!(revision(&unchanged).1, revision(&edited).1);
    assert!(empty
        .unwrap_err()
        .contains("at least one entry is required"));
    assert!(unknown.unwrap_err().contains("no-such-procedure"));
}

#[tokio::test]
async fn the_procedures_of_a_behavior_are_sent_back_whole_and_a_used_one_cannot_be_dropped() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid) = (
        t.features[0].feature_uid.clone(),
        t.behaviors[0].behavior_uid.clone(),
    );
    let edit = |procedures: Vec<NamedProcedure>| Edit::Behavior {
        feature_uid: feature_uid.clone(),
        uid: behavior_uid.clone(),
        id: None,
        label: None,
        description: None,
        axis: None,
        procedures: Some(procedures),
    };
    let named =
        |read: &std::collections::BTreeMap<String, markharness_gui_lib::detail::Procedure>| {
            read.iter()
                .map(|(name, p)| NamedProcedure {
                    name: name.clone(),
                    steps: p.steps.clone(),
                })
                .collect::<Vec<_>>()
        };

    let before = read_element_detail(&runner, &project, &behavior_uid)
        .await
        .unwrap()
        .procedures;
    let same = apply_edit(&runner, &project, &edit(named(&before))).await;
    let mut with_new = named(&before);
    with_new[0].steps = vec!["書き換えた手順".into()];
    with_new.push(NamedProcedure {
        name: "added".into(),
        steps: vec!["足した手順".into()],
    });
    let changed = apply_edit(&runner, &project, &edit(with_new)).await;
    let after = read_element_detail(&runner, &project, &behavior_uid)
        .await
        .unwrap()
        .procedures;
    let used = before.keys().next().unwrap().clone();
    let dropped = apply_edit(
        &runner,
        &project,
        &edit(vec![NamedProcedure {
            name: "added".into(),
            steps: vec!["足した手順".into()],
        }]),
    )
    .await;
    let still_readable = read_traceability(&runner, &project).await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(same, Ok(()));
    assert_eq!(changed, Ok(()));
    assert_eq!(after.len(), 2);
    assert_eq!(after[&used].steps, vec!["書き換えた手順".to_string()]);
    assert_eq!(after["added"].steps, vec!["足した手順".to_string()]);
    assert!(dropped.unwrap_err().contains(&used));
    assert!(still_readable.is_ok());
}

#[tokio::test]
async fn the_display_id_of_each_element_is_renamed_and_its_uid_stays() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid, scenario_uid) = (
        before.features[0].feature_uid.clone(),
        before.behaviors[0].behavior_uid.clone(),
        before.scenarios[0].scenario_uid.clone(),
    );

    let feature = apply_edit(
        &runner,
        &project,
        &Edit::Feature {
            uid: feature_uid.clone(),
            id: Some("renamed-feature".into()),
            label: None,
            axis: None,
        },
    )
    .await;
    let behavior = apply_edit(
        &runner,
        &project,
        &Edit::Behavior {
            feature_uid: feature_uid.clone(),
            uid: behavior_uid.clone(),
            id: Some("renamed-behavior".into()),
            label: None,
            description: None,
            axis: None,
            procedures: None,
        },
    )
    .await;
    let scenario = apply_edit(
        &runner,
        &project,
        &Edit::Scenario {
            feature_uid: feature_uid.clone(),
            behavior_uid: behavior_uid.clone(),
            uid: scenario_uid.clone(),
            id: Some("renamed-scenario".into()),
            label: None,
            description: None,
            implementation_note: None,
            phases: None,
        },
    )
    .await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let refused = apply_edit(
        &runner,
        &project,
        &Edit::Feature {
            uid: feature_uid.clone(),
            id: Some("Not A Slug".into()),
            label: None,
            axis: None,
        },
    )
    .await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!((feature, behavior, scenario), (Ok(()), Ok(()), Ok(())));
    assert_eq!(after.features[0].feature_id, "renamed-feature");
    assert_eq!(after.features[0].feature_uid, feature_uid);
    assert_eq!(after.behaviors[0].behavior_id, "renamed-behavior");
    assert_eq!(after.behaviors[0].behavior_uid, behavior_uid);
    assert_eq!(after.scenarios[0].scenario_id, "renamed-scenario");
    assert_eq!(after.scenarios[0].scenario_uid, scenario_uid);
    assert!(refused.is_err());
}

#[tokio::test]
async fn the_means_of_a_case_is_declared_and_read_back_from_the_working_tree() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let t = read_traceability(&runner, &project).await.unwrap();
    let case_uid = t.test_cases[0].case_uid.clone();

    let first = set_binding(
        &runner,
        &project,
        &case_uid,
        "automated",
        Some("tests/a.ts"),
    )
    .await;
    let declared = read_bindings(&runner, &project).await.unwrap();
    let second = set_binding(&runner, &project, &case_uid, "manual", None).await;
    let replaced = read_bindings(&runner, &project).await.unwrap();
    let refused = set_binding(&runner, &project, &case_uid, "robot", None).await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!((first, second), (Ok(()), Ok(())));
    let mine = |all: &[markharness_gui_lib::bindings::Binding]| {
        all.iter()
            .find(|b| b.case_uid == case_uid)
            .map(|b| (b.mode.clone(), b.reference.clone()))
    };
    assert_eq!(
        mine(&declared),
        Some(("automated".to_string(), Some("tests/a.ts".to_string())))
    );
    assert_eq!(mine(&replaced), Some(("manual".to_string(), None)));
    assert!(refused.is_err());
}

#[tokio::test]
async fn a_new_requirement_is_created_and_read_back_with_the_uid_the_core_gave() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let create = |label: &str| Create::Requirement {
        id: "new-requirement".into(),
        label: label.into(),
        description: Some("説明".into()),
        axis: vec![],
    };

    let created = apply_create(&runner, &project, &create("新しい要求")).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let again = apply_create(&runner, &project, &create("別の内容")).await;
    let _ = std::fs::remove_dir_all(&project);

    let found = after
        .requirements
        .iter()
        .find(|r| r.requirement_id == "new-requirement")
        .expect("the new requirement is read back");
    assert_eq!(created, Ok(found.requirement_uid.clone()));
    assert_eq!(found.label.as_deref(), Some("新しい要求"));
    assert!(again.unwrap_err().contains("new-requirement"));
}

#[tokio::test]
async fn a_new_feature_is_created_under_a_requirement_before_it_has_any_case() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let requirement_uid = before.requirements[0].requirement_uid.clone();

    let created = apply_create(
        &runner,
        &project,
        &Create::Feature {
            id: "new-feature".into(),
            label: "新しい機能".into(),
            contributes_to: vec![requirement_uid.clone()],
            axis: vec![],
        },
    )
    .await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    let feature = after
        .features
        .iter()
        .find(|f| f.feature_id == "new-feature")
        .expect("the new feature is read back");
    assert_eq!(created, Ok(feature.feature_uid.clone()));
    assert!(after
        .relations
        .iter()
        .any(|r| r.from_uid == feature.feature_uid && r.to_uid == requirement_uid));
}

#[tokio::test]
async fn a_new_behavior_is_created_under_a_feature_before_it_has_any_scenario() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let feature_uid = before.features[0].feature_uid.clone();
    let create = |description: &str| Create::Behavior {
        feature_uid: feature_uid.clone(),
        id: "new-behavior".into(),
        label: "新しい振る舞い".into(),
        description: description.into(),
        axis: vec![],
        procedures: None,
    };

    let created = apply_create(&runner, &project, &create("説明")).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let blank = apply_create(&runner, &project, &create("")).await;
    let _ = std::fs::remove_dir_all(&project);

    let behavior = after
        .behaviors
        .iter()
        .find(|b| b.behavior_id == "new-behavior")
        .expect("the new behavior is read back");
    assert_eq!(created, Ok(behavior.behavior_uid.clone()));
    assert_eq!(behavior.feature_uid, feature_uid);
    assert!(blank.is_err());
}

#[tokio::test]
async fn a_new_scenario_is_created_with_its_phases_and_gets_a_test_case() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid) = (
        before.features[0].feature_uid.clone(),
        before.behaviors[0].behavior_uid.clone(),
    );
    let create = |phases: Vec<ScenarioPhase>| Create::Scenario {
        feature_uid: feature_uid.clone(),
        behavior_uid: behavior_uid.clone(),
        id: "new-scenario".into(),
        label: "新しいシナリオ".into(),
        description: "説明".into(),
        implementation_note: None,
        phases,
    };

    let created = apply_create(
        &runner,
        &project,
        &create(vec![ScenarioPhase {
            steps: vec![ScenarioStep::Action("押す".into())],
            results: vec!["出る".into()],
        }]),
    )
    .await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let without_phases = apply_create(&runner, &project, &create(vec![])).await;
    let _ = std::fs::remove_dir_all(&project);

    let scenario = after
        .scenarios
        .iter()
        .find(|s| s.scenario_id == "new-scenario")
        .expect("the new scenario is read back");
    assert_eq!(created, Ok(scenario.scenario_uid.clone()));
    assert!(after
        .test_cases
        .iter()
        .any(|c| c.scenario_uid == scenario.scenario_uid));
    assert!(without_phases.is_err());
}

#[tokio::test]
async fn a_scenario_is_removed_with_its_case_and_a_missing_one_is_refused() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let scenario_uid = before.scenarios[0].scenario_uid.clone();

    let removed = apply_remove(&runner, &project, RemoveKind::Scenario, &scenario_uid).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let again = apply_remove(&runner, &project, RemoveKind::Scenario, &scenario_uid).await;
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(removed, Ok(()));
    assert!(after
        .scenarios
        .iter()
        .all(|s| s.scenario_uid != scenario_uid));
    assert!(after
        .test_cases
        .iter()
        .all(|c| c.scenario_uid != scenario_uid));
    assert!(again.unwrap_err().contains("no scenario matches"));
}

#[tokio::test]
async fn a_feature_is_removed_with_its_behaviors_and_scenarios() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let feature_uid = before.features[0].feature_uid.clone();

    let removed = apply_remove(&runner, &project, RemoveKind::Feature, &feature_uid).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(removed, Ok(()));
    assert!(after.features.iter().all(|f| f.feature_uid != feature_uid));
    assert!(after.behaviors.iter().all(|b| b.feature_uid != feature_uid));
    assert!(
        after.scenarios.is_empty()
            || after.scenarios.iter().all(|s| {
                before
                    .behaviors
                    .iter()
                    .find(|b| b.behavior_uid == s.behavior_uid)
                    .is_none_or(|b| b.feature_uid != feature_uid)
            })
    );
}

#[tokio::test]
async fn a_behavior_is_removed_with_its_scenarios_and_the_feature_stays() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let (feature_uid, behavior_uid) = (
        before.features[0].feature_uid.clone(),
        before.behaviors[0].behavior_uid.clone(),
    );

    let removed = apply_remove(&runner, &project, RemoveKind::Behavior, &behavior_uid).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(removed, Ok(()));
    assert!(after
        .behaviors
        .iter()
        .all(|b| b.behavior_uid != behavior_uid));
    assert!(after
        .scenarios
        .iter()
        .all(|s| s.behavior_uid != behavior_uid));
    assert!(after.features.iter().any(|f| f.feature_uid == feature_uid));
}

#[tokio::test]
async fn a_requirement_is_removed_and_its_features_stay_without_it() {
    let bin = markharness_bin();
    let project = create_sample_project(&bin, "todo-minimal");
    let runner = CommandRunner { bin };
    let before = read_traceability(&runner, &project).await.unwrap();
    let requirement_uid = before.requirements[0].requirement_uid.clone();
    let features_before = before.features.len();

    let removed = apply_remove(&runner, &project, RemoveKind::Requirement, &requirement_uid).await;
    let after = read_traceability(&runner, &project).await.unwrap();
    let _ = std::fs::remove_dir_all(&project);

    assert_eq!(removed, Ok(()));
    assert!(after
        .requirements
        .iter()
        .all(|r| r.requirement_uid != requirement_uid));
    assert_eq!(after.features.len(), features_before);
    assert!(after.relations.iter().all(|r| r.to_uid != requirement_uid));
}
