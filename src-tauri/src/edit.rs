use std::future::Future;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::CommandOutput;

/// One edit of an existing element; a field left `None` is not sent, so the core keeps its value.
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
}

#[derive(Debug, PartialEq)]
pub enum EditError {
    CannotRun(String),
    /// The core refused the edit and said why; nothing was written.
    Rejected(Vec<Diagnostic>),
    /// The core failed without a diagnostic to read; its stderr is shown as is.
    ReconcileFailed {
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
    if reply.ok {
        Ok(())
    } else {
        Err(EditError::Rejected(reply.diagnostics))
    }
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
            intents: Mutex::new(Vec::new()),
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
            intents: Mutex::new(Vec::new()),
        };

        let result = apply_edit(&writer, Path::new("/project"), &feature_axis_edit()).await;

        assert_eq!(
            result,
            Err(EditError::CannotRun("markharness: not found".into()))
        );
    }
}
