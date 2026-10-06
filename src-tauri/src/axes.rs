use std::future::Future;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::{CommandOutput, CommandRunner, ReadError};

/// The axes the project defines, which an element can be tagged with.
pub trait AxesRunner {
    fn axes_list(
        &self,
        project_root: &Path,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;

    /// Registers a new axis; `label` defaults to the id in the core when omitted.
    fn axes_add(
        &self,
        project_root: &Path,
        id: &str,
        label: Option<&str>,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;
}

impl AxesRunner for CommandRunner {
    async fn axes_list(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["axes", "list", "--json", "--dir"])
            .arg(project_root);
        self.run(command).await
    }

    async fn axes_add(
        &self,
        project_root: &Path,
        id: &str,
        label: Option<&str>,
    ) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["axes", "add", "--json", "--dir"])
            .arg(project_root);
        if let Some(label) = label {
            // `--label=` keeps a label that starts with `-` from being read as an option.
            command.arg(format!("--label={label}"));
        }
        // After `--`, an id that starts with `-` is still read as the id.
        command.args(["--", id]);
        self.run(command).await
    }
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Axis {
    pub id: String,
    pub label: String,
}

pub async fn read_axes(
    runner: &impl AxesRunner,
    project_root: &Path,
) -> Result<Vec<Axis>, ReadError> {
    let output = runner
        .axes_list(project_root)
        .await
        .map_err(ReadError::CannotRun)?;
    if output.exit_code != Some(0) {
        return Err(ReadError::CommandFailed {
            exit_code: output.exit_code,
            stderr: output.stderr,
        });
    }
    let value: serde_json::Value =
        serde_json::from_str(&output.stdout).map_err(|e| ReadError::NotJson(e.to_string()))?;
    serde_json::from_value(value).map_err(|e| ReadError::Malformed(e.to_string()))
}

/// Registers a new axis. On failure, what the core said is returned as it is.
pub async fn add_axis(
    runner: &impl AxesRunner,
    project_root: &Path,
    id: &str,
    label: Option<&str>,
) -> Result<(), String> {
    let output = runner.axes_add(project_root, id, label).await?;
    if output.exit_code != Some(0) {
        return Err(output.stderr);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    struct FakeRunner(Result<CommandOutput, String>);

    impl AxesRunner for FakeRunner {
        async fn axes_list(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            self.0.clone()
        }

        async fn axes_add(
            &self,
            _project_root: &Path,
            _id: &str,
            _label: Option<&str>,
        ) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }
    }

    struct AddRunner {
        reply: Result<CommandOutput, String>,
        added: Mutex<Vec<(String, Option<String>)>>,
    }

    impl AxesRunner for AddRunner {
        async fn axes_list(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn axes_add(
            &self,
            _project_root: &Path,
            id: &str,
            label: Option<&str>,
        ) -> Result<CommandOutput, String> {
            self.added
                .lock()
                .unwrap()
                .push((id.to_string(), label.map(str::to_string)));
            self.reply.clone()
        }
    }

    fn add_replying(exit_code: i32, stderr: &str) -> AddRunner {
        AddRunner {
            reply: Ok(CommandOutput {
                exit_code: Some(exit_code),
                stdout: r#"{"ok":true,"written":[]}"#.to_string(),
                stderr: stderr.to_string(),
            }),
            added: Mutex::new(Vec::new()),
        }
    }

    fn replying(exit_code: i32, stdout: &str) -> FakeRunner {
        FakeRunner(Ok(CommandOutput {
            exit_code: Some(exit_code),
            stdout: stdout.to_string(),
            stderr: String::new(),
        }))
    }

    #[tokio::test]
    async fn reads_the_ids_and_labels_of_the_axes() {
        let runner = replying(
            0,
            r#"[{"id":"functional","label":"機能"},{"id":"ui","label":"ui"}]"#,
        );

        let axes = read_axes(&runner, Path::new("/project")).await.unwrap();

        assert_eq!(
            axes,
            [
                Axis {
                    id: "functional".into(),
                    label: "機能".into()
                },
                Axis {
                    id: "ui".into(),
                    label: "ui".into()
                },
            ]
        );
    }

    #[tokio::test]
    async fn a_failing_command_returns_its_stderr() {
        let runner = FakeRunner(Ok(CommandOutput {
            exit_code: Some(1),
            stdout: String::new(),
            stderr: "error: not a project".to_string(),
        }));

        let result = read_axes(&runner, Path::new("/project")).await;

        assert_eq!(
            result,
            Err(ReadError::CommandFailed {
                exit_code: Some(1),
                stderr: "error: not a project".into()
            })
        );
    }

    #[tokio::test]
    async fn an_output_that_is_not_a_list_of_axes_is_malformed() {
        for stdout in [r#"{"axes":[]}"#, r#"[{"label":"ui"}]"#] {
            let result = read_axes(&replying(0, stdout), Path::new("/project")).await;

            assert!(matches!(result, Err(ReadError::Malformed(_))), "{stdout}");
        }
    }

    #[tokio::test]
    async fn an_output_that_is_not_json_is_reported_as_such() {
        let result = read_axes(&replying(0, "not json"), Path::new("/project")).await;

        assert!(matches!(result, Err(ReadError::NotJson(_))));
    }

    #[tokio::test]
    async fn adding_an_axis_passes_its_id_and_label_to_the_core() {
        let runner = add_replying(0, "");

        let result = add_axis(&runner, Path::new("/project"), "perf", Some("性能")).await;

        assert_eq!(result, Ok(()));
        assert_eq!(
            *runner.added.lock().unwrap(),
            [("perf".to_string(), Some("性能".to_string()))]
        );
    }

    #[tokio::test]
    async fn a_refused_axis_returns_the_stderr_of_the_core() {
        let runner = add_replying(
            2,
            "error: axis 'perf' already exists under .markharness/axes/",
        );

        let result = add_axis(&runner, Path::new("/project"), "perf", None).await;

        assert_eq!(
            result,
            Err("error: axis 'perf' already exists under .markharness/axes/".to_string())
        );
    }

    #[tokio::test]
    async fn a_core_that_cannot_be_run_returns_why() {
        let runner = AddRunner {
            reply: Err("markharness: not found".to_string()),
            added: Mutex::new(Vec::new()),
        };

        let result = add_axis(&runner, Path::new("/project"), "perf", None).await;

        assert_eq!(result, Err("markharness: not found".to_string()));
    }
}
