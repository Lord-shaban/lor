import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocs } from "./check-doc-links.mjs";

function fixture(files, verify) {
  const root = mkdtempSync(join(tmpdir(), "lor-doc-links-"));
  try {
    mkdirSync(join(root, "docs"));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
    }
    return verify(checkDocs(root), root);
  } finally {
    if (!root.startsWith(`${tmpdir()}${sep}lor-doc-links-`)) throw new Error("Unexpected fixture path");
    rmSync(root, { recursive: true });
  }
}

test("checks local files and GitHub-style headings, including Arabic and duplicates", () => {
  fixture({
    "README.md": "# Overview\n[local](#overview) [guide](docs/guide.md#عنوان-عربي-1)\n![image](docs/pic.webp)\n[site](/docs) [web](https://example.com)\n```md\n[ignored](missing.md)\n```\n`[ignored](missing.md)`\n",
    "README.ar.md": "# العربية\n",
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/guide.md": "# عنوان عربي\n## عنوان عربي\n",
    "docs/pic.webp": "fixture",
  }, ({ files, checkedLinks, errors }) => {
    assert.equal(files, 4);
    assert.equal(checkedLinks, 3);
    assert.deepEqual(errors, []);
  });
});

test("reports the source line and broken file or heading", () => {
  fixture({
    "README.md": "# Start\n[missing](docs/nope.md)\n[heading](docs/guide.md#absent)\n",
    "README.ar.md": "# العربية\n",
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/guide.md": "# Present\n",
  }, ({ errors }, root) => {
    assert.deepEqual(errors, [
      "README.md:2: missing local target: docs/nope.md",
      "README.md:3: missing heading #absent in docs/guide.md",
    ]);
    const run = spawnSync(process.execPath, [fileURLToPath(new URL("./check-doc-links.mjs", import.meta.url)), root], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /README\.md:2: missing local target: docs\/nope\.md/);
  });
});
