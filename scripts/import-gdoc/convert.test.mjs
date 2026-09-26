import { test } from "node:test";
import assert from "node:assert/strict";
import { convert, ConvertError, stripFrontmatter } from "./convert.mjs";

const body = (src) => stripFrontmatter(convert(src, { title: "T" }).markdown).body.trim();

test("unwraps whole-heading bold and moves the section ID to the end", () => {
  assert.equal(body("### **Termination {{2.4}}**"), "### Termination {{2.4}}");
});

test("keeps partial bold in headings", () => {
  assert.equal(body("## **Rules** of play"), "## **Rules** of play");
});

test("drops empty headings", () => {
  assert.equal(body("para\n\n#### \n\n### \n\nnext"), "para\n\nnext");
});

test("unescapes markers and underscore runs", () => {
  assert.equal(body("{{page\\_break}}"), "{{page_break}}");
  assert.equal(body("Date: \\_\\_\\_\\_"), "Date: ____");
  // A lone escaped underscore is prose, not a rule.
  assert.equal(body("snake\\_case"), "snake\\_case");
});

test("tightens loose lists but keeps paragraph breaks around them", () => {
  assert.equal(body("Intro:\n\n* a\n\n* b\n\n  * c\n\nAfter"), "Intro:\n\n* a\n* b\n  * c\n\nAfter");
});

test("keeps Google's escapes, which stop $ becoming LaTeX", () => {
  assert.equal(body("costs \\$10 and \\$10"), "costs \\$10 and \\$10");
});

test("rejects unknown, inline and duplicate markers", () => {
  assert.throws(() => body("{{pagebreak}}"), ConvertError);
  assert.throws(() => body("text {{page_break}}"), ConvertError);
  assert.throws(() => body("# A {{1}}\n\n# B {{1}}"), ConvertError);
  assert.throws(() => body("# A {{page_break}}"), ConvertError);
});

test("warns about untagged headings once a document uses section IDs", () => {
  const { warnings } = convert("# A {{1}}\n\n## B", { title: "T" });
  assert.deepEqual(warnings, ['heading has no section ID: "B"']);
  assert.deepEqual(convert("# A\n\n## B", { title: "T" }).warnings, []);
});

test("keeps existing frontmatter", () => {
  const fm = "---\ntitle: Kept\ndraft: false\n---\n";
  assert.ok(convert("# A", { title: "T", frontmatter: fm }).markdown.startsWith(fm));
});

test("is idempotent", () => {
  const src = "# **A {{1}}**\n\n* x\n\n* y\n\n{{page\\_break}}\n\nSig: \\_\\_\\_\\_  \nDate: \\_\\_\\_";
  const once = convert(src, { title: "T" }).markdown;
  const { frontmatter } = stripFrontmatter(once);
  assert.equal(convert(once, { title: "T", frontmatter }).markdown, once);
});
