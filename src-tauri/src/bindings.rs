use std::future::Future;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::{CommandOutput, CommandRunner, ReadError};

/// The verification means the cases declare, kept apart from the knowledge.
pub trait BindingsRunner {
    fn binding_list(
        &self,
        project_root: &Path,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;

    /// Declares the means of one case, replacing the one it had; no `reference` leaves it without one.
    fn binding_set(
        &self,
        project_root: &Path,
        case_uid: &str,
        mode: &str,
        reference: Option<&str>,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;
}

impl BindingsRunner for CommandRunner {
    async fn binding_list(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["binding", "list", "--json", "--dir"])
            .arg(project_root);
        self.run(command).await
    }

    async fn binding_set(
        &self,
        project_root: &Path,
        case_uid: &str,
        mode: &str,
        reference: Option<&str>,
    ) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["binding", "set", "--json", "--dir"])
            .arg(project_root)
            .arg(format!("--case-uid={case_uid}"))
            .arg(format!("--mode={mode}"));
        if let Some(reference) = reference {
            // `--reference=` keeps a reference that starts with `-` from being read as an option.
            command.arg(format!("--reference={reference}"));
        }
        self.run(command).await
    }
}

/// What a case declares in the working tree. Declaring a means does not mean anything ran.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Binding {
    pub case_uid: String,
    pub mode: String,
    pub reference: Option<String>,
}

#[derive(Deserialize)]
struct Listed {
    bindings: Vec<Binding>,
}

pub async fn read_bindings(
    runner: &impl BindingsRunner,
    project_root: &Path,
) -> Result<Vec<Binding>, ReadError> {
    let output = runner
        .binding_list(project_root)
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
    let listed: Listed =
        serde_json::from_value(value).map_err(|e| ReadError::Malformed(e.to_string()))?;
    Ok(listed.bindings)
}

/// Declares the means of a case. On failure, what the core said is returned as it is.
pub async fn set_binding(
    runner: &impl BindingsRunner,
    project_root: &Path,
    case_uid: &str,
    mode: &str,
    reference: Option<&str>,
) -> Result<(), String> {
    let output = runner
        .binding_set(project_root, case_uid, mode, reference)
        .await?;
    if output.exit_code != Some(0) {
        return Err(output.stderr);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;

    struct FakeRunner {
        reply: Result<CommandOutput, String>,
        asked: Mutex<Vec<(String, String, Option<String>)>>,
    }

    impl FakeRunner {
        fn replying(stdout: &str, exit_code: i32, stderr: &str) -> Self {
            Self {
                reply: Ok(CommandOutput {
                    exit_code: Some(exit_code),
                    stdout: stdout.to_string(),
                    stderr: stderr.to_string(),
                }),
                asked: Mutex::new(vec![]),
            }
        }
    }

    impl BindingsRunner for FakeRunner {
        async fn binding_list(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            self.reply.clone()
        }

        async fn binding_set(
            &self,
            _project_root: &Path,
            case_uid: &str,
            mode: &str,
            reference: Option<&str>,
        ) -> Result<CommandOutput, String> {
            self.asked.lock().unwrap().push((
                case_uid.to_string(),
                mode.to_string(),
                reference.map(str::to_string),
            ));
            self.reply.clone()
        }
    }

    #[tokio::test]
    async fn reads_the_means_each_case_declares() {
        let runner = FakeRunner::replying(
            r#"{"bindings":[
                {"case_uid":"C1","mode":"automated","record_kind":"execution_binding","reference":"tests/a.ts","schema_version":1},
                {"case_uid":"C2","mode":"manual","record_kind":"execution_binding","schema_version":1}
              ],"outcome":"bindings_listed","schema_version":1}"#,
            0,
            "",
        );

        let bindings = read_bindings(&runner, Path::new(".")).await.unwrap();

        assert_eq!(
            bindings,
            vec![
                Binding {
                    case_uid: "C1".into(),
                    mode: "automated".into(),
                    reference: Some("tests/a.ts".into()),
                },
                Binding {
                    case_uid: "C2".into(),
                    mode: "manual".into(),
                    reference: None,
                },
            ]
        );
    }

    #[tokio::test]
    async fn a_failed_list_is_reported_with_what_the_core_said() {
        let runner = FakeRunner::replying("", 2, "broken binding");

        let error = read_bindings(&runner, Path::new(".")).await.unwrap_err();

        assert!(error.to_string().contains("broken binding"));
    }

    #[tokio::test]
    async fn sets_the_means_of_a_case_with_or_without_a_reference() {
        let runner = FakeRunner::replying("{}", 0, "");

        let with = set_binding(
            &runner,
            Path::new("."),
            "C1",
            "automated",
            Some("tests/a.ts"),
        )
        .await;
        let without = set_binding(&runner, Path::new("."), "C2", "manual", None).await;

        assert_eq!((with, without), (Ok(()), Ok(())));
        assert_eq!(
            *runner.asked.lock().unwrap(),
            vec![
                (
                    "C1".to_string(),
                    "automated".to_string(),
                    Some("tests/a.ts".to_string())
                ),
                ("C2".to_string(), "manual".to_string(), None),
            ]
        );
    }

    #[tokio::test]
    async fn a_refused_set_returns_the_core_message_as_it_is() {
        let runner = FakeRunner::replying("", 2, "invalid case uid");

        let result = set_binding(&runner, Path::new("."), "../x", "manual", None).await;

        assert_eq!(result, Err("invalid case uid".to_string()));
    }
}
