use std::path::Path;

use serde::Serialize;

use crate::coverage::{read_coverage, Coverage};
use crate::traceability::{read_traceability, MarkharnessRunner, ReadError, Traceability};

/// What the screen shows: the traceability and the coverage of one commit.
#[derive(Debug, PartialEq, Serialize)]
pub struct Project {
    pub at_commit: String,
    pub traceability: Traceability,
    pub coverage: Coverage,
}

/// `coverage` reads only committed content, so it is read first and its resolved commit is
/// passed to `traceability`; both outputs then describe the same commit.
pub async fn read_project(
    runner: &impl MarkharnessRunner,
    project_root: &Path,
) -> Result<Project, ReadError> {
    let coverage = read_coverage(runner, project_root).await?;
    let traceability = read_traceability(runner, project_root, Some(&coverage.at_commit)).await?;
    Ok(Project {
        at_commit: coverage.at_commit.clone(),
        traceability,
        coverage,
    })
}

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::Mutex;

    use super::*;
    use crate::traceability::{CommandOutput, MarkharnessRunner};

    const COVERAGE: &str = include_str!("../tests/fixtures/coverage_representative.json");
    const TRACEABILITY: &str = include_str!("../tests/fixtures/traceability_todo_minimal.json");

    struct FakeRunner {
        traceability_at: Mutex<Option<Option<String>>>,
    }

    fn printing(stdout: &str) -> Result<CommandOutput, String> {
        Ok(CommandOutput {
            exit_code: Some(0),
            stdout: stdout.to_string(),
            stderr: String::new(),
        })
    }

    impl MarkharnessRunner for FakeRunner {
        async fn traceability(
            &self,
            _project_root: &Path,
            at: Option<&str>,
        ) -> Result<CommandOutput, String> {
            *self.traceability_at.lock().unwrap() = Some(at.map(str::to_string));
            printing(TRACEABILITY)
        }

        async fn coverage(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            printing(COVERAGE)
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
    async fn reads_the_traceability_at_the_commit_the_coverage_was_read_at() {
        let runner = FakeRunner {
            traceability_at: Mutex::new(None),
        };

        let p = read_project(&runner, Path::new("/project")).await.unwrap();

        assert_eq!(p.at_commit, "45c7fc13cfc0749fb0df9f2cdca724d0826f8a78");
        assert_eq!(
            *runner.traceability_at.lock().unwrap(),
            Some(Some("45c7fc13cfc0749fb0df9f2cdca724d0826f8a78".to_string()))
        );
        assert_eq!(p.coverage.requirements.len(), 2);
        assert_eq!(p.traceability.requirements.len(), 1);
    }
}
