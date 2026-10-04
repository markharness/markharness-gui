// Usage: node scripts/generate-third-party-notices.mjs --write | --check
// Writes (or verifies) THIRD-PARTY-NOTICES.md: the licenses of the Rust and npm
// dependencies that ship in the build. The accepted licenses come from
// src-tauri/about.toml.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildNpmNotices } from "./npm-notices.mjs";

const OUTPUT = "THIRD-PARTY-NOTICES.md";
const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  console.error(
    "usage: node scripts/generate-third-party-notices.mjs --write | --check",
  );
  process.exit(2);
}

const aboutToml = readFileSync("src-tauri/about.toml", "utf8");
const acceptedBlock = aboutToml.match(/accepted\s*=\s*\[([^\]]*)\]/);
if (!acceptedBlock)
  throw new Error("accepted licenses not found in src-tauri/about.toml");
const accepted = [...acceptedBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

// cargo-about refuses to have its stdout redirected under PowerShell, so it writes to a file.
const workDir = mkdtempSync(join(tmpdir(), "notices-"));
const rustFile = join(workDir, "rust.md");
let rust;
try {
  execFileSync(
    "cargo",
    [
      "about",
      "generate",
      "--config",
      "src-tauri/about.toml",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--output-file",
      rustFile,
      "src-tauri/about.hbs",
    ],
    { stdio: "inherit" },
  );
  rust = readFileSync(rustFile, "utf8");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}

const npm = buildNpmNotices({
  lock: JSON.parse(readFileSync("package-lock.json", "utf8")),
  readText: (path) =>
    existsSync(path) ? readFileSync(path, "utf8") : undefined,
  accepted,
});

const text = `${[
  "# Third-party notices",
  "",
  "markharness-gui includes the third-party software listed below. Each entry gives the license text.",
  "The source of every Rust crate is available from the crates.io address next to its name;",
  "the crates under the Mozilla Public License 2.0 are used unmodified.",
  "",
  rust.trimEnd(),
  "",
  "## npm dependencies",
  "",
  npm.trimEnd(),
].join("\n")}\n`.replace(/\r\n/g, "\n");

if (mode === "--write") {
  writeFileSync(OUTPUT, text);
  console.log(`wrote ${OUTPUT}`);
} else {
  const current = existsSync(OUTPUT)
    ? readFileSync(OUTPUT, "utf8").replace(/\r\n/g, "\n")
    : undefined;
  if (current !== text) {
    console.error(
      `${OUTPUT} is missing or out of date: run \`npm run notices\` and commit the result`,
    );
    process.exit(1);
  }
  console.log(`${OUTPUT} is up to date`);
}
