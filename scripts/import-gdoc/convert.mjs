// Turns a Google Docs Markdown export (File → Download → Markdown) into a
// page for content/.
//
// Every transform here is mechanical: no step rewrites prose, and running the
// converter on its own output changes nothing. Anything the export can't
// express is authored in the Doc as a {{marker}} and passed through for the
// site to render.

/** Markers allowed outside headings. */
const BLOCK_MARKERS = new Set(["page_break"]);

/** A section ID written at the end of a heading, e.g. `{{2.4}}`. */
const SECTION_ID = /^[A-Za-z0-9][\w.-]*$/;

const LIST_ITEM = /^\s*(?:[*+-]|\d+[.)])\s/;

export class ConvertError extends Error {}

/**
 * @param {string} source  the raw export
 * @param {{ title: string, frontmatter?: string }} opts
 *   `frontmatter` is the existing page's `---` block, kept verbatim on re-import.
 * @returns {{ markdown: string, warnings: string[], sections: string[], pageBreaks: number }}
 */
export function convert(source, { title, frontmatter }) {
  const warnings = [];
  let body = stripFrontmatter(source.replace(/\r\n?/g, "\n")).body;

  body = unescapeMarkers(body);
  body = unescapeRuleRuns(body);

  const lines = [];
  const sections = [];
  const untagged = [];
  let pageBreaks = 0;

  for (const [i, line] of body.split("\n").entries()) {
    const heading = /^(#{1,6})[ \t]*(.*?)[ \t]*$/.exec(line);
    if (heading) {
      const out = convertHeading(heading[1], heading[2], i + 1);
      if (out === null) continue; // an empty heading: spacing in the Doc, not content
      if (out.id) sections.push(out.id);
      else untagged.push(out.text);
      lines.push(out.line);
      continue;
    }

    for (const [, name] of line.matchAll(/\{\{([^{}\n]*)\}\}/g)) {
      if (!BLOCK_MARKERS.has(name)) {
        throw new ConvertError(`line ${i + 1}: unknown marker {{${name}}}`);
      }
      if (line.trim() !== `{{${name}}}`) {
        throw new ConvertError(`line ${i + 1}: {{${name}}} must be on a line of its own`);
      }
      pageBreaks++;
    }
    lines.push(line.trim() === "" ? "" : line);
  }

  const dupes = sections.filter((id, i) => sections.indexOf(id) !== i);
  if (dupes.length) {
    throw new ConvertError(`duplicate section IDs: ${[...new Set(dupes)].join(", ")}`);
  }
  // Only a document that has opted into section IDs is expected to have them
  // everywhere; a heading without one can't be tracked across versions.
  if (sections.length && untagged.length) {
    for (const text of untagged) warnings.push(`heading has no section ID: "${text}"`);
  }

  body = tightenLists(lines).join("\n");
  body = body.replace(/\n{3,}/g, "\n\n").trim() + "\n";

  const head = frontmatter ?? defaultFrontmatter(title);
  return { markdown: `${head}\n${body}`, warnings, sections, pageBreaks };
}

/**
 * Google escapes Markdown-significant characters inside markers
 * (`{{page\_break}}`). Marker contents are never Markdown, so drop them all.
 */
function unescapeMarkers(text) {
  return text.replace(/\{\{([^{}\n]*)\}\}/g, (_, inner) => `{{${inner.replace(/\\(.)/g, "$1").trim()}}}`);
}

/**
 * `\_\_\_\_` → `____`, so the signature-lines plugin sees a rule. Shorter
 * escaped runs are left alone; they are literal underscores in prose.
 */
function unescapeRuleRuns(text) {
  return text.replace(/(?:\\_){3,}/g, (run) => "_".repeat(run.length / 2));
}

function convertHeading(hashes, raw, lineNo) {
  let id = null;
  let text = raw.replace(/\s*\{\{([^{}\n]*)\}\}/g, (_, name) => {
    if (!SECTION_ID.test(name) || BLOCK_MARKERS.has(name)) {
      throw new ConvertError(`line ${lineNo}: {{${name}}} is not a valid section ID`);
    }
    if (id) throw new ConvertError(`line ${lineNo}: heading has two section IDs`);
    id = name;
    return "";
  });

  // Docs exports styled headings as `### **Title**`. The heading is already
  // bold, so the markers are noise. Only unwrap when the bold spans the whole
  // heading; partial bold is deliberate emphasis.
  text = text.replace(/\*\*\s*\*\*/g, "").trim();
  const bold = /^\*\*(.+)\*\*$/.exec(text);
  if (bold && !bold[1].includes("**")) text = bold[1].trim();

  if (!text) {
    if (id) throw new ConvertError(`line ${lineNo}: section {{${id}}} has an empty heading`);
    return null;
  }
  return { id, text, line: `${hashes} ${text}${id ? ` {{${id}}}` : ""}` };
}

/**
 * Docs puts a blank line between every bullet, which makes a "loose" list
 * with paragraph spacing on each item. Drop blank lines that sit directly
 * between two list items.
 */
function tightenLists(lines) {
  return lines.filter((line, i) => {
    if (line !== "") return true;
    const prev = lines.slice(0, i).findLast((l) => l !== "");
    const next = lines.slice(i + 1).find((l) => l !== "");
    return !(prev && next && LIST_ITEM.test(prev) && LIST_ITEM.test(next));
  });
}

export function stripFrontmatter(text) {
  const m = /^---\n[\s\S]*?\n---\n/.exec(text);
  return m ? { frontmatter: m[0], body: text.slice(m[0].length) } : { frontmatter: undefined, body: text };
}

function defaultFrontmatter(title) {
  // New pages start as drafts: nothing publishes until someone flips this.
  return `---\ntitle: ${JSON.stringify(title)}\ndescription:\npermalink:\ndraft: true\ntags:\ndate:\n---\n`;
}
