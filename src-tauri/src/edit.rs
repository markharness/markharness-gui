use std::future::Future;
use std::path::Path;
use std::process::Stdio;

use serde::Deserialize;
use tokio::io::AsyncWriteExt;

use crate::detail::{ScenarioPhase, ScenarioStep};
use crate::traceability::{CommandOutput, CommandRunner};

/// A common procedure of a behavior: the steps scenarios call by its name.
#[derive(Debug, PartialEq, Deserialize)]
pub struct NamedProcedure {
    pub name: String,
    pub steps: Vec<String>,
}

/// One edit of an existing element; a field left `None` is not sent, so the core keeps its value.
#[derive(Debug, PartialEq, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Edit {
    Feature {
        uid: String,
        id: Option<String>,
        label: Option<String>,
        axis: Option<Vec<String>>,
    },
    Behavior {
        feature_uid: String,
        uid: String,
        id: Option<String>,
        label: Option<String>,
        description: Option<String>,
        axis: Option<Vec<String>>,
        procedures: Option<Vec<NamedProcedure>>,
    },
    Requirement {
        uid: String,
        id: Option<String>,
        label: Option<String>,
        description: Option<String>,
        axis: Option<Vec<String>>,
    },
    Scenario {
        feature_uid: String,
        behavior_uid: String,
        uid: String,
        id: Option<String>,
        label: Option<String>,
        description: Option<String>,
        implementation_note: Option<String>,
        phases: Option<Vec<ScenarioPhase>>,
    },
}

/// One new element, which the core creates when it gets no `uid` for it.
#[derive(Debug, PartialEq, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Create {
    Requirement {
        id: String,
        label: String,
        description: Option<String>,
        axis: Vec<String>,
    },
    Feature {
        id: String,
        label: String,
        /// The uids of the requirements the feature contributes to.
        contributes_to: Vec<String>,
        axis: Vec<String>,
    },
    Behavior {
        feature_uid: String,
        id: String,
        label: String,
        /// The core requires a description when it creates a behavior.
        description: String,
        axis: Vec<String>,
    },
    Scenario {
        feature_uid: String,
        behavior_uid: String,
        id: String,
        label: String,
        description: String,
        phases: Vec<ScenarioPhase>,
    },
}

/// A JSON string is also a YAML double-quoted scalar, so quotes, colons and newlines survive.
fn scalar(value: &str) -> String {
    serde_json::to_string(value).expect("a string always serializes")
}

fn list(values: &[String]) -> String {
    let items: Vec<String> = values.iter().map(|v| scalar(v)).collect();
    format!("[{}]", items.join(", "))
}

/// The phases of a scenario, written under a scenario whose fields sit at twelve spaces.
fn push_phases(lines: &mut Vec<String>, phases: &[ScenarioPhase]) {
    lines.push("            phases:".to_string());
    for phase in phases {
        lines.push("              - steps:".to_string());
        for step in &phase.steps {
            lines.push(match step {
                ScenarioStep::Action(text) => {
                    format!("                  - action: {}", scalar(text))
                }
                ScenarioStep::Use(name) => {
                    format!("                  - use: {}", scalar(name))
                }
            });
        }
        lines.push("                results:".to_string());
        for result in &phase.results {
            lines.push(format!("                  - {}", scalar(result)));
        }
    }
}

pub fn create_intent_yaml(create: &Create) -> String {
    let mut lines = vec![
        "format: markharness/knowledge-intent/v1".to_string(),
        "mode: merge".to_string(),
        String::new(),
    ];
    match create {
        Create::Requirement {
            id,
            label,
            description,
            axis,
        } => {
            lines.push("requirements:".to_string());
            lines.push(format!("  - id: {}", scalar(id)));
            lines.push("    source: native".to_string());
            lines.push(format!("    label: {}", scalar(label)));
            if let Some(description) = description {
                lines.push(format!("    description: {}", scalar(description)));
            }
            lines.push(format!("    axis: {}", list(axis)));
        }
        Create::Feature {
            id,
            label,
            contributes_to,
            axis,
        } => {
            lines.push("features:".to_string());
            lines.push(format!("  - id: {}", scalar(id)));
            lines.push(format!("    contributes_to: {}", list(contributes_to)));
            lines.push(format!("    label: {}", scalar(label)));
            lines.push(format!("    axis: {}", list(axis)));
        }
        Create::Behavior {
            feature_uid,
            id,
            label,
            description,
            axis,
        } => {
            lines.push("features:".to_string());
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - id: {}", scalar(id)));
            lines.push(format!("        label: {}", scalar(label)));
            lines.push(format!("        description: {}", scalar(description)));
            lines.push(format!("        axis: {}", list(axis)));
        }
        Create::Scenario {
            feature_uid,
            behavior_uid,
            id,
            label,
            description,
            phases,
        } => {
            lines.push("features:".to_string());
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - uid: {}", scalar(behavior_uid)));
            lines.push("        scenarios:".to_string());
            lines.push(format!("          - id: {}", scalar(id)));
            lines.push(format!("            label: {}", scalar(label)));
            lines.push(format!("            description: {}", scalar(description)));
            push_phases(&mut lines, phases);
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

pub fn intent_yaml(edit: &Edit) -> String {
    let root = match edit {
        Edit::Requirement { .. } => "requirements:",
        _ => "features:",
    };
    let mut lines = vec![
        "format: markharness/knowledge-intent/v1".to_string(),
        "mode: merge".to_string(),
        String::new(),
        root.to_string(),
    ];
    match edit {
        Edit::Feature {
            uid,
            id,
            label,
            axis,
        } => {
            lines.push(format!("  - uid: {}", scalar(uid)));
            if let Some(id) = id {
                lines.push(format!("    id: {}", scalar(id)));
            }
            if let Some(label) = label {
                lines.push(format!("    label: {}", scalar(label)));
            }
            if let Some(axis) = axis {
                lines.push(format!("    axis: {}", list(axis)));
            }
        }
        Edit::Behavior {
            feature_uid,
            uid,
            id,
            label,
            description,
            axis,
            procedures,
        } => {
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - uid: {}", scalar(uid)));
            if let Some(id) = id {
                lines.push(format!("        id: {}", scalar(id)));
            }
            if let Some(label) = label {
                lines.push(format!("        label: {}", scalar(label)));
            }
            if let Some(description) = description {
                lines.push(format!("        description: {}", scalar(description)));
            }
            if let Some(axis) = axis {
                lines.push(format!("        axis: {}", list(axis)));
            }
            if let Some(procedures) = procedures {
                lines.push("        procedures:".to_string());
                for procedure in procedures {
                    lines.push(format!("          - name: {}", scalar(&procedure.name)));
                    lines.push("            steps:".to_string());
                    for step in &procedure.steps {
                        lines.push(format!("              - {}", scalar(step)));
                    }
                }
            }
        }
        Edit::Requirement {
            uid,
            id,
            label,
            description,
            axis,
        } => {
            lines.push(format!("  - uid: {}", scalar(uid)));
            if let Some(id) = id {
                lines.push(format!("    id: {}", scalar(id)));
            }
            if let Some(label) = label {
                lines.push(format!("    label: {}", scalar(label)));
            }
            if let Some(description) = description {
                lines.push(format!("    description: {}", scalar(description)));
            }
            if let Some(axis) = axis {
                lines.push(format!("    axis: {}", list(axis)));
            }
        }
        Edit::Scenario {
            feature_uid,
            behavior_uid,
            uid,
            id,
            label,
            description,
            implementation_note,
            phases,
        } => {
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - uid: {}", scalar(behavior_uid)));
            lines.push("        scenarios:".to_string());
            lines.push(format!("          - uid: {}", scalar(uid)));
            if let Some(id) = id {
                lines.push(format!("            id: {}", scalar(id)));
            }
            if let Some(label) = label {
                lines.push(format!("            label: {}", scalar(label)));
            }
            if let Some(description) = description {
                lines.push(format!("            description: {}", scalar(description)));
            }
            if let Some(note) = implementation_note {
                lines.push(format!("            implementation_note: {}", scalar(note)));
            }
            if let Some(phases) = phases {
                push_phases(&mut lines, phases);
            }
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

/// The core command that writes knowledge; the intent is passed on stdin.
pub trait KnowledgeWriter {
    fn reconcile(
        &self,
        project_root: &Path,
        intent_yaml: &str,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;

    /// Rewrites the generated test cases from the knowledge.
    fn generate(
        &self,
        project_root: &Path,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;
}

impl KnowledgeWriter for CommandRunner {
    async fn reconcile(
        &self,
        project_root: &Path,
        intent_yaml: &str,
    ) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        // `-` reads the intent from stdin, so no temporary file is left behind.
        command
            .args(["knowledge", "reconcile", "-", "--json", "--dir"])
            .arg(project_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        let mut child = command
            .spawn()
            .map_err(|e| format!("{}: {e}", self.bin.display()))?;
        let mut stdin = child.stdin.take().expect("stdin was piped");
        stdin
            .write_all(intent_yaml.as_bytes())
            .await
            .map_err(|e| format!("{}: {e}", self.bin.display()))?;
        drop(stdin);
        let output = child
            .wait_with_output()
            .await
            .map_err(|e| format!("{}: {e}", self.bin.display()))?;
        Ok(CommandOutput {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }

    async fn generate(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["generate", "--json", "--dir"])
            .arg(project_root);
        self.run(command).await
    }
}

#[derive(Deserialize)]
struct Diagnostic {
    location: String,
    message: String,
}

/// Applies the edit through the core. On failure, what the core said is returned as it is:
/// its diagnostics when it refused the edit, its stderr otherwise.
pub async fn apply_edit(
    writer: &impl KnowledgeWriter,
    project_root: &Path,
    edit: &Edit,
) -> Result<(), String> {
    reconcile_and_generate(writer, project_root, &intent_yaml(edit)).await?;
    Ok(())
}

/// Creates the element through the core and returns the uid it gave, with the failures reported as
/// `apply_edit` does.
pub async fn apply_create(
    writer: &impl KnowledgeWriter,
    project_root: &Path,
    create: &Create,
) -> Result<String, String> {
    let reply = reconcile_and_generate(writer, project_root, &create_intent_yaml(create)).await?;
    reply
        .created
        .into_iter()
        .next()
        .map(|created| created.uid)
        .ok_or_else(|| "the core created nothing".to_string())
}

async fn reconcile_and_generate(
    writer: &impl KnowledgeWriter,
    project_root: &Path,
    intent_yaml: &str,
) -> Result<ReconcileReply, String> {
    let output = writer.reconcile(project_root, intent_yaml).await?;
    let Ok(reply) = serde_json::from_str::<ReconcileReply>(&output.stdout) else {
        return Err(output.stderr);
    };
    if !reply.ok {
        let lines: Vec<String> = reply
            .diagnostics
            .iter()
            .map(|d| format!("{}: {}", d.location, d.message))
            .collect();
        return Err(lines.join("\n"));
    }
    let generated = writer.generate(project_root).await?;
    if generated.exit_code != Some(0) {
        return Err(generated.stderr);
    }
    Ok(reply)
}

#[derive(Deserialize)]
struct ReconcileReply {
    ok: bool,
    #[serde(default)]
    diagnostics: Vec<Diagnostic>,
    #[serde(default)]
    created: Vec<Created>,
}

#[derive(Deserialize)]
struct Created {
    uid: String,
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[test]
    fn feature_axis_is_sent_selected_by_uid() {
        let edit = Edit::Feature {
            uid: "01FEATURE".into(),
            id: None,
            label: None,
            axis: Some(vec!["functional".into(), "ui".into()]),
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   axis: [\"functional\", \"ui\"]\n"
        );
    }

    #[test]
    fn behavior_is_nested_under_its_feature() {
        let edit = Edit::Behavior {
            feature_uid: "01FEATURE".into(),
            uid: "01BEHAVIOR".into(),
            id: None,
            label: None,
            description: Some("説明".into()),
            axis: Some(vec!["ui".into()]),
            procedures: None,
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       description: \"説明\"\n\
             \x20       axis: [\"ui\"]\n"
        );
    }

    #[test]
    fn scenario_is_nested_under_its_feature_and_behavior() {
        let edit = Edit::Scenario {
            feature_uid: "01FEATURE".into(),
            behavior_uid: "01BEHAVIOR".into(),
            uid: "01SCENARIO".into(),
            id: None,
            label: None,
            description: Some("説明".into()),
            implementation_note: Some("メモ".into()),
            phases: None,
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       scenarios:\n\
             \x20         - uid: \"01SCENARIO\"\n\
             \x20           description: \"説明\"\n\
             \x20           implementation_note: \"メモ\"\n"
        );
    }

    #[test]
    fn requirement_is_sent_under_requirements() {
        let edit = Edit::Requirement {
            uid: "01REQUIREMENT".into(),
            id: None,
            label: None,
            description: Some("説明".into()),
            axis: Some(vec![]),
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             requirements:\n\
             \x20 - uid: \"01REQUIREMENT\"\n\
             \x20   description: \"説明\"\n\
             \x20   axis: []\n"
        );
    }

    #[test]
    fn fields_left_unset_are_not_sent() {
        let edit = Edit::Behavior {
            feature_uid: "01FEATURE".into(),
            uid: "01BEHAVIOR".into(),
            id: None,
            label: None,
            description: None,
            axis: Some(vec!["ui".into()]),
            procedures: None,
        };

        let yaml = intent_yaml(&edit);

        assert!(!yaml.contains("description"));
        assert!(yaml.contains("axis: [\"ui\"]"));
    }

    #[test]
    fn quotes_colons_and_newlines_stay_inside_one_scalar() {
        let edit = Edit::Scenario {
            feature_uid: "01FEATURE".into(),
            behavior_uid: "01BEHAVIOR".into(),
            uid: "01SCENARIO".into(),
            id: None,
            label: None,
            description: None,
            implementation_note: Some("a: \"b\"\nc # d".into()),
            phases: None,
        };

        assert!(intent_yaml(&edit)
            .ends_with("            implementation_note: \"a: \\\"b\\\"\\nc # d\"\n"));
    }

    struct FakeWriter {
        reply: Result<CommandOutput, String>,
        intents: Mutex<Vec<String>>,
        generate_reply: Result<CommandOutput, String>,
        generated: Mutex<usize>,
    }

    impl FakeWriter {
        fn replying(exit_code: i32, stdout: &str) -> Self {
            FakeWriter {
                reply: Ok(CommandOutput {
                    exit_code: Some(exit_code),
                    stdout: stdout.to_string(),
                    stderr: String::new(),
                }),
                intents: Mutex::new(Vec::new()),
                generate_reply: Ok(CommandOutput {
                    exit_code: Some(0),
                    stdout: r#"{"ok":true}"#.to_string(),
                    stderr: String::new(),
                }),
                generated: Mutex::new(0),
            }
        }
    }

    impl KnowledgeWriter for FakeWriter {
        async fn reconcile(
            &self,
            _project_root: &Path,
            intent_yaml: &str,
        ) -> Result<CommandOutput, String> {
            self.intents.lock().unwrap().push(intent_yaml.to_string());
            self.reply.clone()
        }

        async fn generate(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            *self.generated.lock().unwrap() += 1;
            self.generate_reply.clone()
        }
    }

    fn feature_axis_edit() -> Edit {
        Edit::Feature {
            uid: "01FEATURE".into(),
            id: None,
            label: None,
            axis: Some(vec!["ui".into()]),
        }
    }

    #[tokio::test]
    async fn a_reconcile_that_succeeds_is_an_applied_edit() {
        let writer =
            FakeWriter::replying(0, r#"{"ok":true,"created":[],"updated":[],"unchanged":[]}"#);
        let edit = feature_axis_edit();

        let result = apply_edit(&writer, Path::new("/project"), &edit).await;

        assert_eq!(result, Ok(()));
        assert_eq!(*writer.intents.lock().unwrap(), vec![intent_yaml(&edit)]);
    }

    #[tokio::test]
    async fn a_reconcile_that_refuses_returns_the_diagnostics_of_the_core() {
        let writer = FakeWriter::replying(
            1,
            r#"{"ok":false,"diagnostics":[{"code":"missing_required_field","location":"features[0].description","message":"must not be empty"}]}"#,
        );

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(
            result,
            Err("features[0].description: must not be empty".to_string())
        );
    }

    #[tokio::test]
    async fn a_failure_without_diagnostics_returns_the_stderr_of_the_core() {
        let writer = FakeWriter {
            reply: Ok(CommandOutput {
                exit_code: Some(2),
                stdout: String::new(),
                stderr: "error: no such project".to_string(),
            }),
            ..FakeWriter::replying(0, "")
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(result, Err("error: no such project".to_string()));
    }

    #[tokio::test]
    async fn a_core_that_cannot_be_run_is_reported_as_such() {
        let writer = FakeWriter {
            reply: Err("markharness: not found".to_string()),
            ..FakeWriter::replying(0, "")
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(result, Err("markharness: not found".to_string()));
    }

    #[tokio::test]
    async fn generate_runs_once_after_a_reconcile_that_succeeds() {
        let writer = FakeWriter::replying(0, r#"{"ok":true}"#);

        apply_edit(&writer, Path::new("/project"), &feature_axis_edit())
            .await
            .unwrap();

        assert_eq!(*writer.generated.lock().unwrap(), 1);
    }

    #[tokio::test]
    async fn generate_does_not_run_when_the_edit_was_not_written() {
        let writer = FakeWriter::replying(1, r#"{"ok":false,"diagnostics":[]}"#);

        let _ = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(*writer.generated.lock().unwrap(), 0);
    }

    #[tokio::test]
    async fn a_failing_generate_returns_the_stderr_of_the_core() {
        let writer = FakeWriter {
            generate_reply: Ok(CommandOutput {
                exit_code: Some(1),
                stdout: String::new(),
                stderr: "error: cannot write generated/".to_string(),
            }),
            ..FakeWriter::replying(0, r#"{"ok":true}"#)
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(result, Err("error: cannot write generated/".to_string()));
    }

    #[test]
    fn an_edit_is_read_from_the_json_of_the_screen() {
        let edit: Edit = serde_json::from_str(
            r#"{"kind":"behavior","feature_uid":"F","uid":"B","description":"説明"}"#,
        )
        .unwrap();

        assert_eq!(
            edit,
            Edit::Behavior {
                feature_uid: "F".into(),
                uid: "B".into(),
                id: None,
                label: None,
                description: Some("説明".into()),
                axis: None,
                procedures: None,
            }
        );
    }

    #[test]
    fn feature_label_is_sent_before_the_axis() {
        let edit = Edit::Feature {
            uid: "01FEATURE".into(),
            id: None,
            label: Some("a: b".into()),
            axis: Some(vec!["ui".into()]),
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   label: \"a: b\"\n\
             \x20   axis: [\"ui\"]\n"
        );
    }

    #[test]
    fn behavior_label_is_sent_before_the_description() {
        let edit = Edit::Behavior {
            feature_uid: "01FEATURE".into(),
            uid: "01BEHAVIOR".into(),
            id: None,
            label: Some("名前".into()),
            description: Some("説明".into()),
            axis: None,
            procedures: None,
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       label: \"名前\"\n\
             \x20       description: \"説明\"\n"
        );
    }

    #[test]
    fn scenario_label_is_sent_before_the_description() {
        let edit = Edit::Scenario {
            feature_uid: "01FEATURE".into(),
            behavior_uid: "01BEHAVIOR".into(),
            uid: "01SCENARIO".into(),
            id: None,
            label: Some("名前".into()),
            description: Some("説明".into()),
            implementation_note: None,
            phases: None,
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       scenarios:\n\
             \x20         - uid: \"01SCENARIO\"\n\
             \x20           label: \"名前\"\n\
             \x20           description: \"説明\"\n"
        );
    }

    #[test]
    fn requirement_label_is_sent_before_the_description() {
        let edit = Edit::Requirement {
            uid: "01REQUIREMENT".into(),
            id: None,
            label: Some("名前".into()),
            description: Some("説明".into()),
            axis: None,
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             requirements:\n\
             \x20 - uid: \"01REQUIREMENT\"\n\
             \x20   label: \"名前\"\n\
             \x20   description: \"説明\"\n"
        );
    }

    #[test]
    fn scenario_phases_are_sent_whole_with_actions_and_procedure_calls() {
        let edit = Edit::Scenario {
            feature_uid: "01FEATURE".into(),
            behavior_uid: "01BEHAVIOR".into(),
            uid: "01SCENARIO".into(),
            id: None,
            label: None,
            description: None,
            implementation_note: None,
            phases: Some(vec![
                ScenarioPhase {
                    steps: vec![
                        ScenarioStep::Use("seed".into()),
                        ScenarioStep::Action("クリックする".into()),
                    ],
                    results: vec!["表示される".into()],
                },
                ScenarioPhase {
                    steps: vec![ScenarioStep::Action("確認する".into())],
                    results: vec!["a".into(), "b".into()],
                },
            ]),
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       scenarios:\n\
             \x20         - uid: \"01SCENARIO\"\n\
             \x20           phases:\n\
             \x20             - steps:\n\
             \x20                 - use: \"seed\"\n\
             \x20                 - action: \"クリックする\"\n\
             \x20               results:\n\
             \x20                 - \"表示される\"\n\
             \x20             - steps:\n\
             \x20                 - action: \"確認する\"\n\
             \x20               results:\n\
             \x20                 - \"a\"\n\
             \x20                 - \"b\"\n"
        );
    }

    #[test]
    fn scenario_phases_are_read_from_the_json_of_the_screen() {
        let edit: Edit = serde_json::from_str(
            r#"{"kind":"scenario","feature_uid":"F","behavior_uid":"B","uid":"S",
                "phases":[{"steps":[{"use":"seed"},{"action":"押す"}],"results":["出る"]}]}"#,
        )
        .unwrap();

        assert_eq!(
            edit,
            Edit::Scenario {
                feature_uid: "F".into(),
                behavior_uid: "B".into(),
                uid: "S".into(),
                id: None,
                label: None,
                description: None,
                implementation_note: None,
                phases: Some(vec![ScenarioPhase {
                    steps: vec![
                        ScenarioStep::Use("seed".into()),
                        ScenarioStep::Action("押す".into()),
                    ],
                    results: vec!["出る".into()],
                }]),
            }
        );
    }

    #[test]
    fn behavior_procedures_are_sent_whole_by_name_and_steps() {
        let edit = Edit::Behavior {
            feature_uid: "01FEATURE".into(),
            uid: "01BEHAVIOR".into(),
            id: None,
            label: None,
            description: None,
            axis: None,
            procedures: Some(vec![
                NamedProcedure {
                    name: "seed".into(),
                    steps: vec!["開く".into(), "入力する".into()],
                },
                NamedProcedure {
                    name: "login".into(),
                    steps: vec!["ログインする".into()],
                },
            ]),
        };

        assert_eq!(
            intent_yaml(&edit),
            "format: markharness/knowledge-intent/v1\n\
             mode: merge\n\
             \n\
             features:\n\
             \x20 - uid: \"01FEATURE\"\n\
             \x20   behaviors:\n\
             \x20     - uid: \"01BEHAVIOR\"\n\
             \x20       procedures:\n\
             \x20         - name: \"seed\"\n\
             \x20           steps:\n\
             \x20             - \"開く\"\n\
             \x20             - \"入力する\"\n\
             \x20         - name: \"login\"\n\
             \x20           steps:\n\
             \x20             - \"ログインする\"\n"
        );
    }

    #[test]
    fn behavior_procedures_are_read_from_the_json_of_the_screen() {
        let edit: Edit = serde_json::from_str(
            r#"{"kind":"behavior","feature_uid":"F","uid":"B",
                "procedures":[{"name":"seed","steps":["開く"]}]}"#,
        )
        .unwrap();

        assert_eq!(
            edit,
            Edit::Behavior {
                feature_uid: "F".into(),
                uid: "B".into(),
                id: None,
                label: None,
                description: None,
                axis: None,
                procedures: Some(vec![NamedProcedure {
                    name: "seed".into(),
                    steps: vec!["開く".into()],
                }]),
            }
        );
    }

    #[test]
    fn a_changed_id_is_sent_before_the_label_of_each_kind_of_element() {
        let feature = Edit::Feature {
            uid: "F".into(),
            id: Some("new-feature".into()),
            label: Some("名前".into()),
            axis: None,
        };
        let behavior = Edit::Behavior {
            feature_uid: "F".into(),
            uid: "B".into(),
            id: Some("new-behavior".into()),
            label: None,
            description: None,
            axis: None,
            procedures: None,
        };
        let scenario = Edit::Scenario {
            feature_uid: "F".into(),
            behavior_uid: "B".into(),
            uid: "S".into(),
            id: Some("new-scenario".into()),
            label: Some("名前".into()),
            description: None,
            implementation_note: None,
            phases: None,
        };
        let requirement = Edit::Requirement {
            uid: "R".into(),
            id: Some("new-requirement".into()),
            label: Some("名前".into()),
            description: None,
            axis: None,
        };

        assert!(intent_yaml(&feature).ends_with(
            "  - uid: \"F\"
    id: \"new-feature\"
    label: \"名前\"
"
        ));
        assert!(intent_yaml(&behavior).ends_with(
            "      - uid: \"B\"
        id: \"new-behavior\"
"
        ));
        assert!(intent_yaml(&scenario).ends_with(
            "          - uid: \"S\"
            id: \"new-scenario\"
            label: \"名前\"
"
        ));
        assert!(intent_yaml(&requirement).ends_with(
            "  - uid: \"R\"
    id: \"new-requirement\"
    label: \"名前\"
"
        ));
    }

    #[test]
    fn a_new_requirement_is_sent_without_a_uid_so_the_core_creates_it() {
        let create = Create::Requirement {
            id: "new-requirement".into(),
            label: "新しい要求".into(),
            description: Some("説明".into()),
            axis: vec!["ui".into()],
        };

        assert_eq!(
            create_intent_yaml(&create),
            [
                "format: markharness/knowledge-intent/v1",
                "mode: merge",
                "",
                "requirements:",
                "  - id: \"new-requirement\"",
                "    source: native",
                "    label: \"新しい要求\"",
                "    description: \"説明\"",
                "    axis: [\"ui\"]",
                "",
            ]
            .join("\n")
        );
    }

    #[test]
    fn a_new_requirement_without_a_description_leaves_it_out() {
        let create = Create::Requirement {
            id: "r".into(),
            label: "名前".into(),
            description: None,
            axis: vec![],
        };

        assert!(!create_intent_yaml(&create).contains("description"));
    }

    #[tokio::test]
    async fn creating_returns_the_uid_the_core_gave_and_generates_once() {
        let writer = FakeWriter::replying(
            0,
            r#"{"ok":true,"created":[{"kind":"requirement","uid":"01NEW","id":"r","path":"p"}],"updated":[],"unchanged":[]}"#,
        );
        let create = Create::Requirement {
            id: "r".into(),
            label: "名前".into(),
            description: None,
            axis: vec![],
        };

        let uid = apply_create(&writer, Path::new("."), &create).await;

        assert_eq!(uid, Ok("01NEW".to_string()));
        assert_eq!(*writer.generated.lock().unwrap(), 1);
    }

    #[tokio::test]
    async fn a_refused_creation_returns_the_diagnostics_as_they_are_and_does_not_generate() {
        let writer = FakeWriter::replying(
            2,
            r#"{"ok":false,"diagnostics":[{"code":"ambiguous_identity","location":"requirements[0]","message":"already exists"}]}"#,
        );
        let create = Create::Requirement {
            id: "r".into(),
            label: "名前".into(),
            description: None,
            axis: vec![],
        };

        let result = apply_create(&writer, Path::new("."), &create).await;

        assert_eq!(result, Err("requirements[0]: already exists".to_string()));
        assert_eq!(*writer.generated.lock().unwrap(), 0);
    }

    #[test]
    fn a_new_feature_names_the_requirements_it_contributes_to_by_uid() {
        let create = Create::Feature {
            id: "new-feature".into(),
            label: "新しい機能".into(),
            contributes_to: vec!["01REQ".into(), "01REQ2".into()],
            axis: vec![],
        };

        assert_eq!(
            create_intent_yaml(&create),
            [
                "format: markharness/knowledge-intent/v1",
                "mode: merge",
                "",
                "features:",
                "  - id: \"new-feature\"",
                "    contributes_to: [\"01REQ\", \"01REQ2\"]",
                "    label: \"新しい機能\"",
                "    axis: []",
                "",
            ]
            .join("\n")
        );
    }

    #[test]
    fn a_new_behavior_is_sent_under_its_feature_with_a_description() {
        let create = Create::Behavior {
            feature_uid: "01FEATURE".into(),
            id: "new-behavior".into(),
            label: "新しい振る舞い".into(),
            description: "説明".into(),
            axis: vec!["ui".into()],
        };

        assert_eq!(
            create_intent_yaml(&create),
            [
                "format: markharness/knowledge-intent/v1",
                "mode: merge",
                "",
                "features:",
                "  - uid: \"01FEATURE\"",
                "    behaviors:",
                "      - id: \"new-behavior\"",
                "        label: \"新しい振る舞い\"",
                "        description: \"説明\"",
                "        axis: [\"ui\"]",
                "",
            ]
            .join("\n")
        );
    }

    #[test]
    fn a_new_scenario_is_sent_under_its_feature_and_behavior_with_its_phases() {
        let create = Create::Scenario {
            feature_uid: "01FEATURE".into(),
            behavior_uid: "01BEHAVIOR".into(),
            id: "new-scenario".into(),
            label: "新しいシナリオ".into(),
            description: "説明".into(),
            phases: vec![ScenarioPhase {
                steps: vec![
                    ScenarioStep::Use("seed".into()),
                    ScenarioStep::Action("押す".into()),
                ],
                results: vec!["出る".into()],
            }],
        };

        assert_eq!(
            create_intent_yaml(&create),
            [
                "format: markharness/knowledge-intent/v1",
                "mode: merge",
                "",
                "features:",
                "  - uid: \"01FEATURE\"",
                "    behaviors:",
                "      - uid: \"01BEHAVIOR\"",
                "        scenarios:",
                "          - id: \"new-scenario\"",
                "            label: \"新しいシナリオ\"",
                "            description: \"説明\"",
                "            phases:",
                "              - steps:",
                "                  - use: \"seed\"",
                "                  - action: \"押す\"",
                "                results:",
                "                  - \"出る\"",
                "",
            ]
            .join(
                "
"
            )
        );
    }
}
