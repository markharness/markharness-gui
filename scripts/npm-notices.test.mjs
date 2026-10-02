import { describe, expect, it } from "vitest";
import { buildNpmNotices } from "./npm-notices.mjs";

const accepted = ["MIT", "Apache-2.0"];

function lockOf(packages) {
  return { lockfileVersion: 3, packages: { "": { name: "app" }, ...packages } };
}

function licenseFiles(files) {
  return (path) => files[path];
}

describe("buildNpmNotices", () => {
  it("lists production dependencies and leaves out development-only ones", () => {
    const lock = lockOf({
      "node_modules/react": { version: "19.0.0", license: "MIT" },
      "node_modules/vitest": { version: "5.0.0", license: "MIT", dev: true },
    });
    const readText = licenseFiles({
      "node_modules/react/LICENSE": "react license text",
      "node_modules/vitest/LICENSE": "vitest license text",
    });

    const notices = buildNpmNotices({ lock, readText, accepted });

    expect(notices).toContain("react");
    expect(notices).not.toContain("vitest");
  });

  it("shows each dependency's name, version, license and license text", () => {
    const lock = lockOf({
      "node_modules/react": { version: "19.0.0", license: "MIT" },
    });
    const readText = licenseFiles({
      "node_modules/react/LICENSE": "react license text",
    });

    const notices = buildNpmNotices({ lock, readText, accepted });

    expect(notices).toContain("### react 19.0.0 (MIT)");
    expect(notices).toContain("react license text");
  });

  it("fails on a license that is not allowed", () => {
    const lock = lockOf({
      "node_modules/copyleft": { version: "1.0.0", license: "GPL-3.0" },
    });
    const readText = licenseFiles({ "node_modules/copyleft/LICENSE": "text" });

    expect(() => buildNpmNotices({ lock, readText, accepted })).toThrow(
      "copyleft@1.0.0: license GPL-3.0 is not allowed",
    );
  });

  it("accepts a choice of licenses when one of them is allowed", () => {
    const lock = lockOf({
      "node_modules/dual": { version: "1.0.0", license: "(GPL-3.0 OR MIT)" },
    });
    const readText = licenseFiles({
      "node_modules/dual/LICENSE": "dual license text",
    });

    const notices = buildNpmNotices({ lock, readText, accepted });

    expect(notices).toContain("### dual 1.0.0 ((GPL-3.0 OR MIT))");
  });

  it("fails when no license file can be found for a dependency", () => {
    const lock = lockOf({
      "node_modules/react": { version: "19.0.0", license: "MIT" },
    });

    expect(() =>
      buildNpmNotices({ lock, readText: licenseFiles({}), accepted }),
    ).toThrow("react@19.0.0: no license file found");
  });

  it("fails when a dependency declares no license", () => {
    const lock = lockOf({ "node_modules/mystery": { version: "1.0.0" } });
    const readText = licenseFiles({ "node_modules/mystery/LICENSE": "text" });

    expect(() => buildNpmNotices({ lock, readText, accepted })).toThrow(
      "mystery@1.0.0: no license declared",
    );
  });

  it("produces the same text whatever the order of the dependencies", () => {
    const react = { version: "19.0.0", license: "MIT" };
    const scheduler = { version: "0.28.0", license: "MIT" };
    const readText = licenseFiles({
      "node_modules/react/LICENSE": "react license text",
      "node_modules/scheduler/LICENSE": "scheduler license text",
    });

    const forward = buildNpmNotices({
      lock: lockOf({
        "node_modules/react": react,
        "node_modules/scheduler": scheduler,
      }),
      readText,
      accepted,
    });
    const backward = buildNpmNotices({
      lock: lockOf({
        "node_modules/scheduler": scheduler,
        "node_modules/react": react,
      }),
      readText,
      accepted,
    });

    expect(backward).toBe(forward);
  });
});
