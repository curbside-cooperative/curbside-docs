import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type { PluggableList } from "unified";
import { SignatureLines } from "../src/transformer";
import type { SignatureLinesOptions } from "../src/types";

const render = (markdown: string, opts?: Partial<SignatureLinesOptions>): string => {
  const plugin = SignatureLines(opts);
  const markdownPlugins = (plugin.markdownPlugins?.(
    undefined as never,
  ) ?? []) as PluggableList;

  return unified()
    .use(remarkParse)
    .use(markdownPlugins)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();
};

// Run lengths taken verbatim from the real Curbside documents.
const FIELD_RULE = "_".repeat(52); // "Gardener signature: ____…"
const DATE_FIELD = "_".repeat(22); // "Date: ____…"
const INLINE_SHORT = "_".repeat(6); // "made on this ______ day"
const INLINE_MED = "_".repeat(12); // "between the hours of ____ and ____"

describe("SignatureLines", () => {
  it("replaces an underscore run with an empty span, not text", () => {
    const html = render(`Signature: ${FIELD_RULE}`);
    expect(html).toContain('<span class="sig-line sig-line--field"');
    // The literal underscores must be gone — that is the entire point.
    expect(html).not.toContain("____");
  });

  it("classifies a long run as a field rule", () => {
    const html = render(`Signature: ${FIELD_RULE}`);
    expect(html).toContain("sig-line--field");
    expect(html).not.toContain("sig-line--blank");
  });

  it("classifies a short in-sentence run as an inline blank", () => {
    const html = render(`made on this ${INLINE_SHORT} day of ${INLINE_MED}, 2026`);
    expect(html).toContain("sig-line--blank");
    expect(html).not.toContain("sig-line--field");
  });

  it("preserves the surrounding sentence around inline blanks", () => {
    const html = render(`The Gardener may access the spigot between the hours of ${INLINE_MED} and ${INLINE_MED}.`);
    expect(html).toContain("The Gardener may access the spigot between the hours of");
    expect(html).toContain(" and ");
    expect(html).toContain(".");
  });

  it("encodes the original run length so rules keep their relative size", () => {
    const html = render(`Signature: ${FIELD_RULE} Date: ${DATE_FIELD}`);
    expect(html).toContain("--sig-len:52");
    expect(html).toContain("--sig-len:22");
  });

  it("handles two fields on one line", () => {
    const html = render(`Gardener signature: ${FIELD_RULE} Date: ${DATE_FIELD}`);
    const matches = html.match(/sig-line/g) ?? [];
    // two elements, each carrying two class names
    expect(matches.length).toBe(4);
    expect(html).toContain("Gardener signature:");
    expect(html).toContain("Date:");
  });

  it("hides rules from assistive technology by default", () => {
    const html = render(`Signature: ${FIELD_RULE}`);
    expect(html).toContain('aria-hidden="true"');
  });

  it("can leave rules exposed to assistive technology", () => {
    const html = render(`Signature: ${FIELD_RULE}`, { ariaHidden: false });
    expect(html).not.toContain("aria-hidden");
  });

  it("respects a custom field-rule threshold", () => {
    const html = render(`Signature: ${INLINE_MED}`, { fieldRuleMinLength: 10 });
    expect(html).toContain("sig-line--field");
  });

  it("leaves runs shorter than minRunLength alone", () => {
    const html = render("snake_case and __dunder__ stay put");
    expect(html).not.toContain("sig-line");
  });

  it("does not touch underscores inside code blocks", () => {
    const html = render(["```", `let x = "${FIELD_RULE}"`, "```"].join("\n"));
    expect(html).not.toContain("sig-line");
    expect(html).toContain("____");
  });

  it("does not touch underscores inside inline code", () => {
    const html = render(`the token \`${FIELD_RULE}\` is literal`);
    expect(html).not.toContain("sig-line");
  });

  it("processes multiple files without regex state leaking between them", () => {
    // A /g regex shared across calls carries lastIndex and silently skips
    // matches on the second pass. Same plugin instance, two documents.
    const plugin = SignatureLines();
    const markdownPlugins = (plugin.markdownPlugins?.(undefined as never) ??
      []) as PluggableList;
    const processor = unified()
      .use(remarkParse)
      .use(markdownPlugins)
      .use(remarkRehype)
      .use(rehypeStringify);

    const first = processor.processSync(`Signature: ${FIELD_RULE}`).toString();
    const second = processor.processSync(`Signature: ${FIELD_RULE}`).toString();
    expect(first).toContain("sig-line");
    expect(second).toContain("sig-line");
    expect(second).not.toContain("____");
  });

  it("emits inline CSS as an external resource", () => {
    const plugin = SignatureLines();
    const resources = plugin.externalResources?.(undefined as never);
    expect(resources?.css?.length).toBe(1);
    expect(resources?.css?.[0]).toMatchObject({ inline: true });
  });
});
