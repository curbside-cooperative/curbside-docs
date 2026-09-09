import type { PluggableList, Plugin } from "unified";
import type { Root as MdastRoot } from "mdast";
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
 */
const remarkSignatureLines = (options: SignatureLinesOptions): Plugin<[], MdastRoot> => {
  // Built per-call rather than module-scope: a /g regex carries `lastIndex`
  // between uses, which silently skips matches when shared across files.
  const pattern = new RegExp(`_{${options.minRunLength},}`, "g");

  return () => (tree: MdastRoot, _file: VFile) => {
    findAndReplace(tree, [
      [
        pattern,
        (match: string) => {
          const length = match.length;
          const kind: SignatureLineKind =
            length >= options.fieldRuleMinLength ? "field" : "blank";

          // `data.hName` / `hProperties` let remark-rehype emit a real element
          // without needing raw HTML enabled in the pipeline.
          const node: SignatureLineNode = {
            type: "signatureLine",
            data: {
              hName: "span",
              hProperties: {
                className: ["sig-line", `sig-line--${kind}`],
                // Width is derived from the author's original run length, so a
                // 52-underscore signature rule stays visibly longer than a
                // 22-underscore date field.
                style: `--sig-len:${length}`,
                ...(options.ariaHidden ? { "aria-hidden": "true" } : {}),
              },
              hChildren: [],
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
