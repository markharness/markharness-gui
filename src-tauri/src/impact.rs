use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::{parse_record, MarkharnessRunner, ReadError};

/// What the core reports about the requirements touched between two revisions.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ChangeImpact {
    pub requirements: Vec<ImpactRequirement>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ImpactRequirement {
    pub requirement_uid: String,
    /// Empty when no case relates to the requirement.
    pub cases: Vec<ImpactCase>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ImpactCase {
    pub case_uid: String,
    pub status: ImpactStatus,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ImpactStatus {
    Confirmed,
    FollowedUp,
    Unconfirmed,
}

/// Reads `base..HEAD`; `base` is passed on as given, so the core says if it is not a revision.
pub async fn read_impact(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    base: &str,
) -> Result<ChangeImpact, ReadError> {
    let output = runner
        .impact(project_root, base)
        .await
        .map_err(ReadError::CannotRun)?;
    let value = parse_record(output, "change_impact")?;
    serde_json::from_value(value).map_err(|e| ReadError::Malformed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::Mutex;

    use super::*;
    use crate::traceability::{CommandOutput, MarkharnessRunner};

    const REPRESENTATIVE: &str = include_str!("../tests/fixtures/impact_representative.json");

    struct FakeRunner {
        output: CommandOutput,
        asked_base: Mutex<Option<String>>,
    }

    impl FakeRunner {
        fn answering(stdout: &str) -> Self {
            FakeRunner {
                output: CommandOutput {
                    exit_code: Some(0),
                    stdout: stdout.to_string(),
                    stderr: String::new(),
                },
                asked_base: Mutex::new(None),
            }
        }
    }

    impl MarkharnessRunner for FakeRunner {
        async fn traceability(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn coverage(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn traceability_show(
            &self,
            _project_root: &Path,
            _uid: &str,
        ) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn impact(&self, _project_root: &Path, base: &str) -> Result<CommandOutput, String> {
            *self.asked_base.lock().unwrap() = Some(base.to_string());
            Ok(self.output.clone())
        }
    }

    #[tokio::test]
    async fn reads_the_status_of_each_case_of_each_touched_requirement() {
        let runner = FakeRunner::answering(REPRESENTATIVE);

        let impact = read_impact(&runner, Path::new("/project"), "v1")
            .await
            .unwrap();

        let statuses: Vec<(&str, Vec<&ImpactStatus>)> = impact
            .requirements
            .iter()
            .map(|r| {
                (
                    r.requirement_uid.as_str(),
                    r.cases.iter().map(|c| &c.status).collect(),
                )
            })
            .collect();
        assert_eq!(
            statuses,
            [
                (
                    "01M48PPCYYYSQ0BZ7H4NZ6Z5XH",
                    vec![
                        &ImpactStatus::Unconfirmed,
                        &ImpactStatus::FollowedUp,
                        &ImpactStatus::Confirmed
                    ]
                ),
                (
                    "01M48PPCYYYSQ0BZ7H4NZ6Z5XJ",
                    vec![&ImpactStatus::Unconfirmed]
                ),
                ("01M48PPCYYYSQ0BZ7H4NZ6Z5XK", vec![]),
            ]
        );
        assert_eq!(
            impact.requirements[0].cases[0].case_uid,
            "6b5ecd98-3627-5c38-99dc-6c047102fbe0"
        );
    }

    #[tokio::test]
    async fn passes_the_base_to_the_core_as_given() {
        let runner = FakeRunner::answering(REPRESENTATIVE);

        read_impact(&runner, Path::new("/project"), "v0.3.0")
            .await
            .unwrap();

        assert_eq!(runner.asked_base.lock().unwrap().as_deref(), Some("v0.3.0"));
    }

    #[tokio::test]
    async fn rejects_a_status_it_does_not_know() {
        let runner = FakeRunner::answering(&REPRESENTATIVE.replace("followed_up", "something_new"));

        let err = read_impact(&runner, Path::new("/project"), "v1")
            .await
            .unwrap_err();

        assert!(matches!(err, ReadError::Malformed(_)), "{err:?}");
    }

    #[tokio::test]
    async fn rejects_another_kind_of_record() {
        let runner =
            FakeRunner::answering(&REPRESENTATIVE.replace("change_impact", "traceability"));

        let err = read_impact(&runner, Path::new("/project"), "v1")
            .await
            .unwrap_err();

        assert!(
            matches!(err, ReadError::UnexpectedRecordKind { .. }),
            "{err:?}"
        );
    }

    #[tokio::test]
    async fn reports_the_message_of_the_core_when_it_fails() {
        let mut runner = FakeRunner::answering("");
        runner.output = CommandOutput {
            exit_code: Some(1),
            stdout: String::new(),
            stderr: "error: bad revision 'nope'".to_string(),
        };

        let err = read_impact(&runner, Path::new("/project"), "nope")
            .await
            .unwrap_err();

        assert_eq!(err.to_string(), "error: bad revision 'nope'");
    }
}
