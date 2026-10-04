function isAllowed(license, accepted) {
  return license
    .replace(/[()]/g, "")
    .split(" OR ")
    .some((alternative) => accepted.includes(alternative.trim()));
}

const LICENSE_FILE_NAMES = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "LICENCE",
  "LICENSE-MIT",
  "license",
  "license.md",
];

export function buildNpmNotices({ lock, readText, accepted }) {
  return Object.entries(lock.packages)
    .filter(([path, info]) => path !== "" && !info.dev)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, info]) => {
      const name = path.replace(/^.*node_modules\//, "");
      if (!info.license) {
        throw new Error(`${name}@${info.version}: no license declared`);
      }
      if (!isAllowed(info.license, accepted)) {
        throw new Error(
          `${name}@${info.version}: license ${info.license} is not allowed`,
        );
      }
      const text = LICENSE_FILE_NAMES.map((file) =>
        readText(`${path}/${file}`),
      ).find((t) => t !== undefined);
      if (text === undefined) {
        throw new Error(`${name}@${info.version}: no license file found`);
      }
      return `### ${name} ${info.version} (${info.license})\n\n${text}\n`;
    })
    .join("\n");
}
