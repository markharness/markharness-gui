use std::future::Future;
use std::path::Path;

use crate::traceability::CommandOutput;

pub trait GitRunner {
    fn tags(
        &self,
        project_root: &Path,
    ) -> impl Future<Output = Result<CommandOutput, String>> + Send;
}

pub struct CommandGitRunner;

impl GitRunner for CommandGitRunner {
    async fn tags(&self, project_root: &Path) -> Result<CommandOutput, String> {
        let output = tokio::process::Command::new("git")
            .arg("-C")
            .arg(project_root)
            // `strip=2` keeps the whole tag name even when a branch has the same short name.
            .args([
                "for-each-ref",
                "--sort=-creatordate",
                "--format=%(refname:strip=2)",
                "refs/tags",
            ])
            .output()
            .await
            .map_err(|e| format!("git: {e}"))?;
        Ok(CommandOutput {
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        })
    }
}

/// The tags to offer as the base of a comparison, the newest first.
/// Without `git`, or when it fails, there is nothing to offer: this is not an error.
pub async fn read_tags(runner: &impl GitRunner, project_root: &Path) -> Vec<String> {
    match runner.tags(project_root).await {
        Ok(output) if output.exit_code == Some(0) => output
            .stdout
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    struct FakeGit(Result<CommandOutput, String>);

    impl GitRunner for FakeGit {
        async fn tags(&self, _project_root: &Path) -> Result<CommandOutput, String> {
            self.0.clone()
        }
    }

    fn output(exit_code: i32, stdout: &str) -> Result<CommandOutput, String> {
        Ok(CommandOutput {
            exit_code: Some(exit_code),
            stdout: stdout.to_string(),
            stderr: String::new(),
        })
    }

    #[tokio::test]
    async fn offers_the_tags_in_the_order_git_lists_them() {
        let git = FakeGit(output(0, "v0.3.0\nv0.2.0\nv0.1.0\n"));

        let tags = read_tags(&git, Path::new("/project")).await;

        assert_eq!(tags, ["v0.3.0", "v0.2.0", "v0.1.0"]);
    }

    #[tokio::test]
    async fn offers_nothing_when_there_are_no_tags() {
        let git = FakeGit(output(0, ""));

        assert!(read_tags(&git, Path::new("/project")).await.is_empty());
    }

    #[tokio::test]
    async fn ignores_blank_lines() {
        let git = FakeGit(output(0, "v1\r\n\r\nv0\r\n"));

        let tags = read_tags(&git, Path::new("/project")).await;

        assert_eq!(tags, ["v1", "v0"]);
    }

    #[tokio::test]
    async fn offers_nothing_when_git_cannot_be_started() {
        let git = FakeGit(Err("git: not found".to_string()));

        assert!(read_tags(&git, Path::new("/project")).await.is_empty());
    }

    #[tokio::test]
    async fn offers_nothing_when_git_fails() {
        let git = FakeGit(output(128, "v1\n"));

        assert!(read_tags(&git, Path::new("/project")).await.is_empty());
    }
}
