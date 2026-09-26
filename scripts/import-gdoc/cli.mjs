#!/usr/bin/env node
// npm run import -- <export.md> [--out content/Page.md]
//
// Writes the converted page into content/, keeping the existing page's
// frontmatter. Review the result with `git diff` before committing.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";
import { convert, ConvertError, stripFrontmatter } from "./convert.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { out: { type: "string" } },
});

if (positionals.length !== 1) {
  console.error("usage: npm run import -- <export.md> [--out content/Page.md]");
  process.exit(2);
}

const input = positionals[0];
// Browsers add "(2)", " (5)" … to repeat downloads of the same Doc.
const title = basename(input, ".md").replace(/\s*\(\d+\)$/, "");
const out = values.out ?? join("content", `${title}.md`);

const replacing = existsSync(out);
const existing = replacing ? stripFrontmatter(readFileSync(out, "utf8")).frontmatter : undefined;

let result;
try {
  result = convert(readFileSync(input, "utf8"), { title, frontmatter: existing });
} catch (err) {
  if (!(err instanceof ConvertError)) throw err;
  console.error(`✗ ${input}: ${err.message}`);
  process.exit(1);
}

writeFileSync(out, result.markdown);

console.log(`✓ ${replacing ? "updated" : "created"} ${out}`);
console.log(`  sections: ${result.sections.length ? result.sections.join(" ") : "none tagged"}`);
console.log(`  page breaks: ${result.pageBreaks}`);
if (!existing) console.log("  new page starts as draft: true, so edit its frontmatter to publish");
for (const w of result.warnings) console.log(`  ⚠ ${w}`);
console.log("  review with: git diff -- " + JSON.stringify(out));
