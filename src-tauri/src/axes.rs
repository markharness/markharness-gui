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
}

impl AxesRunner for CommandRunner {
    async fn axes_list(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["axes", "list", "--json", "--dir"])
            .arg(project_root);
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

#[cfg(test)]
mod tests {
    use super::*;

    struct FakeRunner(Result<CommandOutput, String>);

    impl AxesRunner for FakeRunner {
        async fn axes_list(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            self.0.clone()
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
}
