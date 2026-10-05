use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::{parse_record, MarkharnessRunner, ReadError};

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Coverage {
    pub at_commit: String,
    pub requirements: Vec<CoverageRequirement>,
    pub gaps: Vec<Gap>,
}

/// Why the core reports a requirement as not fully covered.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Gap {
    pub kind: GapKind,
    pub requirement_id: String,
    pub feature_id: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GapKind {
    RequirementHasNoFeature,
    FeatureHasNoCase,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct CoverageRequirement {
    pub requirement_uid: String,
    pub cases: Vec<CoverageCase>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct CoverageCase {
    pub case_uid: String,
}

pub async fn read_coverage(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
) -> Result<Coverage, ReadError> {
    let output = runner
        .coverage(project_root)
        .await
        .map_err(ReadError::CannotRun)?;
    let value = parse_record(output, "release_coverage")?;
    serde_json::from_value(value).map_err(|e| ReadError::Malformed(e.to_string()))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;
    use crate::traceability::{CommandOutput, MarkharnessRunner};

    const REPRESENTATIVE: &str = include_str!("../tests/fixtures/coverage_representative.json");

    struct FakeRunner(String);

    impl MarkharnessRunner for FakeRunner {
        async fn traceability(
            &self,
            _project_root: &Path,
            _at: Option<&str>,
        ) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn coverage(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            Ok(CommandOutput {
                exit_code: Some(0),
                stdout: self.0.clone(),
                stderr: String::new(),
            })
        }
    }

    #[tokio::test]
    async fn reads_the_commit_and_the_cases_of_each_requirement() {
        let runner = FakeRunner(REPRESENTATIVE.to_string());

        let c = read_coverage(&runner, Path::new("/project")).await.unwrap();

        assert_eq!(c.at_commit, "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78");
        assert_eq!(c.requirements.len(), 2);
        assert_eq!(
            c.requirements[0].requirement_uid,
            "01ARZ3NDEKTSV4RRFFQ69G5FAV"
        );
        let cases: Vec<&str> = c.requirements[0]
            .cases
            .iter()
            .map(|x| x.case_uid.as_str())
            .collect();
        assert_eq!(
            cases,
            [
                "d96fffca-521f-5367-9611-83229888bf30",
                "7ecd56ba-c81d-57cf-a871-d5dd1d951c74"
            ]
        );
        assert!(c.requirements[1].cases.is_empty());
    }

    #[tokio::test]
    async fn reads_why_a_requirement_has_no_cases() {
        let runner = FakeRunner(REPRESENTATIVE.to_string());

        let c = read_coverage(&runner, Path::new("/project")).await.unwrap();

        assert_eq!(
            c.gaps,
            [
                Gap {
                    kind: GapKind::FeatureHasNoCase,
                    requirement_id: "controls".to_string(),
                    feature_id: Some("player-duck".to_string()),
                },
                Gap {
                    kind: GapKind::RequirementHasNoFeature,
                    requirement_id: "orphan".to_string(),
                    feature_id: None,
                },
            ]
        );
    }

    #[tokio::test]
    async fn rejects_a_gap_kind_it_does_not_know() {
        let output = REPRESENTATIVE.replace("feature_has_no_case", "something_new");
        let runner = FakeRunner(output);

        let err = read_coverage(&runner, Path::new("/project"))
            .await
            .unwrap_err();

        assert!(matches!(err, ReadError::Malformed(_)), "{err:?}");
    }
}
