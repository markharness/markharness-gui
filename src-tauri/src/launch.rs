use std::path::PathBuf;

#[derive(Debug, PartialEq)]
pub struct LaunchConfig {
    pub project_root: PathBuf,
    pub markharness_bin: PathBuf,
}

#[derive(Debug, PartialEq)]
pub enum LaunchError {
    MissingDir,
}

impl std::fmt::Display for LaunchError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LaunchError::MissingDir => write!(f, "usage: markharness-gui --dir <project root>"),
        }
    }
}

pub fn resolve(
    args: &[String],
    markharness_bin_env: Option<&str>,
) -> Result<LaunchConfig, LaunchError> {
    let dir = args
        .iter()
        .position(|a| a == "--dir")
        .and_then(|i| args.get(i + 1))
        .ok_or(LaunchError::MissingDir)?;
    Ok(LaunchConfig {
        project_root: PathBuf::from(dir),
        markharness_bin: PathBuf::from(markharness_bin_env.unwrap_or("markharness")),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn uses_the_dir_option_as_the_project_root() {
        let config = resolve(&args(&["markharness-gui", "--dir", "/work/project"]), None).unwrap();

        assert_eq!(config.project_root, PathBuf::from("/work/project"));
    }

    #[test]
    fn fails_when_the_dir_option_is_absent() {
        let result = resolve(&args(&["markharness-gui"]), None);

        assert_eq!(result, Err(LaunchError::MissingDir));
    }

    #[test]
    fn fails_when_the_dir_option_has_no_value() {
        let result = resolve(&args(&["markharness-gui", "--dir"]), None);

        assert_eq!(result, Err(LaunchError::MissingDir));
    }

    #[test]
    fn uses_the_markharness_bin_from_the_environment() {
        let config = resolve(
            &args(&["markharness-gui", "--dir", "/work/project"]),
            Some("/opt/markharness/markharness"),
        )
        .unwrap();

        assert_eq!(
            config.markharness_bin,
            PathBuf::from("/opt/markharness/markharness")
        );
    }

    #[test]
    fn falls_back_to_markharness_on_path_without_the_environment() {
        let config = resolve(&args(&["markharness-gui", "--dir", "/work/project"]), None).unwrap();

        assert_eq!(config.markharness_bin, PathBuf::from("markharness"));
    }

    #[test]
    fn explains_the_usage_when_the_dir_option_is_missing() {
        let message = LaunchError::MissingDir.to_string();

        assert_eq!(message, "usage: markharness-gui --dir <project root>");
    }
}
