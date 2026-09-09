import type { PluggableList, Plugin } from "unified";
import type { Root as MdastRoot } from "mdast";
import type { ElementContent } from "hast";
import type { VFile } from "vfile";
import { findAndReplace } from "mdast-util-find-and-replace";
import type { QuartzTransformerPlugin } from "@quartz-community/types";
import type {
  SignatureLinesOptions,
  SignatureLineKind,
  SignatureLineNode,
} from "./types";
import styles from "./styles/signature-lines.scss";

const defaultOptions: SignatureLinesOptions = {
  fieldRuleMinLength: 16,
  minRunLength: 3,
  ariaHidden: true,
};

/**
 * A signature line is a *box* that the source encodes as *text* — a run of
 * underscores sized for 8.5" paper. As text it is subject to
 * `overflow-wrap: break-word`, which chops it at an arbitrary character on a
 * narrow screen. Emitting an empty element with a `border-bottom` instead hands
 * the job to the box model: it either fits or wraps whole, and can never be
 * split mid-run.
 *
 * A run may carry a placeholder label in braces, with no space between:
 *
 *     Gardener signature: ______________{Signature}
 *
 * On screen the label is rendered inside the rule so that a rule which wraps
 * onto its own line still reads as a field rather than a horizontal rule. In
 * print the label is hidden and the rule is blank. The braces must touch the
 * underscores; `______ ("Supplier")` is prose and is left alone.
 */
const remarkSignatureLines = (options: SignatureLinesOptions): Plugin<[], MdastRoot> => {
  // Built per-call rather than module-scope: a /g regex carries `lastIndex`
  // between uses, which silently skips matches when shared across files.
  const pattern = new RegExp(`(_{${options.minRunLength},})(?:\\{([^}\\n]*)\\})?`, "g");

  return () => (tree: MdastRoot, _file: VFile) => {
    findAndReplace(tree, [
      [
        pattern,
        (_match: string, run: string, rawLabel?: string) => {
          const length = run.length;
          const label = rawLabel?.trim() ?? "";
          const kind: SignatureLineKind =
            length >= options.fieldRuleMinLength ? "field" : "blank";

          const className = ["sig-line", `sig-line--${kind}`];
          if (label) className.push("sig-line--labelled");

          const hChildren: ElementContent[] = label
            ? [
                {
                  type: "element",
                  tagName: "span",
                  properties: { className: ["sig-line__label"] },
                  children: [{ type: "text", value: label }],
                },
              ]
            : [];

          // `data.hName` / `hProperties` let remark-rehype emit a real element
          // without needing raw HTML enabled in the pipeline.
          const node: SignatureLineNode = {
            type: "signatureLine",
            data: {
              hName: "span",
              hProperties: {
                className,
                // Width is derived from the author's original run length, so a
                // 52-underscore signature rule stays visibly longer than a
                // 22-underscore date field.
                style: `--sig-len:${length}`,
                // A labelled rule has real text for assistive technology to
                // announce; only the empty ones are hidden.
                ...(!label && options.ariaHidden ? { "aria-hidden": "true" } : {}),
              },
              hChildren,
            },
          };
          return node;
        },
      ],
    ]);
  };
};

/**
 * Replaces underscore runs with sized, unbreakable rule elements.
 */
export const SignatureLines: QuartzTransformerPlugin<Partial<SignatureLinesOptions>> = (
  userOptions?: Partial<SignatureLinesOptions>,
) => {
  const options = { ...defaultOptions, ...userOptions };
  return {
    name: "SignatureLines",
    markdownPlugins(): PluggableList {
      return [remarkSignatureLines(options)];
    },
    externalResources() {
      return {
        css: [{ content: styles, inline: true }],
      };
    },
  };
};
