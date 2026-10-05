use std::future::Future;
use std::path::Path;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct CommandOutput {
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

const SUPPORTED_SCHEMA_VERSION: u64 = 1;

pub trait MarkharnessRunner {
    fn traceability(
        &self,
        project_root: &Path,
        at: Option<&str>,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;

    fn coverage(
        &self,
        project_root: &Path,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;

    fn traceability_show(
        &self,
        project_root: &Path,
        uid: &str,
        at: Option<&str>,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;
}

pub struct CommandRunner {
    pub bin: std::path::PathBuf,
}

impl CommandRunner {
    async fn run(&self, mut command: tokio::process::Command) -> Result<CommandOutput, String> {
        let output = command
            .output()
            .await
            .map_err(|e| format!("{}: {e}", self.bin.display()))?;
        Ok(CommandOutput {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

impl MarkharnessRunner for CommandRunner {
    async fn traceability(
        &self,
        project_root: &Path,
        at: Option<&str>,
    ) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command.arg("traceability");
        if let Some(at) = at {
            command.arg("--at").arg(at);
        }
        command.arg("--dir").arg(project_root);
        self.run(command).await
    }

    async fn coverage(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        command
            .args(["coverage", "--requirements", "all", "--dir"])
            .arg(project_root);
        self.run(command).await
    }

    async fn traceability_show(
        &self,
        project_root: &Path,
        uid: &str,
        at: Option<&str>,
    ) -> Result<CommandOutput, String> {
        let mut command = tokio::process::Command::new(&self.bin);
        // `--uid=` keeps a uid that starts with `-` from being read as an option.
        command
            .args(["traceability", "show"])
            .arg(format!("--uid={uid}"));
        if let Some(at) = at {
            command.arg("--at").arg(at);
        }
        command.arg("--dir").arg(project_root);
        self.run(command).await
    }
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Traceability {
    pub requirements: Vec<Requirement>,
    pub features: Vec<Feature>,
    pub behaviors: Vec<Behavior>,
    pub scenarios: Vec<Scenario>,
    pub test_cases: Vec<TestCase>,
    pub relations: Vec<Relation>,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Requirement {
    pub requirement_id: String,
    pub requirement_uid: String,
    pub source: RequirementSource,
    pub label: Option<String>,
    pub source_locator: Option<String>,
    pub source_key: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RequirementSource {
    Native,
    External,
}

impl RequirementSource {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "native" => Some(RequirementSource::Native),
            "external" => Some(RequirementSource::External),
            _ => None,
        }
    }
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Feature {
    pub feature_id: String,
    pub feature_uid: String,
    pub label: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Behavior {
    pub behavior_id: String,
    pub behavior_uid: String,
    pub feature_id: String,
    pub feature_uid: String,
    pub label: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct Scenario {
    pub scenario_id: String,
    pub scenario_uid: String,
    pub behavior_id: String,
    pub behavior_uid: String,
    pub label: Option<String>,
}

#[derive(Debug, PartialEq, Serialize, Deserialize)]
pub struct TestCase {
    pub case_id: String,
    pub case_uid: String,
    pub case_revision: String,
    pub relative_path: String,
    pub scenario_id: String,
    pub scenario_uid: String,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Relation {
    pub from_uid: String,
    pub to_uid: String,
    pub kind: RelationKind,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RelationKind {
    ContributesTo,
    GeneratedFrom,
}

impl RelationKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "contributes_to" => Some(RelationKind::ContributesTo),
            "generated_from" => Some(RelationKind::GeneratedFrom),
            _ => None,
        }
    }
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::CommandFailed { stderr, .. } if !stderr.is_empty() => {
                write!(f, "{stderr}")
            }
            ReadError::CommandFailed { exit_code, .. } => write!(
                f,
                "markharnessが、標準エラーに何も出さずに、終了コード {} で終了しました",
                exit_code.map_or("なし".to_string(), |c| c.to_string())
            ),
            ReadError::UnsupportedSchemaVersion { supported, actual } => write!(
                f,
                "対応しているschema_versionは {supported} ですが、受け取ったのは {} です。markharness-guiとmarkharnessの版の組み合わせを確かめ、更新してください",
                actual.map_or("なし".to_string(), |v| v.to_string())
            ),
            ReadError::UnexpectedRecordKind { expected, actual } => write!(
                f,
                "期待したrecord_kindは {expected} ですが、受け取ったのは {} です",
                actual.as_deref().unwrap_or("なし")
            ),
            ReadError::UnsupportedValue { field, value } => write!(
                f,
                "{field} に、対応していない値 {value} があります。markharness-guiを更新してください"
            ),
            ReadError::NotJson(reason) => {
                write!(f, "markharnessの出力をJSONとして読めません: {reason}")
            }
            ReadError::Malformed(reason) => {
                write!(f, "必要な項目が欠けているか、型が違います: {reason}")
            }
            ReadError::CannotRun(reason) => write!(f, "markharnessを起動できません: {reason}"),
        }
    }
}

#[derive(Deserialize)]
struct RawTraceability {
    requirements: Vec<RawRequirement>,
    features: Vec<Feature>,
    behaviors: Vec<Behavior>,
    scenarios: Vec<Scenario>,
    test_cases: Vec<TestCase>,
    relations: Vec<RawRelation>,
}

#[derive(Deserialize)]
struct RawRequirement {
    requirement_id: String,
    requirement_uid: String,
    source: String,
    label: Option<String>,
    source_locator: Option<String>,
    source_key: Option<String>,
}

#[derive(Deserialize)]
struct RawRelation {
    from_uid: String,
    to_uid: String,
    kind: String,
}

#[derive(Debug, PartialEq)]
pub enum ReadError {
    CannotRun(String),
    NotJson(String),
    UnsupportedSchemaVersion {
        supported: u64,
        actual: Option<u64>,
    },
    Malformed(String),
    UnsupportedValue {
        field: &'static str,
        value: String,
    },
    UnexpectedRecordKind {
        expected: &'static str,
        actual: Option<String>,
    },
    CommandFailed {
        exit_code: Option<i32>,
        stderr: String,
    },
}

/// Checks that the command succeeded and printed a record of the supported schema,
/// and returns the parsed JSON.
pub(crate) fn parse_record(
    output: CommandOutput,
    record_kind: &'static str,
) -> Result<serde_json::Value, ReadError> {
    if output.exit_code != Some(0) {
        return Err(ReadError::CommandFailed {
            exit_code: output.exit_code,
            stderr: output.stderr,
        });
    }
    let value: serde_json::Value =
        serde_json::from_str(&output.stdout).map_err(|e| ReadError::NotJson(e.to_string()))?;
    let actual_kind = value.get("record_kind").and_then(|v| v.as_str());
    if actual_kind != Some(record_kind) {
        return Err(ReadError::UnexpectedRecordKind {
            expected: record_kind,
            actual: actual_kind.map(str::to_string),
        });
    }
    let schema_version = value.get("schema_version").and_then(|v| v.as_u64());
    if schema_version != Some(SUPPORTED_SCHEMA_VERSION) {
        return Err(ReadError::UnsupportedSchemaVersion {
            supported: SUPPORTED_SCHEMA_VERSION,
            actual: schema_version,
        });
    }
    Ok(value)
}

pub async fn read_traceability(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
    at: Option<&str>,
) -> Result<Traceability, ReadError> {
    let output = runner
        .traceability(project_root, at)
        .await
        .map_err(ReadError::CannotRun)?;
    let value = parse_record(output, "traceability")?;
    let raw: RawTraceability =
        serde_json::from_value(value).map_err(|e| ReadError::Malformed(e.to_string()))?;
    let requirements = raw
        .requirements
        .into_iter()
        .map(|r| {
            let source =
                RequirementSource::parse(&r.source).ok_or(ReadError::UnsupportedValue {
                    field: "requirements[].source",
                    value: r.source,
                })?;
            Ok(Requirement {
                requirement_id: r.requirement_id,
                requirement_uid: r.requirement_uid,
                source,
                label: r.label,
                source_locator: r.source_locator,
                source_key: r.source_key,
            })
        })
        .collect::<Result<Vec<_>, ReadError>>()?;
    let relations = raw
        .relations
        .into_iter()
        .map(|r| {
            let kind = RelationKind::parse(&r.kind).ok_or(ReadError::UnsupportedValue {
                field: "relations[].kind",
                value: r.kind,
            })?;
            Ok(Relation {
                from_uid: r.from_uid,
                to_uid: r.to_uid,
                kind,
            })
        })
        .collect::<Result<Vec<_>, ReadError>>()?;
    Ok(Traceability {
        requirements,
        features: raw.features,
        behaviors: raw.behaviors,
        scenarios: raw.scenarios,
        test_cases: raw.test_cases,
        relations,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TODO_MINIMAL: &str = include_str!("../tests/fixtures/traceability_todo_minimal.json");
    const SHARED_SLUGS: &str = include_str!("../tests/fixtures/traceability_shared_slugs.json");

    struct FakeRunner(Result<CommandOutput, String>);

    impl FakeRunner {
        fn printing(stdout: &str) -> Self {
            FakeRunner(Ok(CommandOutput {
                exit_code: Some(0),
                stdout: stdout.to_string(),
                stderr: String::new(),
            }))
        }
    }

    impl MarkharnessRunner for FakeRunner {
        async fn traceability(
            &self,
            _project_root: &Path,
            _at: Option<&str>,
        ) -> Result<CommandOutput, String> {
            self.0.clone()
        }

        async fn coverage(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }

        async fn traceability_show(
            &self,
            _project_root: &Path,
            _uid: &str,
            _at: Option<&str>,
        ) -> Result<CommandOutput, String> {
            Err("unused".to_string())
        }
    }

    #[tokio::test]
    async fn reads_the_elements_and_their_parents() {
        let runner = FakeRunner::printing(TODO_MINIMAL);

        let t = read_traceability(&runner, Path::new("/project"), None)
            .await
            .unwrap();

        assert_eq!(t.requirements.len(), 1);
        assert_eq!(t.features.len(), 1);
        assert_eq!(t.behaviors.len(), 1);
        assert_eq!(t.scenarios.len(), 2);
        assert_eq!(t.test_cases.len(), 2);
        assert_eq!(t.behaviors[0].feature_id, "add-todo");
        assert_eq!(t.scenarios[1].scenario_id, "max-length");
        assert_eq!(t.scenarios[1].behavior_id, "add-task");
        assert_eq!(t.test_cases[1].scenario_id, "max-length");
        assert_eq!(t.behaviors[0].feature_uid, t.features[0].feature_uid);
        assert_eq!(t.scenarios[1].behavior_uid, t.behaviors[0].behavior_uid);
        assert_eq!(t.test_cases[1].scenario_uid, t.scenarios[1].scenario_uid);
        assert_eq!(
            t.relations[0],
            Relation {
                from_uid: "01M440JETKDKJAWSC7ND58HXQY".to_string(),
                to_uid: "01M440JETKSN1RXENDC70HN1Q5".to_string(),
                kind: RelationKind::ContributesTo,
            }
        );
    }

    #[tokio::test]
    async fn returns_the_standard_error_verbatim_when_the_command_fails() {
        let stderr = "error: no markharness project found; run `markharness init` first
";
        let runner = FakeRunner(Ok(CommandOutput {
            exit_code: Some(1),
            stdout: String::new(),
            stderr: stderr.to_string(),
        }));

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::CommandFailed {
                exit_code: Some(1),
                stderr: stderr.to_string(),
            }
        );
    }

    #[tokio::test]
    async fn reports_when_the_command_cannot_be_run() {
        let runner = FakeRunner(Err("program not found".to_string()));

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::CannotRun("program not found".to_string())
        );
    }

    #[tokio::test]
    async fn rejects_output_that_is_not_json() {
        let runner = FakeRunner::printing("Traceability: 1 requirement");

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert!(matches!(result.unwrap_err(), ReadError::NotJson(_)));
    }

    #[tokio::test]
    async fn stops_when_the_record_kind_is_not_traceability() {
        let coverage = TODO_MINIMAL.replace(
            r#""record_kind": "traceability""#,
            r#""record_kind": "release_coverage""#,
        );
        let runner = FakeRunner::printing(&coverage);

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::UnexpectedRecordKind {
                expected: "traceability",
                actual: Some("release_coverage".to_string()),
            }
        );
    }

    #[tokio::test]
    async fn stops_when_the_schema_version_is_not_supported() {
        let newer = TODO_MINIMAL.replace(r#""schema_version": 1"#, r#""schema_version": 2"#);
        let runner = FakeRunner::printing(&newer);

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::UnsupportedSchemaVersion {
                supported: 1,
                actual: Some(2),
            }
        );
    }

    #[tokio::test]
    async fn stops_on_an_unknown_relation_kind() {
        let unknown =
            TODO_MINIMAL.replacen(r#""kind": "generated_from""#, r#""kind": "verified_by""#, 1);
        let runner = FakeRunner::printing(&unknown);

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::UnsupportedValue {
                field: "relations[].kind",
                value: "verified_by".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn stops_on_an_unknown_requirement_source() {
        let unknown = TODO_MINIMAL.replace(r#""source": "native""#, r#""source": "imported""#);
        let runner = FakeRunner::printing(&unknown);

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        assert_eq!(
            result.unwrap_err(),
            ReadError::UnsupportedValue {
                field: "requirements[].source",
                value: "imported".to_string(),
            }
        );
    }

    #[tokio::test]
    async fn ignores_keys_and_arrays_it_does_not_know() {
        let extended = TODO_MINIMAL
            .replacen(
                r#""features": ["#,
                r#""future_array": [], "features": ["#,
                1,
            )
            .replace(
                r#""feature_id": "add-todo","#,
                r#""feature_id": "add-todo", "color": "blue","#,
            );
        let runner = FakeRunner::printing(&extended);

        let t = read_traceability(&runner, Path::new("/project"), None)
            .await
            .unwrap();

        assert_eq!(t.features.len(), 1);
        assert_eq!(t.behaviors[0].feature_id, "add-todo");
    }

    #[tokio::test]
    async fn stops_when_a_required_field_is_missing() {
        let missing =
            TODO_MINIMAL.replace(r#""requirement_uid": "01M440JETKSN1RXENDC70HN1Q5","#, "");
        let runner = FakeRunner::printing(&missing);

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        match result.unwrap_err() {
            ReadError::Malformed(message) => assert!(message.contains("requirement_uid")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }

    #[test]
    fn shows_the_standard_error_of_a_failed_command_verbatim() {
        let error = ReadError::CommandFailed {
            exit_code: Some(1),
            stderr: "error: no markharness project found
"
            .to_string(),
        };

        assert_eq!(
            error.to_string(),
            "error: no markharness project found
"
        );
    }

    #[test]
    fn explains_a_failed_command_that_printed_nothing() {
        let error = ReadError::CommandFailed {
            exit_code: Some(3),
            stderr: String::new(),
        };

        assert_eq!(
            error.to_string(),
            "markharnessが、標準エラーに何も出さずに、終了コード 3 で終了しました"
        );
    }

    #[test]
    fn shows_the_supported_and_received_schema_versions() {
        let error = ReadError::UnsupportedSchemaVersion {
            supported: 1,
            actual: Some(2),
        };

        assert_eq!(
            error.to_string(),
            "対応しているschema_versionは 1 ですが、受け取ったのは 2 です。markharness-guiとmarkharnessの版の組み合わせを確かめ、更新してください"
        );
    }

    #[test]
    fn shows_the_expected_and_received_record_kind() {
        let error = ReadError::UnexpectedRecordKind {
            expected: "traceability",
            actual: Some("release_coverage".to_string()),
        };

        assert_eq!(
            error.to_string(),
            "期待したrecord_kindは traceability ですが、受け取ったのは release_coverage です"
        );
    }

    #[test]
    fn shows_the_unsupported_value_and_its_field() {
        let error = ReadError::UnsupportedValue {
            field: "relations[].kind",
            value: "verified_by".to_string(),
        };

        assert_eq!(
            error.to_string(),
            "relations[].kind に、対応していない値 verified_by があります。markharness-guiを更新してください"
        );
    }

    #[test]
    fn shows_why_the_output_is_not_json() {
        let error = ReadError::NotJson("expected value at line 1 column 1".to_string());

        assert_eq!(
            error.to_string(),
            "markharnessの出力をJSONとして読めません: expected value at line 1 column 1"
        );
    }

    #[test]
    fn shows_what_is_malformed() {
        let error = ReadError::Malformed("missing field `requirement_uid`".to_string());

        assert_eq!(
            error.to_string(),
            "必要な項目が欠けているか、型が違います: missing field `requirement_uid`"
        );
    }

    #[test]
    fn shows_why_the_command_cannot_be_run() {
        let error = ReadError::CannotRun("program not found".to_string());

        assert_eq!(
            error.to_string(),
            "markharnessを起動できません: program not found"
        );
    }

    #[tokio::test]
    async fn reads_elements_that_share_a_slug_by_their_parent_uids() {
        let runner = FakeRunner::printing(SHARED_SLUGS);

        let t = read_traceability(&runner, Path::new("/project"), None)
            .await
            .unwrap();

        assert_eq!(t.behaviors.len(), 2);
        assert_ne!(t.behaviors[0].feature_uid, t.behaviors[1].feature_uid);
        assert_eq!(t.scenarios.len(), 2);
        assert_eq!(t.scenarios[0].behavior_uid, t.behaviors[0].behavior_uid);
        assert_eq!(t.scenarios[1].behavior_uid, t.behaviors[1].behavior_uid);
    }

    #[tokio::test]
    async fn stops_when_a_parent_uid_is_missing() {
        let mut output: serde_json::Value = serde_json::from_str(TODO_MINIMAL).unwrap();
        output["behaviors"][0]
            .as_object_mut()
            .unwrap()
            .remove("feature_uid");
        let runner = FakeRunner::printing(&output.to_string());

        let result = read_traceability(&runner, Path::new("/project"), None).await;

        match result.unwrap_err() {
            ReadError::Malformed(message) => assert!(message.contains("feature_uid")),
            other => panic!("expected Malformed, got {other:?}"),
        }
    }
}
