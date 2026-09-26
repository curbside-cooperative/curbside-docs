# @curbside/quartz-signature-lines

Replaces runs of underscores with sized, unbreakable rule elements.

## The problem

Quartz's base CSS applies `overflow-wrap: break-word` to `p`, `li`, `td` and
friends. That chops any single token wider than the line at an arbitrary
point, so a signature line written as forty underscores breaks mid-run on a
phone and looks broken. CSS alone can't fix it: removing `break-word` or
adding `nowrap` just converts the breakage into horizontal overflow.

The real issue is that a signature line is a *box* encoded as *text*, at a
length chosen for 8.5" paper. This plugin stops it being characters — it emits
an empty `<span>` carrying a `border-bottom`, and lets the box model do the
work. As an inline-block it either fits or wraps whole; it can never be split.

## The three patterns

A naive implementation gets the third one wrong:

```
Signature: ________________________________________     ← field rule
Gardener signature: __________ Date: ______________     ← two fields, one line
made on this ______ day of ________, 2026               ← inline blank in prose
```

Stretching that last one tears the sentence apart. Run length already encodes
intent, and the real documents are cleanly bimodal — inline blanks run 6–12
characters, field rules 22–52, with nothing in between. `fieldRuleMinLength`
defaults to 16, in the middle of that gap.

## Placeholder labels

On a phone, a long rule usually wraps onto its own line beneath its label —
where it looks like a horizontal rule, not an input. A placeholder fixes
that. Author it in braces immediately after the underscores, no space:

```
i) The Gardener (name): ________________________{Jane Doe}
Gardener signature: ________________{Jane Doe} Date: __________{May 15, 2026}
made on this ______{15th} day of ________{May}, 2026
```

Use *sample data*, not field names: the document should read as a filled-in
copy. On screen the placeholder is rendered in grey in a handwritten face
(`placeholderFont`, default Caveat from Google Fonts) at body size, sharing
the prose baseline; in print it is hidden and the rule is blank. Braces are inert in Markdown and Obsidian, so
the source still previews as a blank. The braces must touch the underscores:
`______ ("Supplier")` is prose and is left alone. Unlabelled runs keep
working, so labels can be added incrementally.

## Signature blocks

Two or more consecutive lines that each read `Label: ____` are a block, and
nothing may follow the rule. They can be joined by hard breaks or written as
separate paragraphs:

```
Name (please print): ___________________________
Signature: ____________________________
Date: ______________
```

A block renders as a grid: labels at their natural width, and rules filling
the rest so they all end at the right edge of the content column. Run lengths are ignored, and
every rule in a block is a field. A line with prose or a second field after
its rule (`Gardener signature: ____ Date: ____`) is not a block line.

## Markers

This package also renders the `{{markers}}` that the Google Docs importer
passes through (see DEVELOPMENT.md): `{{page_break}}` becomes
`<div class="page-break">`, and a trailing `{{2.4}}` on a heading becomes
`data-section="2.4"`. That leaves the heading's slug `id` alone, so
table-of-contents links still work. Markers run first, before
table-of-contents and description read the tree.

## Options

| Option               | Default | Meaning                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `fieldRuleMinLength` | `16`    | At or above this length, a run is a field rule |
| `minRunLength`       | `3`     | Shorter runs are left as literal text          |
| `ariaHidden`         | `true`  | Hide *unlabelled* rules from screen readers    |
| `placeholderFont`    | `Caveat`| Google Fonts family for placeholders; `null` inherits |

Set them under `options:` in `quartz.config.yaml`. Note that
`quartz.defaultOptions` in `package.json` overrides the defaults in
`transformer.ts`.

## Output

```html
Signature: <span class="sig-line sig-line--field" style="--sig-len:52;" aria-hidden="true"></span>
```

Width derives from the original run length, so a 52-underscore signature rule
stays visibly longer than a 22-underscore date field. `aria-hidden` matters:
screen readers otherwise announce "underscore" forty times per line.

`.sig-line` is also a discrete, addressable element — the natural anchor for
e-signing later.

## Development

```bash
npm install
npm run dev     # tsup --watch
npm test        # vitest
```

Quartz loads `dist/`, so rebuild after editing, and restart
`quartz build --serve` — it watches `content/`, not plugins.
