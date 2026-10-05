use std::future::Future;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::strictdoc::{parse_strictdoc, StrictDoc};

/// Directories whose contents are never StrictDoc sources.
const SKIPPED_DIRECTORIES: [&str; 5] = [
    ".git",
    ".markharness",
    ".markharness-gui",
    "node_modules",
    "target",
];

#[derive(Debug, Clone, PartialEq)]
pub enum ExportError {
    /// `strictdoc` is not installed; the project is then shown without it.
    NotInstalled,
    Failed(String),
}

impl std::fmt::Display for ExportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExportError::NotInstalled => write!(f, "strictdocが見つかりません"),
            ExportError::Failed(reason) => write!(f, "{reason}"),
        }
    }
}

pub trait StrictDocRunner {
    /// Runs `strictdoc export --formats=json` for the project into `output_dir`.
    fn export(
        &self,
        project_root: &Path,
        output_dir: &Path,
    ) -> impl Future<Output = Result<(), ExportError>> + Send;
}

pub struct CommandStrictDocRunner {
    pub bin: PathBuf,
}

impl StrictDocRunner for CommandStrictDocRunner {
    async fn export(&self, project_root: &Path, output_dir: &Path) -> Result<(), ExportError> {
        let output = tokio::process::Command::new(&self.bin)
            .args(["export", "--formats=json", "--output-dir"])
            .arg(output_dir)
            .arg(project_root)
            // StrictDoc writes the exported text with the platform's default encoding otherwise.
            .env("PYTHONUTF8", "1")
            .output()
            .await
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => ExportError::NotInstalled,
                _ => ExportError::Failed(format!("{}: {e}", self.bin.display())),
            })?;
        if output.status.success() {
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let message = if stderr.trim().is_empty() {
            stdout
        } else {
            stderr
        };
        Err(ExportError::Failed(message.trim().to_string()))
    }
}

fn uses_strictdoc(project_root: &Path) -> bool {
    ["strictdoc.toml", "strictdoc_config.py"]
        .iter()
        .any(|name| project_root.join(name).is_file())
}

fn is_source(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    matches!(name, "strictdoc.toml" | "strictdoc_config.py")
        || matches!(
            path.extension().and_then(|e| e.to_str()),
            Some("sdoc" | "md")
        )
}

/// The newest change to a StrictDoc document or configuration. Directories count too, because
/// deleting a document shows only in the directory's modification time.
fn newest_source_change(dir: &Path) -> Option<SystemTime> {
    let mut newest = std::fs::metadata(dir).and_then(|m| m.modified()).ok();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return newest;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let candidate = if path.is_dir() {
            if SKIPPED_DIRECTORIES.iter().any(|d| name == *d) {
                continue;
            }
            newest_source_change(&path)
        } else if is_source(&path) {
            entry.metadata().and_then(|m| m.modified()).ok()
        } else {
            None
        };
        newest = newest.max(candidate);
    }
    newest
}

fn cache_dir(project_root: &Path) -> PathBuf {
    project_root.join(".markharness-gui/strictdoc")
}

fn saved_index(dir: &Path) -> PathBuf {
    dir.join("json/index.json")
}

fn is_fresh(project_root: &Path) -> bool {
    let saved = std::fs::metadata(saved_index(&cache_dir(project_root)))
        .and_then(|m| m.modified())
        .ok();
    match (saved, newest_source_change(project_root)) {
        (Some(saved), Some(newest)) => saved >= newest,
        _ => false,
    }
}

fn read_index(dir: &Path) -> Result<StrictDoc, ExportError> {
    let json = std::fs::read_to_string(saved_index(dir))
        .map_err(|e| ExportError::Failed(format!("StrictDocのエクスポートを読めません: {e}")))?;
    parse_strictdoc(&json).map_err(|e| ExportError::Failed(e.to_string()))
}

/// The project's StrictDoc content, or `None` when the project does not use StrictDoc (or it is
/// not installed). The saved export is reused until a document or the configuration changes;
/// `skip_saved` forces a new export. When an export fails, nothing from an older one is returned.
pub async fn load_strictdoc(
    runner: &impl StrictDocRunner,
    project_root: &Path,
    skip_saved: bool,
) -> Result<Option<StrictDoc>, ExportError> {
    if !uses_strictdoc(project_root) {
        return Ok(None);
    }
    let saved = cache_dir(project_root);
    if !skip_saved && is_fresh(project_root) {
        return read_index(&saved).map(Some);
    }

    let fresh = project_root.join(".markharness-gui/strictdoc-new");
    let _ = std::fs::remove_dir_all(&fresh);
    match runner.export(project_root, &fresh).await {
        Ok(()) => {}
        Err(ExportError::NotInstalled) => return Ok(None),
        Err(e) => return Err(e),
    }
    let export = read_index(&fresh)?;
    let _ = std::fs::remove_dir_all(&saved);
    std::fs::rename(&fresh, &saved)
        .map_err(|e| ExportError::Failed(format!("エクスポートを保存できません: {e}")))?;
    Ok(Some(export))
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;
    use std::time::{Duration, SystemTime};

    use super::*;

    const EXPORT: &str = include_str!("../tests/fixtures/strictdoc_export.json");

    fn project() -> PathBuf {
        static NEXT: AtomicUsize = AtomicUsize::new(0);
        let dir = std::env::temp_dir().join(format!(
            "markharness-gui-strictdoc-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("docs")).unwrap();
        dir
    }

    fn with_strictdoc(dir: &Path) {
        std::fs::write(dir.join("strictdoc.toml"), "").unwrap();
        std::fs::write(dir.join("docs/a.sdoc"), "[DOCUMENT]").unwrap();
    }

    /// Moves the saved export's modification time, relative to now. Files only: directories
    /// cannot be opened for writing on Windows.
    fn age_saved_export(dir: &Path, seconds_older: i64) {
        let now = SystemTime::now();
        let time = if seconds_older >= 0 {
            now - Duration::from_secs(seconds_older as u64)
        } else {
            now + Duration::from_secs(seconds_older.unsigned_abs())
        };
        std::fs::File::options()
            .write(true)
            .open(dir.join(".markharness-gui/strictdoc/json/index.json"))
            .unwrap()
            .set_modified(time)
            .unwrap();
    }

    /// Stands in for `strictdoc export`: writes `json/index.json` under the output directory.
    struct FakeRunner {
        result: Mutex<Result<Option<String>, ExportError>>,
        runs: Mutex<usize>,
    }

    impl FakeRunner {
        fn writing(json: &str) -> Self {
            FakeRunner {
                result: Mutex::new(Ok(Some(json.to_string()))),
                runs: Mutex::new(0),
            }
        }

        fn failing(error: ExportError) -> Self {
            FakeRunner {
                result: Mutex::new(Err(error)),
                runs: Mutex::new(0),
            }
        }

        fn runs(&self) -> usize {
            *self.runs.lock().unwrap()
        }
    }

    impl StrictDocRunner for FakeRunner {
        async fn export(&self, _project_root: &Path, output_dir: &Path) -> Result<(), ExportError> {
            *self.runs.lock().unwrap() += 1;
            match &*self.result.lock().unwrap() {
                Ok(Some(json)) => {
                    std::fs::create_dir_all(output_dir.join("json")).unwrap();
                    std::fs::write(output_dir.join("json/index.json"), json).unwrap();
                    Ok(())
                }
                Ok(None) => Ok(()),
                Err(e) => Err(e.clone()),
            }
        }
    }

    #[tokio::test]
    async fn does_nothing_for_a_project_that_does_not_use_strictdoc() {
        let dir = project();
        let runner = FakeRunner::writing(EXPORT);

        let loaded = load_strictdoc(&runner, &dir, false).await.unwrap();

        assert_eq!(loaded, None);
        assert_eq!(runner.runs(), 0);
    }

    #[tokio::test]
    async fn exports_once_and_reads_the_result() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing(EXPORT);

        let loaded = load_strictdoc(&runner, &dir, false).await.unwrap();

        assert_eq!(loaded.unwrap().documents.len(), 2);
        assert_eq!(runner.runs(), 1);
    }

    #[tokio::test]
    async fn serves_the_saved_export_while_no_source_is_newer() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing(EXPORT);
        load_strictdoc(&runner, &dir, false).await.unwrap();
        age_saved_export(&dir, -3600);

        let loaded = load_strictdoc(&runner, &dir, false).await.unwrap();

        assert!(loaded.is_some());
        assert_eq!(runner.runs(), 1);
    }

    #[tokio::test]
    async fn exports_again_when_a_document_is_newer_than_the_saved_export() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing(EXPORT);
        load_strictdoc(&runner, &dir, false).await.unwrap();
        age_saved_export(&dir, 3600);

        load_strictdoc(&runner, &dir, false).await.unwrap();

        assert_eq!(runner.runs(), 2);
    }

    #[tokio::test]
    async fn exports_again_when_asked_to_skip_the_saved_export() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing(EXPORT);
        load_strictdoc(&runner, &dir, false).await.unwrap();
        age_saved_export(&dir, -3600);

        load_strictdoc(&runner, &dir, true).await.unwrap();

        assert_eq!(runner.runs(), 2);
    }

    #[tokio::test]
    async fn ignores_changes_to_files_that_are_not_documents() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing(EXPORT);
        load_strictdoc(&runner, &dir, false).await.unwrap();
        age_saved_export(&dir, -3600);
        std::fs::write(dir.join("docs/app.py"), "x = 1").unwrap();

        load_strictdoc(&runner, &dir, false).await.unwrap();

        assert_eq!(runner.runs(), 1);
    }

    #[tokio::test]
    async fn shows_nothing_when_the_export_fails_even_if_an_older_one_is_saved() {
        let dir = project();
        with_strictdoc(&dir);
        load_strictdoc(&FakeRunner::writing(EXPORT), &dir, false)
            .await
            .unwrap();
        let failing = FakeRunner::failing(ExportError::Failed("error: bad sdoc".to_string()));

        let err = load_strictdoc(&failing, &dir, true).await.unwrap_err();

        assert_eq!(err, ExportError::Failed("error: bad sdoc".to_string()));
    }

    #[tokio::test]
    async fn treats_strictdoc_that_is_not_installed_as_not_used() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::failing(ExportError::NotInstalled);

        let loaded = load_strictdoc(&runner, &dir, false).await.unwrap();

        assert_eq!(loaded, None);
    }

    #[tokio::test]
    async fn reports_an_export_it_cannot_read() {
        let dir = project();
        with_strictdoc(&dir);
        let runner = FakeRunner::writing("not json");

        let err = load_strictdoc(&runner, &dir, false).await.unwrap_err();

        assert!(matches!(err, ExportError::Failed(_)), "{err:?}");
    }
}
