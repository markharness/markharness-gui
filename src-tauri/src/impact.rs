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

/// What `impact` compares.
#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(tag = "kind", content = "name", rename_all = "snake_case")]
pub enum Comparison {
    /// The committed content between this tag and `HEAD`. The name is passed on as given,
    /// so the core says if it is not a revision.
    Tag(String),
    /// `HEAD` against the working tree, untracked files included.
    Uncommitted,
}

impl Comparison {
    /// The core marks the uncommitted result with its own kind, so that it is not read as a
    /// committed one: a result that may change on the next edit.
    fn record_kind(&self) -> &'static str {
        match self {
            Comparison::Tag(_) => "change_impact",
            Comparison::Uncommitted => "change_impact_worktree",
        }
    }
}

pub async fn read_impact(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    comparison: &Comparison,
) -> Result<ChangeImpact, ReadError> {
    let output = runner
        .impact(project_root, comparison)
        .await
        .map_err(ReadError::CannotRun)?;
    let value = parse_record(output, comparison.record_kind())?;
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
        asked: Mutex<Option<Comparison>>,
    }

    impl FakeRunner {
        fn answering(stdout: &str) -> Self {
            FakeRunner {
                output: CommandOutput {
                    exit_code: Some(0),
                    stdout: stdout.to_string(),
                    stderr: String::new(),
                },
                asked: Mutex::new(None),
            }
        }
    }

    fn tag(name: &str) -> Comparison {
        Comparison::Tag(name.to_string())
    }

    /// What the core prints for the uncommitted edits: the same shape, another kind.
    fn representative_worktree() -> String {
        REPRESENTATIVE
            .replace("\"change_impact\"", "\"change_impact_worktree\"")
            .replace("ebfacfe0000000000000000000000000000000bb", "worktree")
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

        async fn impact(
            &self,
            _project_root: &Path,
            comparison: &Comparison,
        ) -> Result<CommandOutput, String> {
            *self.asked.lock().unwrap() = Some(comparison.clone());
            Ok(self.output.clone())
        }
    }

    #[tokio::test]
    async fn reads_the_status_of_each_case_of_each_touched_requirement() {
        let runner = FakeRunner::answering(REPRESENTATIVE);

        let impact = read_impact(&runner, Path::new("/project"), &tag("v1"))
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

        read_impact(&runner, Path::new("/project"), &tag("v0.3.0"))
            .await
            .unwrap();

        assert_eq!(*runner.asked.lock().unwrap(), Some(tag("v0.3.0")));
    }

    #[tokio::test]
    async fn reads_the_uncommitted_edits_as_the_same_shape_of_impact() {
        let runner = FakeRunner::answering(&representative_worktree());

        let impact = read_impact(&runner, Path::new("/project"), &Comparison::Uncommitted)
            .await
            .unwrap();

        assert_eq!(*runner.asked.lock().unwrap(), Some(Comparison::Uncommitted));
        assert_eq!(impact.requirements.len(), 3);
        assert_eq!(
            impact.requirements[0].cases[0].status,
            ImpactStatus::Unconfirmed
        );
    }

    #[tokio::test]
    async fn does_not_take_the_uncommitted_edits_for_a_committed_comparison() {
        let runner = FakeRunner::answering(&representative_worktree());

        let err = read_impact(&runner, Path::new("/project"), &tag("v1"))
            .await
            .unwrap_err();

        assert!(
            matches!(
                err,
                ReadError::UnexpectedRecordKind {
                    expected: "change_impact",
                    ..
                }
            ),
            "{err:?}"
        );
    }

    #[tokio::test]
    async fn does_not_take_a_committed_comparison_for_the_uncommitted_edits() {
        let runner = FakeRunner::answering(REPRESENTATIVE);

        let err = read_impact(&runner, Path::new("/project"), &Comparison::Uncommitted)
            .await
            .unwrap_err();

        assert!(
            matches!(
                err,
                ReadError::UnexpectedRecordKind {
                    expected: "change_impact_worktree",
                    ..
                }
            ),
            "{err:?}"
        );
    }

    #[tokio::test]
    async fn rejects_a_status_it_does_not_know() {
        let runner = FakeRunner::answering(&REPRESENTATIVE.replace("followed_up", "something_new"));

        let err = read_impact(&runner, Path::new("/project"), &tag("v1"))
            .await
            .unwrap_err();

        assert!(matches!(err, ReadError::Malformed(_)), "{err:?}");
    }

    #[tokio::test]
    async fn rejects_another_kind_of_record() {
        let runner =
            FakeRunner::answering(&REPRESENTATIVE.replace("\"change_impact\"", "\"traceability\""));

        let err = read_impact(&runner, Path::new("/project"), &tag("v1"))
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

        let err = read_impact(&runner, Path::new("/project"), &tag("nope"))
            .await
            .unwrap_err();

        assert_eq!(err.to_string(), "error: bad revision 'nope'");
    }
}
