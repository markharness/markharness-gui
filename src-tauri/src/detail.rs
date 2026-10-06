use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::traceability::{parse_record, MarkharnessRunner, ReadError};

/// What the core reports about one case and its scenario, read when the case is picked.
#[derive(Debug, PartialEq, Serialize)]
pub struct CaseDetail {
    pub description: Option<String>,
    pub phases: Vec<Phase>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Phase {
    pub steps: Vec<String>,
    pub results: Vec<String>,
}

/// The description markharness holds for a requirement; external requirements have none.
#[derive(Debug, PartialEq, Serialize)]
pub struct RequirementDescription {
    pub uid: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
struct RawRequirement {
    description: Option<String>,
}

#[derive(Deserialize)]
struct RawTestCase {
    phases: Vec<Phase>,
}

/// What the core records on a requirement, a feature or a behavior, to start an edit from.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ElementDetail {
    pub axis: Vec<String>,
    pub description: Option<String>,
}

#[derive(Deserialize)]
struct RawScenario {
    description: Option<String>,
}

pub async fn read_requirement_descriptions(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    uids: &[String],
) -> Result<Vec<RequirementDescription>, ReadError> {
    let mut out = Vec::new();
    for uid in uids {
        let output = runner
            .traceability_show(project_root, uid)
            .await
            .map_err(ReadError::CannotRun)?;
        let raw: RawRequirement =
            serde_json::from_value(parse_record(output, "traceability_detail")?)
                .map_err(|e| ReadError::Malformed(e.to_string()))?;
        out.push(RequirementDescription {
            uid: uid.clone(),
            description: raw.description,
        });
    }
    Ok(out)
}

pub async fn read_element_detail(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    uid: &str,
) -> Result<ElementDetail, ReadError> {
    let output = runner
        .traceability_show(project_root, uid)
        .await
        .map_err(ReadError::CannotRun)?;
    serde_json::from_value(parse_record(output, "traceability_detail")?)
        .map_err(|e| ReadError::Malformed(e.to_string()))
}

/// What the core records on a scenario, to start an edit from.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct ScenarioDetail {
    pub description: Option<String>,
    pub implementation_note: Option<String>,
}

pub async fn read_scenario_detail(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    uid: &str,
) -> Result<ScenarioDetail, ReadError> {
    let output = runner
        .traceability_show(project_root, uid)
        .await
        .map_err(ReadError::CannotRun)?;
    serde_json::from_value(parse_record(output, "traceability_detail")?)
        .map_err(|e| ReadError::Malformed(e.to_string()))
}

pub async fn read_case_detail(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    case_uid: &str,
    scenario_uid: &str,
) -> Result<CaseDetail, ReadError> {
    let case = runner
        .traceability_show(project_root, case_uid)
        .await
        .map_err(ReadError::CannotRun)?;
    let case: RawTestCase = serde_json::from_value(parse_record(case, "traceability_detail")?)
        .map_err(|e| ReadError::Malformed(e.to_string()))?;
    let scenario = runner
        .traceability_show(project_root, scenario_uid)
        .await
        .map_err(ReadError::CannotRun)?;
    let scenario: RawScenario =
        serde_json::from_value(parse_record(scenario, "traceability_detail")?)
            .map_err(|e| ReadError::Malformed(e.to_string()))?;
    Ok(CaseDetail {
        description: scenario.description,
        phases: case.phases,
    })
}
#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::Mutex;

    use super::*;
    use crate::traceability::{CommandOutput, MarkharnessRunner};

    const TEST_CASE: &str = include_str!("../tests/fixtures/detail_test_case.json");
    const SCENARIO: &str = include_str!("../tests/fixtures/detail_scenario.json");
    const REQUIREMENT: &str = include_str!("../tests/fixtures/detail_requirement.json");
    const FEATURE: &str = include_str!("../tests/fixtures/detail_feature.json");

    #[derive(Default)]
    struct FakeRunner {
        asked: Mutex<Vec<String>>,
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
            uid: &str,
        ) -> Result<CommandOutput, String> {
            self.asked.lock().unwrap().push(uid.to_string());
            let stdout = if uid == "case-uid" {
                TEST_CASE
            } else if uid.starts_with("req-") {
                REQUIREMENT
            } else if uid.starts_with("feature-") {
                FEATURE
            } else {
                SCENARIO
            };
            Ok(CommandOutput {
                exit_code: Some(0),
                stdout: stdout.to_string(),
                stderr: String::new(),
            })
        }

        async fn impact(&self, _project_root: &Path, _base: &str) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }
    }

    #[tokio::test]
    async fn reads_the_description_of_each_requirement() {
        let runner = FakeRunner::default();

        let descriptions = read_requirement_descriptions(
            &runner,
            Path::new("/project"),
            &["req-1".to_string(), "req-2".to_string()],
        )
        .await
        .unwrap();

        assert_eq!(
            descriptions,
            [
                RequirementDescription {
                    uid: "req-1".to_string(),
                    description: Some(
                        "The player can control the character.
"
                        .to_string()
                    ),
                },
                RequirementDescription {
                    uid: "req-2".to_string(),
                    description: Some(
                        "The player can control the character.
"
                        .to_string()
                    ),
                },
            ]
        );
        assert_eq!(*runner.asked.lock().unwrap(), ["req-1", "req-2"]);
    }

    #[tokio::test]
    async fn gives_a_requirement_without_a_description_none() {
        let mut value: serde_json::Value = serde_json::from_str(REQUIREMENT).unwrap();
        value.as_object_mut().unwrap().remove("description");
        let output = CommandOutput {
            exit_code: Some(0),
            stdout: value.to_string(),
            stderr: String::new(),
        };

        let raw: RawRequirement =
            serde_json::from_value(parse_record(output, "traceability_detail").unwrap()).unwrap();

        assert_eq!(raw.description, None);
    }

    #[tokio::test]
    async fn reads_the_scenario_description_and_the_steps_of_the_case() {
        let runner = FakeRunner::default();

        let d = read_case_detail(&runner, Path::new("/project"), "case-uid", "scenario-uid")
            .await
            .unwrap();

        assert_eq!(d.description.as_deref(), Some("From the ground.\n"));
        assert_eq!(
            d.phases,
            [Phase {
                steps: vec![
                    "Launches the game.".to_string(),
                    "Loads the stage.".to_string(),
                    "Presses jump.".to_string(),
                ],
                results: vec!["Rises.".to_string()],
            }]
        );
    }

    #[tokio::test]
    async fn reads_the_case_and_then_its_scenario() {
        let runner = FakeRunner::default();

        read_case_detail(&runner, Path::new("/project"), "case-uid", "scenario-uid")
            .await
            .unwrap();

        let asked = runner.asked.lock().unwrap();
        assert_eq!(*asked, ["case-uid", "scenario-uid"]);
    }

    #[tokio::test]
    async fn explains_a_scenario_without_a_description_as_none() {
        let mut value: serde_json::Value = serde_json::from_str(SCENARIO).unwrap();
        value.as_object_mut().unwrap().remove("description");
        let output = CommandOutput {
            exit_code: Some(0),
            stdout: value.to_string(),
            stderr: String::new(),
        };

        let scenario: RawScenario =
            serde_json::from_value(parse_record(output, "traceability_detail").unwrap()).unwrap();

        assert_eq!(scenario.description, None);
    }

    #[tokio::test]
    async fn reads_the_axes_of_a_feature() {
        let runner = FakeRunner::default();

        let detail = read_element_detail(&runner, Path::new("/project"), "feature-1")
            .await
            .unwrap();

        assert_eq!(detail.axis, ["functional", "ui"]);
        assert_eq!(*runner.asked.lock().unwrap(), ["feature-1"]);
    }

    #[tokio::test]
    async fn a_record_without_axes_is_malformed_not_an_empty_list() {
        let mut value: serde_json::Value = serde_json::from_str(FEATURE).unwrap();
        value.as_object_mut().unwrap().remove("axis");
        let runner = FixedRunner(value.to_string());

        let result = read_element_detail(&runner, Path::new("/project"), "feature-1").await;

        assert!(matches!(result, Err(ReadError::Malformed(_))));
    }

    struct FixedRunner(String);

    impl MarkharnessRunner for FixedRunner {
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
            Ok(CommandOutput {
                exit_code: Some(0),
                stdout: self.0.clone(),
                stderr: String::new(),
            })
        }

        async fn impact(&self, _project_root: &Path, _base: &str) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }
    }

    #[tokio::test]
    async fn reads_the_description_of_an_element() {
        let runner = FakeRunner::default();

        let detail = read_element_detail(&runner, Path::new("/project"), "feature-1")
            .await
            .unwrap();

        assert_eq!(
            detail.description.as_deref(),
            Some(
                "Moving the character.
"
            )
        );
    }

    #[tokio::test]
    async fn an_element_without_a_description_has_none() {
        let mut value: serde_json::Value = serde_json::from_str(FEATURE).unwrap();
        value.as_object_mut().unwrap().remove("description");
        let runner = FixedRunner(value.to_string());

        let detail = read_element_detail(&runner, Path::new("/project"), "feature-1")
            .await
            .unwrap();

        assert_eq!(detail.description, None);
    }

    #[tokio::test]
    async fn reads_the_description_and_the_implementation_note_of_a_scenario() {
        let mut value: serde_json::Value = serde_json::from_str(SCENARIO).unwrap();
        value["implementation_note"] = "Uses the jump key.
"
        .into();
        let runner = FixedRunner(value.to_string());

        let detail = read_scenario_detail(&runner, Path::new("/project"), "scenario-uid")
            .await
            .unwrap();

        assert_eq!(
            detail,
            ScenarioDetail {
                description: Some(
                    "From the ground.
"
                    .to_string()
                ),
                implementation_note: Some(
                    "Uses the jump key.
"
                    .to_string()
                ),
            }
        );
    }

    #[tokio::test]
    async fn a_scenario_without_an_implementation_note_has_none() {
        let mut value: serde_json::Value = serde_json::from_str(SCENARIO).unwrap();
        value.as_object_mut().unwrap().remove("implementation_note");
        let runner = FixedRunner(value.to_string());

        let detail = read_scenario_detail(&runner, Path::new("/project"), "scenario-uid")
            .await
            .unwrap();

        assert_eq!(detail.implementation_note, None);
    }
}
