use std::future::Future;
use std::path::Path;
use std::process::Stdio;

use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

use crate::traceability::{CommandOutput, CommandRunner};

/// One edit of an existing element; a field left `None` is not sent, so the core keeps its value.
#[derive(Debug, PartialEq, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Edit {
    Feature {
        uid: String,
        axis: Option<Vec<String>>,
    },
    Behavior {
        feature_uid: String,
        uid: String,
        description: Option<String>,
        axis: Option<Vec<String>>,
    },
    Requirement {
        uid: String,
        description: Option<String>,
        axis: Option<Vec<String>>,
    },
    Scenario {
        feature_uid: String,
        behavior_uid: String,
        uid: String,
        description: Option<String>,
        implementation_note: Option<String>,
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
        Edit::Feature { uid, axis } => {
            lines.push(format!("  - uid: {}", scalar(uid)));
            if let Some(axis) = axis {
                lines.push(format!("    axis: {}", list(axis)));
            }
        }
        Edit::Behavior {
            feature_uid,
            uid,
            description,
            axis,
        } => {
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - uid: {}", scalar(uid)));
            if let Some(description) = description {
                lines.push(format!("        description: {}", scalar(description)));
            }
            if let Some(axis) = axis {
                lines.push(format!("        axis: {}", list(axis)));
            }
        }
        Edit::Requirement {
            uid,
            description,
            axis,
        } => {
            lines.push(format!("  - uid: {}", scalar(uid)));
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
            description,
            implementation_note,
        } => {
            lines.push(format!("  - uid: {}", scalar(feature_uid)));
            lines.push("    behaviors:".to_string());
            lines.push(format!("      - uid: {}", scalar(behavior_uid)));
            lines.push("        scenarios:".to_string());
            lines.push(format!("          - uid: {}", scalar(uid)));
            if let Some(description) = description {
                lines.push(format!("            description: {}", scalar(description)));
            }
            if let Some(note) = implementation_note {
                lines.push(format!("            implementation_note: {}", scalar(note)));
            }
        }
    }
    lines.push(String::new());
    lines.join(
        "
",
    )
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

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "kind", content = "detail", rename_all = "snake_case")]
pub enum EditError {
    CannotRun(String),
    /// The core refused the edit and said why; nothing was written.
    Rejected(Vec<Diagnostic>),
    /// The core failed without a diagnostic to read; its stderr is shown as is.
    ReconcileFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
    /// The edit is written, but the generated test cases did not follow it.
    GenerateFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub location: String,
    pub message: String,
}

pub async fn apply_edit(
    writer: &impl KnowledgeWriter,
    project_root: &Path,
    edit: &Edit,
) -> Result<(), EditError> {
    let output = writer
        .reconcile(project_root, &intent_yaml(edit))
        .await
        .map_err(EditError::CannotRun)?;
    let Ok(reply) = serde_json::from_str::<ReconcileReply>(&output.stdout) else {
        return Err(EditError::ReconcileFailed {
            exit_code: output.exit_code,
            stderr: output.stderr,
        });
    };
    if !reply.ok {
        return Err(EditError::Rejected(reply.diagnostics));
    }
    let generated = writer
        .generate(project_root)
        .await
        .map_err(EditError::CannotRun)?;
    if generated.exit_code != Some(0) {
        return Err(EditError::GenerateFailed {
            exit_code: generated.exit_code,
            stderr: generated.stderr,
        });
    }
    Ok(())
}

#[derive(Deserialize)]
struct ReconcileReply {
    ok: bool,
    #[serde(default)]
    diagnostics: Vec<Diagnostic>,
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    #[test]
    fn feature_axis_is_sent_selected_by_uid() {
        let edit = Edit::Feature {
            uid: "01FEATURE".into(),
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
            description: Some("説明".into()),
            axis: Some(vec!["ui".into()]),
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
            description: Some("説明".into()),
            implementation_note: Some("メモ".into()),
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
            description: None,
            axis: Some(vec!["ui".into()]),
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
            description: None,
            implementation_note: Some("a: \"b\"\nc # d".into()),
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
            Err(EditError::Rejected(vec![Diagnostic {
                location: "features[0].description".into(),
                message: "must not be empty".into(),
            }]))
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

        assert_eq!(
            result,
            Err(EditError::ReconcileFailed {
                exit_code: Some(2),
                stderr: "error: no such project".into(),
            })
        );
    }

    #[tokio::test]
    async fn a_core_that_cannot_be_run_is_reported_as_such() {
        let writer = FakeWriter {
            reply: Err("markharness: not found".to_string()),
            ..FakeWriter::replying(0, "")
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(
            result,
            Err(EditError::CannotRun("markharness: not found".into()))
        );
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
    async fn a_failing_generate_is_not_reported_as_a_failed_edit() {
        let writer = FakeWriter {
            generate_reply: Ok(CommandOutput {
                exit_code: Some(1),
                stdout: String::new(),
                stderr: "error: cannot write generated/".to_string(),
            }),
            ..FakeWriter::replying(0, r#"{"ok":true}"#)
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(
            result,
            Err(EditError::GenerateFailed {
                exit_code: Some(1),
                stderr: "error: cannot write generated/".into(),
            })
        );
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
                description: Some("説明".into()),
                axis: None,
            }
        );
    }

    #[test]
    fn an_error_tells_the_screen_which_step_failed() {
        let rejected = EditError::Rejected(vec![Diagnostic {
            location: "features[0].description".into(),
            message: "must not be empty".into(),
        }]);
        let generate_failed = EditError::GenerateFailed {
            exit_code: Some(1),
            stderr: "boom".into(),
        };

        assert_eq!(
            serde_json::to_value(&rejected).unwrap(),
            serde_json::json!({"kind":"rejected","detail":[{"location":"features[0].description","message":"must not be empty"}]})
        );
        assert_eq!(
            serde_json::to_value(&generate_failed).unwrap(),
            serde_json::json!({"kind":"generate_failed","detail":{"exit_code":1,"stderr":"boom"}})
        );
    }
}
