# Curbside Docs — development

Quartz 5 site for docs.curbside.coop. Written 2026-09-09, on WSL/ext4.

## Setup

Node is pinned by `.node-version` (v22.16.0) and `package.json` requires
`node >=22`, `npm >=10.9.2`. `.npmrc` sets `engine-strict=true`, so an older
npm makes `npm ci` hard-fail rather than warn.

```bash
nvm use            # or: nvm install 22
npm ci
npm run plugins:build
npx quartz build --serve --port 8080
```

`nvm` is installed at user level (no sudo on this box) and loads from
`~/.bashrc`. Non-interactive shells skip `.bashrc`, so scripts need
`. "$HOME/.nvm/nvm.sh"` first.

## Layout

```
site/
├── content/                  # the documents (8 files)
├── plugins/
│   └── signature-lines/      # local plugin package, symlinked into .quartz/
├── quartz/                   # upstream engine — do not edit
├── quartz.config.yaml        # config + layout (replaces v4's two .ts files)
├── quartz.lock.json          # plugin versions
└── .quartz/plugins/          # gitignored; symlinks to local plugins
```

`upstream` points at `jackyzha0/quartz`, and this branch descends from it, so
`npx quartz upgrade` works. The v4 repo was vendored with no shared ancestry,
which is why upgrading was impossible before.

## Plugin development loop

The plugin is a real npm package symlinked into `.quartz/plugins/` by
`npx quartz plugin add ./plugins/signature-lines`. Quartz loads its **built
`dist/`**, not its source, so a source edit needs a rebuild:

```bash
npm --prefix plugins/signature-lines run dev    # tsup --watch, leave running
npm --prefix plugins/signature-lines test       # vitest
```

**`quartz build --serve` watches `content/`, not plugins.** After a plugin
rebuild you must restart the dev server — hot reload will not pick it up.

### Where a plugin's options come from

Precedence, highest first:

1. `options:` on the plugin's entry in `quartz.config.yaml`
2. `quartz.defaultOptions` in the plugin's `package.json`
3. defaults in the plugin's TypeScript source

(2) beats (3), which is surprising: editing the default in `transformer.ts`
appears to do nothing while the manifest still lists a value. Change both, or
override in the config.

## Gotchas found the hard way

**`byPageType.exclude` needs full source strings.** Quartz's
`extractPluginName()` (`quartz/plugins/loader/config-loader.ts:59`) handles
local paths, `github:` and URL sources but has no branch for npm-scoped
packages, so `"@quartz-community/explorer"` is returned verbatim. A short name
like `explorer` in an exclude list silently matches nothing — no error, the
component just keeps rendering. Worth reporting upstream.

**Local plugins don't survive CI as-is.** `quartz.lock.json` stores the
*absolute* resolved path (`/home/ianrd/...`), and `plugin install` reads that
path. A build on another machine fails with "local path missing". The
`source` in `quartz.config.yaml` is stored as typed (relative), so
`plugin install --from-config` is the path that works elsewhere. Resolve this
properly before wiring up the deploy — see below.

**`.gitignore` is itself gitignored** by upstream's root `.gitignore`. New
ignore rules need `git add -f`.

**`plugin resolve` is deprecated** in favour of `plugin install --from-config`.

**`plugin install` prunes the plugin's devDependencies**, so `npm test` in the
plugin then fails with `vitest: not found`. Re-run `npm run plugins:build` to
restore them.

## Resolved from the previous handoff

- **`--serve` works** on ext4 with no `-o /native/path` workaround. No `EIO`
  error; hot reload fires reliably (~120ms incremental rebuild). This was a
  Windows-mount problem, as suspected.
- **Git dates work.** The "isn't yet tracked by git" warnings were correct in
  the new tree until content was committed; after committing, dates resolve
  and match `git log` exactly. The v4 failure was the mounted `.git`, not a
  Quartz bug — so the git-backed version-history feature is unblocked.
- **`_templates` was being published.** v4's `ignorePatterns` listed
  `templates`, which never matched `_templates`. Now fixed; the build went
  from 8 input files to 6.
- **`npx quartz migrate` no longer exists.** It was removed between the
  `v5.0.0` tag and the current `v5` branch tip, so the config was ported by
  hand.

## Open

- **Deploy is not wired up.** `vercel.json` and the four GitHub workflows from
  v4 have not been carried over or re-checked against v5's build. The local
  plugin's absolute-path lockfile entry needs solving first — either extract
  the plugin to its own repo and reference it as `github:`, or have CI run
  `plugin install --from-config`.
- **Layout is a faithful port of v4**, which means content pages have no
  navigation at all — no breadcrumbs, title, search, explorer, or sidebars.
  That was deliberate in v4 but is worth revisiting now; it is a one-line
  change per component in `quartz.config.yaml`.
- Breadcrumbs carry `condition: not-index`, so they don't render on folder
  pages the way v4's list layout did. Drop the condition if you want them.
- Phase two from the previous handoff still stands: splitting content from
  engine, and the dual-render (canonical vs. annotated) work.
