import type { Plugin } from "unified";
import type { Heading, Paragraph, Root as MdastRoot } from "mdast";
import type { PageBreakNode } from "./types";

// Markers are authored in Google Docs, where Markdown can't express them, and
// passed through by the importer (scripts/import-gdoc). They must be stripped
// here, before table-of-contents and description read the tree.

/** `### Termination {{2.4}}`: a section ID that survives heading renames. */
const SECTION_ID = /\s*\{\{([A-Za-z0-9][\w.-]*)\}\}\s*$/;

const PAGE_BREAK = "{{page_break}}";

export const remarkMarkers: Plugin<[], MdastRoot> = () => (tree: MdastRoot) => {
  tree.children = tree.children.map((node) => {
    if (node.type === "heading") tagSection(node);
    if (node.type === "paragraph" && isPageBreak(node)) {
      const pageBreak: PageBreakNode = {
        type: "pageBreak",
        data: {
          hName: "div",
          hProperties: { className: ["page-break"], role: "separator" },
        },
      };
      return pageBreak;
    }
    return node;
  });
};

function tagSection(heading: Heading) {
  const last = heading.children.at(-1);
  if (last?.type !== "text") return;
  const match = SECTION_ID.exec(last.value);
  if (!match) return;

  last.value = last.value.slice(0, match.index);
  // The ID goes on a data attribute rather than `id`, so the slug anchors that
  // table-of-contents links to keep working.
  heading.data = {
    ...heading.data,
    hProperties: { ...heading.data?.hProperties, dataSection: match[1] },
  };
}

function isPageBreak(paragraph: Paragraph) {
  const [only, ...rest] = paragraph.children;
  return rest.length === 0 && only?.type === "text" && only.value.trim() === PAGE_BREAK;
}
