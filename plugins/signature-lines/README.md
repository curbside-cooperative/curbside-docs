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

## Options

| Option               | Default | Meaning                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `fieldRuleMinLength` | `16`    | At or above this length, a run is a field rule |
| `minRunLength`       | `3`     | Shorter runs are left as literal text          |
| `ariaHidden`         | `true`  | Hide rules from screen readers                 |

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
