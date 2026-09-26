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

  describe("placeholder labels", () => {
    it("renders a label inside the rule as real text", () => {
      const html = render(`Gardener signature: ${FIELD_RULE}{Signature}`);
      expect(html).toContain("sig-line--labelled");
      expect(html).toContain('<span class="sig-line__label">Signature</span>');
      expect(html).not.toContain("{Signature}");
    });

    it("does not hide a labelled rule from assistive technology", () => {
      const html = render(`Signature: ${FIELD_RULE}{Signature}`);
      expect(html).not.toContain("aria-hidden");
    });

    it("still hides unlabelled rules", () => {
      const html = render(`Signature: ${FIELD_RULE}`);
      expect(html).toContain('aria-hidden="true"');
    });

    it("treats empty braces as no label", () => {
      const html = render(`Signature: ${FIELD_RULE}{}`);
      expect(html).not.toContain("sig-line--labelled");
      expect(html).not.toContain("sig-line__label");
      expect(html).not.toContain("{}");
    });

    it("keeps prose that follows a rule, including parentheses", () => {
      // Real line from the waiver — the parenthetical is content, not a label.
      const html = render(`**Between:** ${"_".repeat(40)} ("Supplier")`);
      expect(html).toContain('("Supplier")');
      expect(html).not.toContain("sig-line--labelled");
    });

    it("requires the braces to touch the underscores", () => {
      const html = render(`${FIELD_RULE} {not a label}`);
      expect(html).not.toContain("sig-line--labelled");
      expect(html).toContain("{not a label}");
    });

    it("keeps punctuation after a labelled blank", () => {
      const html = render(`made on this ${INLINE_SHORT}{day} day of ${INLINE_MED}{month}, 2026`);
      expect(html).toContain(">day</span>");
      expect(html).toContain(">month</span>");
      expect(html).toContain("</span>, 2026");
    });

    it("labels both fields on a two-field line", () => {
      const html = render(`Gardener signature: ${FIELD_RULE}{Signature} Date: ${DATE_FIELD}{Date}`);
      expect(html.match(/sig-line__label/g)?.length).toBe(2);
      expect(html).toContain("Gardener signature:");
      expect(html).toContain(" Date: ");
    });
  });

  describe("signature blocks", () => {
    // Verbatim shape of the Google Docs export: hard breaks, uneven runs.
    const MEMBER = [
      "Name (please print): ___________________________  ",
      "Signature: ____________________________  ",
      "Date: ______________",
    ].join("\n");

    it("groups consecutive label-and-rule lines into one block", () => {
      const html = render(MEMBER);
      expect(html.match(/class="sig-block"/g)?.length).toBe(1);
      expect(html.match(/sig-block__label/g)?.length).toBe(3);
      expect(html).not.toContain("<p>");
      expect(html).not.toContain("<br>");
    });

    it("makes every rule in a block a field, whatever its length", () => {
      const html = render(MEMBER);
      expect(html).not.toContain("sig-line--blank");
      expect(html.match(/sig-line--field/g)?.length).toBe(3);
    });

    it("accepts labels with no space before the rule", () => {
      const html = render("Board member name:______________  \nSignature:______________");
      expect(html).toContain('<span class="sig-block__label">Board member name:</span>');
    });

    it("groups lines written as separate paragraphs", () => {
      const html = render(`Name: ${FIELD_RULE}{Alex}\n\nSignature: ${FIELD_RULE}\n\nDate: ${DATE_FIELD}`);
      expect(html.match(/class="sig-block"/g)?.length).toBe(1);
      expect(html).toContain(">Alex</span>");
    });

    it("keeps formatting in labels", () => {
      const html = render(`**Name:** ${FIELD_RULE}  \n**Date:** ${DATE_FIELD}`);
      expect(html).toContain('<span class="sig-block__label"><strong>Name:</strong></span>');
    });

    it("leaves a lone field line alone", () => {
      const html = render(`Signature: ${FIELD_RULE}`);
      expect(html).not.toContain("sig-block");
      expect(html).toContain("<p>");
    });

    it("leaves lines with prose or a second field after the rule alone", () => {
      expect(render(`Gardener signature: ${FIELD_RULE} Date: ${DATE_FIELD}  \nHomeowner signature: ${FIELD_RULE} Date: ${DATE_FIELD}`)).not.toContain("sig-block");
      expect(render(`**Between:** ${FIELD_RULE} ("Supplier")  \n**And:** ${FIELD_RULE}`)).not.toContain("sig-block");
    });

    it("needs a label on every line", () => {
      expect(render(`Name: ${FIELD_RULE}  \n${FIELD_RULE}`)).not.toContain("sig-block");
    });

    it("finds blocks inside list items and blockquotes", () => {
      expect(render(`> Name: ${FIELD_RULE}  \n> Date: ${DATE_FIELD}`)).toContain("sig-block");
    });
  });

  describe("markers", () => {
    it("moves a heading's section ID onto a data attribute", () => {
      const html = render("### Termination {{2.4}}");
      expect(html).toBe('<h3 data-section="2.4">Termination</h3>');
    });

    it("leaves braces elsewhere in a heading alone", () => {
      expect(render("## Using {{x}} in prose")).toBe("<h2>Using {{x}} in prose</h2>");
    });

    it("renders a page break", () => {
      const html = render("before\n\n{{page_break}}\n\nafter");
      expect(html).toContain('<div class="page-break" role="separator"></div>');
      expect(html).not.toContain("page_break}}");
    });

    it("ignores a page break marker inside prose", () => {
      expect(render("see {{page_break}} here")).toContain("{{page_break}}");
    });
  });

  it("emits the placeholder font stylesheet plus inline CSS", () => {
    const plugin = SignatureLines();
    const resources = plugin.externalResources?.(undefined as never);
    expect(resources?.css?.length).toBe(2);
    expect(resources?.css?.[0]?.content).toBe(
      "https://fonts.googleapis.com/css2?family=Caveat&display=swap",
    );
    expect(resources?.css?.[1]).toMatchObject({ inline: true });
    expect(resources?.css?.[1]?.content).toContain('font-family:"Caveat",cursive');
  });

  it("encodes multi-word font families for Google Fonts", () => {
    const plugin = SignatureLines({ placeholderFont: "Patrick Hand" });
    const resources = plugin.externalResources?.(undefined as never);
    expect(resources?.css?.[0]?.content).toContain("family=Patrick+Hand");
  });

  it("loads no font when placeholderFont is null", () => {
    const plugin = SignatureLines({ placeholderFont: null });
    const resources = plugin.externalResources?.(undefined as never);
    expect(resources?.css?.length).toBe(1);
    expect(resources?.css?.[0]?.content).not.toContain("font-family");
  });
});
