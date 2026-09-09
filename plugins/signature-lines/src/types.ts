import type { Node } from "unist";

export interface SignatureLinesOptions {
  /**
   * Minimum number of consecutive underscores before a run is treated as a
   * standalone field rule (a signature/date box) rather than an inline blank
   * sitting inside a sentence.
   *
   * The real Curbside documents are cleanly bimodal: inline blanks run 6-12
   * characters ("made on this ______ day of ________, 2026"), field rules run
   * 22-52 ("Signature: ________________________________________"). 16 sits in
   * the empty gap between the two clusters.
   */
  fieldRuleMinLength: number;

  /**
   * Shortest underscore run the plugin will touch at all. Runs below this are
   * left as literal text.
   */
  minRunLength: number;

  /**
   * Hide the generated rules from assistive technology. Underscore runs are
   * otherwise announced one character at a time ("underscore, underscore,
   * ..."); the adjacent label ("Signature:") carries the meaning.
   */
  ariaHidden: boolean;
}

export type SignatureLineKind = "blank" | "field";

/**
 * The node this plugin inserts in place of an underscore run. It carries no
 * children and no value — the rendered element is empty by design, drawn
 * entirely with a CSS border.
 */
export interface SignatureLineNode extends Node {
  type: "signatureLine";
}

// Register the node with mdast so it is a legal phrasing child and other
// plugins downstream can see it.
declare module "mdast" {
  interface PhrasingContentMap {
    signatureLine: SignatureLineNode;
  }

  interface RootContentMap {
    signatureLine: SignatureLineNode;
  }
}
