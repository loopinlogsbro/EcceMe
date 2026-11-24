# ecce.me — Project Handoff

**Prepared:** 2026-11-24
**Purpose:** Hand development and publishing of https://ecce.me from Claude Code to ChatGPT Codex.
**Repo:** `loopinlogsbro/EcceMe` · **Live:** https://ecce.me · **Stack:** Hugo → GitHub → Cloudflare Pages

---

## 0. TL;DR for the incoming agent

The site is **healthy and fully deployed** — it is just unfinished. Last real change was
**2026-07-05**. Nothing is broken; development simply stopped.

Three things you must know before touching anything:

1. **The theme is a git submodule pointing at a personal fork.** A fresh clone will not build
   without `git submodule update --init --recursive`. See §3.2 — this is the single biggest
   fragility in the project.
2. **The Hugo version is not pinned.** Cloudflare builds with whatever its build system
   defaults to (currently 0.147.7). A Cloudflare-side default bump can change your build with
   no commit. See §3.3 and §7.
3. **`AGENTS.md` is in `.gitignore`.** Codex reads `AGENTS.md` from the repo. You must remove
   that ignore line or Codex cloud will never see its own instructions. See §8.2.

---

## 1. What this site is

A personal "builder site": a public record of coursework (WGU computer science), project
writeups, and work logs. Latin *ecce* = "behold".

Current published surface is deliberately small:

| Route | Status | Notes |
|---|---|---|
| `/` | live | Hero + 3 project cards |
| `/about/` | live | Custom layout (`layouts/about/single.html`) |
| `/projects/` | live | Section index |
| `/projects/ecce-me/` | live | The only real project writeup |
| `/courses/` | live | **Orphaned — no nav link points here** |
| `/courses/c952-computer-architecture/` | live | |
| `/logs/` | **404** | Deliberate: `build.render: never` |
| `/logs/2026-05-07-site-cleanup/` | live | **Orphan — parent 404s, but it is in the sitemap** |
| `/index.xml`, `/robots.txt`, `/sitemap.xml` | live | |
| `/private/*` | 302 → Cloudflare Access login | **Guards content that no longer exists** |
| `/gallery/`, `/blogs/` | 404 | Removed 2026-07 |

**Homepage reality check:** of the three project cards, two are `placeholder: true` and render
as "Coming soon" (`Porky`, `De-clouding a Zigbee Gateway`). Only `Ecce.me` is a real card.
Navigation has exactly two items: `About` and an anchor to `#projects`.

---

## 2. Repository layout

36 tracked files. Hugo builds 26 pages + 2056 static files (~13 MB output).

```
EcceMe/
├── hugo.yaml                  # ALL site config + hero/projects/about content (see warning below)
├── .gitignore                 # ignores AGENTS.md, ecce-site-change-plan.md, public/, .claude/
├── .gitmodules                # themes/hugo-profile -> loopinlogsbro/hugo-profile
├── .hugo_build.lock           # TRACKED BY MISTAKE - generated file, should be ignored
├── archetypes/                # courses, logs, projects, default
├── content/
│   ├── about.md               # type: about  (explicit, so routing works on any Hugo version)
│   ├── courses/               # _index.md + c952-computer-architecture.md
│   ├── logs/                  # _index.md (render: never) + 2026-05-07-site-cleanup.md
│   └── projects/              # _index.md + ecce-me.md (showInHome: false)
├── layouts/
│   ├── index.html             # homepage; calls hero-log + projects + 4 DISABLED partials
│   ├── about/single.html      # custom About layout
│   └── partials/
│       ├── head.html, head/extensions.html
│       └── sections/
│           ├── header.html, projects.html
│           ├── hero-log.html, hero-name-svg.html, hero/index.html
│           └── footer/        # index, brand, copyright, recentBlogPosts, socialNetwork
├── static/
│   ├── css/custom.css         # 343 lines
│   ├── js/navbar.js           # brand scramble + nav hover glitch effects
│   ├── images/                # ecce-logo.png, me.png (me.png is NEVER rendered)
│   └── robots.txt             # 4 lines; Cloudflare prepends ~100 managed lines at the edge
└── themes/hugo-profile/       # GIT SUBMODULE - see §3.2
```

> **Warning — content lives in config.** The hero text, the project cards, the skills list and
> the About blurb are all in `hugo.yaml` under `params:`, not in Markdown. This is how the
> upstream theme works, but it means editing visible copy means editing config. If you move
> content, move it to `content/` or `data/`, not deeper into `hugo.yaml`.

### Dead weight already identified

- `layouts/index.html:16-20` calls `sections/experience`, `education`, `achievements`,
  `contact`. All four are `enable: false` in `hugo.yaml` → they render nothing.
- `static/images/me.png` is referenced only by `hugo.yaml` `params.about.image`, under
  `about.enable: false`. Never rendered.
- `2026` of the `2056` static files are FontAwesome (`all-6.4.2.js` alone is 1.5 MB), plus
  Bootstrap source maps — all inherited from the theme's `static/`. The site uses almost none.
- `.vscode/extensions.json` is an empty `recommendations: []`.

---

## 3. The pipeline

```
local git  →  GitHub (loopinlogsbro/EcceMe)  →  Cloudflare Pages  →  ecce.me
   you         master (branch-protected)        auto-build on push    Cloudflare edge
```

### 3.1 Local → GitHub

- Production branch: **`master`** (not `main`).
- `master` is **branch-protected** on GitHub. History is PR-based — 46 PRs, no direct pushes.
- Working tree is currently clean; `master` == `origin/master` == `378108b`.
- Stale merged branches still on GitHub: `claude/ecceme-site-redesign-j8a7fk` (PR #46),
  `cleanup/repo-review` (PR #44). Both fully merged.
- **There are zero GitHub Actions workflows.** No CI, no linting, no build check. A broken
  commit on `master` is caught only by the Cloudflare build failing. This has happened before
  (see §6, PR #44).

### 3.2 The theme submodule — read this before building

```
themes/hugo-profile  →  https://github.com/loopinlogsbro/hugo-profile.git  @ 379a89b
```

- It is a **fork of `gurusabarish/hugo-profile`** (MIT, `min_version = 0.68.0`).
- The pinned commit's message is literally **`"Checkpoint before Claude changes"`**, meaning
  theme customizations were committed into that fork and are **not recorded in this repo**.
- The theme supplies `baseof`, the `header`/`footer`/`projects`/`about` section partials, and
  all of Bootstrap + FontAwesome. **Without it there is no site.**

**Risks, stated plainly:**
- If that fork is deleted, renamed or force-pushed, **every build everywhere breaks**.
- There is no diff anywhere showing fork-vs-upstream, so you cannot tell what was customized
  without manually comparing against `gurusabarish/hugo-profile`.
- `git clone` alone is not enough. Any CI, container or agent environment must run
  `git submodule update --init --recursive`.

**Decision the project owner still owes you** (do not resolve this unilaterally):
- **Option A — vendor the theme.** Copy it into the repo, drop the submodule. Build becomes
  self-contained; you lose easy upstream merges. Best if the fork is already heavily modified.
- **Option B — keep the fork, document the delta.** Add a `THEME.md` recording what differs
  from upstream and why. Lower churn; keeps the external dependency.
- **Option C — drop to only overriding partials.** Point the submodule at upstream unmodified
  and move all customization into this repo's `layouts/`. Cleanest long-term, most work now.

### 3.3 GitHub → Cloudflare Pages

**Verified from the Cloudflare dashboard on 2026-11-24.** Pages project name: `ecce`.
Account: "Logans Cloudflare" (account ID is in the dashboard URL — intentionally not recorded
in this file, since this file may end up in a public repo).

| Setting | Value |
|---|---|
| Git repository | `loopinlogsbro/EcceMe` |
| Production branch | `master` |
| Automatic deployments | **Enabled** |
| Build command | **`hugo`** (no flags — not `--minify`, not `--gc`) |
| Build output directory | `public` |
| Root directory | *(empty — repo root)* |
| Build watch paths | `*` (every path triggers a build) |
| Build system version | **v3** |
| Build cache | **Disabled** (beta feature, off) |
| Build comments | Enabled |
| Deploy hooks | None |
| **Environment variables / secrets** | **NONE — the list is empty** |
| Compatibility date | `2026-05-07` |
| Placement | Default |
| Domains | `ecce.me`, `ecce.pages.dev` |
| Total deployments to date | 176 |

**Current production deployment:** `master` @ `378108b` → `https://039154c2.ecce.pages.dev`,
aliased to `ecce.me`.

> **Critical: Hugo version is NOT pinned.**
> Because no environment variables are set, Cloudflare builds with the **default Hugo for
> build system v3**, currently **0.147.7** (confirmed by the live
> `<meta name="generator" content="Hugo 0.147.7">`). Nothing in the repo or dashboard requests
> that version. If Cloudflare changes its default, your build changes with it, with no commit
> and no warning. **Recommendation: set `HUGO_VERSION` explicitly** (see §7, item 1).
> This matters here specifically: PR #45 notes the About page's routing depends on behavior
> that "only exists on Hugo >= 0.146", which is why `type: about` was added to
> `content/about.md` as a version-independent guard. Version sensitivity is real in this repo.

**Build cache is disabled**, so every deploy is a cold ~13 MB build. Fine at this size; worth
enabling if build minutes ever matter.

**Deploy verification method** (how the above was proven, reproducible by you):
a plain `hugo` build of `master` was diffed byte-for-byte against the live HTML.
`/about/` differed by **0 lines**; `/` differed by **one line** — the generator version string.
A `hugo --minify` build diverged by 1057 lines, which is what ruled out `--minify`.

### 3.4 Cloudflare edge behavior not visible in the repo

Two things the site does that **no file in this repo explains**:

1. **Zero Trust Access on `/private/*`.** `/private/`, `/private/courses/`, `/private/c952/`
   and `/private/StopCalc/` all return `302` to
   `https://ecceme.cloudflareaccess.com/cdn-cgi/access/login/ecce.me`.
   PR #45 deleted all of that content in July. **The Access application was never removed**, so
   it now gates paths with nothing behind them. Dashboard-only fix:
   *Zero Trust → Access → Applications*.

2. **Cloudflare Managed robots.txt is enabled.** The served `/robots.txt` is ~100 lines of
   Cloudflare-injected AI-crawler blocking (`Content-Signal: search=yes,ai-train=no,use=reference`,
   plus `Disallow: /` for GPTBot, ClaudeBot, CCBot, Bytespider, Google-Extended, etc.)
   **prepended** to this repo's 4-line `static/robots.txt`. Net effect: the file contains two
   `User-agent: *` groups — Cloudflare's `Allow: /` and the repo's `Disallow:` (which means
   allow-all). Harmless, but the repo's file is now nearly redundant.

3. **Preview deployments are public.** The Pages settings page offers "Restrict previews" and it
   is **not enabled**. Every branch push produces a permanent, public
   `https://<hash>.ecce.pages.dev` URL. Preview hosts are **not** covered by the Access app on
   `ecce.me/private/*`, because that app is scoped to the `ecce.me` hostname.
   **See §9 — this is an unverified open item worth checking first.**

---

## 4. Local development (Windows 11 / PowerShell)

### First-time setup

```powershell
git clone https://github.com/loopinlogsbro/EcceMe.git
```

```powershell
cd EcceMe
```

```powershell
git submodule update --init --recursive
```

```powershell
winget install Hugo.Hugo.Extended
```

> Extended Hugo is not strictly required — the theme ships no SCSS and the build has no
> image processing — but it is the safer default and matches nothing in the repo that forbids it.

### Daily loop

```powershell
hugo server -D
```

Then open http://localhost:1313.

### Reproduce exactly what Cloudflare builds

```powershell
hugo --destination .\public-check
```

No flags. Adding `--minify` will **not** match production.

> `public/` is correctly in `.gitignore` and must stay there. Cloudflare runs `hugo` itself;
> committing build output would be redundant and would eventually conflict.

### Health check before any commit

```powershell
git branch --show-current
```

```powershell
git status --short
```

```powershell
git submodule status
```

A leading `-` in `git submodule status` means the submodule is **not initialized** — fix that
before trusting any local build.

---

## 5. Publishing

There is no manual deploy step and no deploy hook.

1. Branch off `master`.
2. Commit source files only (`content/`, `layouts/`, `static/`, `assets/`, `data/`,
   `archetypes/`, `hugo.yaml`). Never `public/`.
3. Push and open a PR — `master` is protected, so this is not optional.
4. Cloudflare builds the **preview** automatically and comments the preview URL on the PR
   (build comments are enabled).
5. Merge to `master` → Cloudflare builds and promotes to `ecce.me` automatically.

Rollback: *Cloudflare dashboard → Workers & Pages → ecce → Deployments → pick an earlier
production deployment → Rollback*. Note that deployments older than a few months show
"No deployment available" — Cloudflare has expired those artifacts, so **old rollback targets
are not guaranteed**. Prefer a git revert + fresh deploy.

---

## 6. History: how the site got to this state

### Timeline

| When | What |
|---|---|
| **2026-05-07** | First work log, *"Site Cleanup and Direction"* — begins converting the hugo-profile demo into a real builder site. |
| **May 2026** | PRs #31–#38: footer rebuilt (Latin triad tagline, "owl" button), `StopCalc` (Amazon stops-per-hour calculator), and **C952 Quest** — a 5-world LEGv8 computer-architecture learning game (~4500 lines under `static/private/`). |
| **June 2026** | PRs #39–#43: `/private/` root menu, a current-term Course List page with C952 migrated into it, footer owl pointed at `/private/courses/`, activity-log moved below projects, mobile carousel card heights. |
| **May–Jul 2026** | A GitHub Actions workflow (`.github/workflows/refresh-events.yml`) commits **daily** to `master`: `chore: refresh github events fallback data`. This is the bulk of the commit history. |
| **2026-07-04** | **PR #44 — repo cleanup.** Fixed broken YAML front matter in `content/about.md` (mangled delimiters + smart quotes from a web edit) **that was making the site fail to build**. Removed 4 dead partials and a stale 127 KB `events.json`. Hardened the events workflow. |
| **2026-07-04/05** | **PR #45 — the big strip.** The decisive commit. |
| **2026-07-05** | **PR #46 — the hero.** Handwritten "Logan" write-on SVG animation; placeholder cards renamed to `Porky` and `De-clouding a Zigbee Gateway`. |
| **2026-07-05 → 2026-11-24** | **Nothing.** No commits, no deploys, ~4.5 months. |

### What PR #45 actually removed

This is why the site looks half-finished, and it was all deliberate:

- The **GitHub activity-log terminal widget**: its partial, `terminal-animate.js`, the terminal
  CSS, the `github-events.json` fallback data — **and `refresh-events.yml` itself.**
- The footer **owl button**.
- The **entire `static/private/` tree**: C952 Quest (5 worlds, engine, LEGv8 emulator, UI,
  storage), the `ch10`/`ch11` study guides, `StopCalc` — plus the tracked
  `public/private/c952/index.html` and its `.gitignore` exception.
- `content/gallery.md` (hotlinked stock photos, byte-identical to the theme's exampleSite), the
  empty `blogs` section, 7 unused demo images.
- Replaced the `Coursework Tracker` and `Automation and Physical Systems` cards with dashed
  "Coming soon" placeholders.
- Rewrote the About page.

### Why activity stopped — the actual answer

**The repo did not stall. The thing generating the activity was removed, on purpose.**

The commit message for PR #45 says it outright: removing the activity-log widget
*"also stops the daily bot commits to master"*. Those daily `chore: refresh github events
fallback data` commits were the only thing committing regularly. Delete the workflow, and the
commit graph goes flat — which is exactly what the graph shows.

So the site was intentionally stripped back to a clean skeleton, given a nice hero, and then
left for the next push of work. That next push never came. **That is the whole story — there is
no outage, no broken build, no abandoned migration to untangle.**

One consequence worth noting: the C952 coursework and the two small apps were **deleted, not
archived**. They exist only in git history (`git show 7e3cbb1^:static/private/...`) and in old
Cloudflare preview deployments. If any of that is worth keeping, recover it from history
deliberately rather than rebuilding it.

---

## 7. Backlog for the incoming agent

Nothing here is an emergency. The site builds and serves correctly. Ordered by value.

### Should fix

1. **Pin the Hugo version.** Add `HUGO_VERSION` to Cloudflare Pages (*Settings → Variables and
   secrets → production*) matching whatever you test locally. Today's effective version is
   `0.147.7` by Cloudflare default. Pinning removes the silent-drift risk described in §3.3.
   *Tradeoff:* you now own upgrades explicitly. That is the point.
2. **Resolve the theme submodule question** (§3.2, options A/B/C). Needs an owner decision.
3. **Fix `/logs/`.** `content/logs/_index.md:6-8` sets `build: {render: never, list: never}`, so
   `/logs/` 404s — but `/logs/2026-05-07-site-cleanup/` is live **and listed in the sitemap**.
   Either publish the section index or hide the post too. Right now crawlers are pointed at a
   page whose parent 404s.
4. **Decide about `/courses/`.** It is live, real, and in the sitemap, but **nothing links to
   it** — the nav has only About and `#projects`, and the "Writing" menu entry is commented out
   at `hugo.yaml:41-44`. Either add a nav entry or unpublish it.
5. **Remove the stale Zero Trust Access app on `/private/*`** (§3.4). Dashboard-only.
6. **Untrack `.hugo_build.lock`** and add it to `.gitignore`. It is Hugo-generated.
7. **Add a minimal CI check.** There is no build verification anywhere except Cloudflare. A
   single workflow running `hugo --gc` (with `submodules: recursive` in the checkout step) would
   have caught the PR #44 build break before merge.

### Optional cleanup

8. Remove the 4 dead partial calls in `layouts/index.html:16-20`.
9. Delete `static/images/me.png` (never rendered) — or wire it into `content/about.md`
   front matter as `image:`, which the custom About layout already supports.
10. Trim the FontAwesome payload: 2026 of 2056 static files, `all-6.4.2.js` is 1.5 MB. Replace
    with inline SVG or a subset build.
11. `layouts/partials/sections/projects.html:50` renders `target="_blank"` on the **internal**
    `/projects/ecce-me/` link.
12. `content/projects/ecce-me.md` has an empty `github:` key and an empty `## Next steps`
    heading.
13. Delete the two merged branches — but verify first:
    ```powershell
    git branch -r --merged origin/master
    ```
14. `.vscode/extensions.json` is an empty `recommendations: []`.
15. Consider dropping `static/robots.txt`, now largely redundant against Cloudflare's managed
    robots.txt (§3.4), or keep it and accept the duplicate `User-agent: *` group.

---

## 8. Switching from Claude Code to ChatGPT Codex

> Codex's product surface moves quickly. The repo-specific facts below are verified; the
> Codex-side UI details are current as of this writing and worth re-checking against
> OpenAI's docs if a menu name does not match.

### 8.1 What changes, concretely

| | Claude Code | ChatGPT Codex |
|---|---|---|
| Instruction file | `CLAUDE.md` (none exists here) | **`AGENTS.md`** at repo root |
| Local agent config | `.claude/` *(gitignored)* | `~/.codex/` |
| Where it runs | CLI / cloud session | Codex cloud, Codex CLI, IDE extension |
| Repo access | GitHub App | GitHub connection via ChatGPT |
| Output | branch + PR | branch + PR |

The underlying workflow is unchanged: **branch → PR → Cloudflare auto-deploys.** You are
swapping the agent, not the pipeline. Nothing in Cloudflare needs to change.

### 8.2 Step 1 — unblock `AGENTS.md` (do this first)

`.gitignore` line 1 is currently:

```
AGENTS.md
```

A previous Claude Code setup kept a local-only `AGENTS.md`. **Codex cloud reads `AGENTS.md`
from the committed repo** — while that ignore line stands, Codex will never see its
instructions, and a file you create will silently not commit.

Remove that line from `.gitignore`, then commit the `AGENTS.md` in §8.5.

Also consider dropping `ecce-site-change-plan.md` and `claude/worktrees/` from `.gitignore`
once Claude Code is out of the picture. Leave `.claude/` ignored — harmless.

### 8.3 Step 2 — connect the repo

1. In ChatGPT, open Codex and connect the GitHub account that owns `loopinlogsbro/EcceMe`.
2. Grant access to that repo (and to **`loopinlogsbro/hugo-profile`** — the submodule lives
   there; without access, cloud builds cannot fetch the theme).
3. Set the base branch to **`master`**, not `main`.
4. Note that `master` is branch-protected: Codex must open PRs, and cannot push to `master`.

### 8.4 Step 3 — the environment setup script

This is the step most likely to go wrong, for two reasons: **Hugo is not preinstalled**, and
**the theme is a submodule**. In the Codex environment's setup script:

```bash
#!/usr/bin/env bash
set -euo pipefail

# The theme is a git submodule (a personal fork). Without this there is no site.
git submodule update --init --recursive

# Install Hugo extended. Pin this to the same version as HUGO_VERSION in Cloudflare Pages.
HUGO_VER=0.147.7
curl -sSL -o /tmp/hugo.tar.gz \
  "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VER}/hugo_extended_${HUGO_VER}_linux-amd64.tar.gz"
tar -xzf /tmp/hugo.tar.gz -C /usr/local/bin hugo

hugo version
hugo --gc --destination /tmp/build-check
```

Notes:
- Keep `HUGO_VER` here, the `HUGO_VERSION` you set in Cloudflare (§7 item 1), and your local
  install **in sync**. Three places, one version — that is the price of not vendoring.
- Codex cloud environments typically restrict network access **after** setup completes. Both
  the submodule fetch and the Hugo download must happen **in the setup script**, not mid-task.
- If submodule fetch fails for auth reasons, that is the §3.2 risk biting. Vendoring the theme
  (Option A) makes this whole script collapse to just the Hugo install.

### 8.5 Step 4 — commit an `AGENTS.md`

Save this as `AGENTS.md` in the repo root:

```markdown
# ecce.me — agent instructions

Hugo static site. Deploys automatically: push to `master` → Cloudflare Pages → https://ecce.me

## Before you build
Run `git submodule update --init --recursive`. The theme (`themes/hugo-profile`) is a git
submodule pointing at a personal fork. Without it, nothing builds.

## Build
Reproduce production exactly with no flags:

    hugo

Cloudflare's build command is bare `hugo`, output `public`. Do NOT add `--minify` — production
output is unminified, and adding it creates a large spurious diff against the live site.

## Conventions
- Production branch is `master` (not `main`), and it is branch-protected. Always branch, then
  open a PR. Never push to `master`.
- Commit source only: `content/`, `layouts/`, `static/`, `assets/`, `data/`, `archetypes/`,
  `hugo.yaml`. Never commit `public/` — it is generated and gitignored.
- Prefer small, reversible changes. Do not restructure the repo without being asked.
- Put content in `content/` or `data/`. Much existing copy lives in `hugo.yaml` under `params:`
  because of how the upstream theme works; do not add more of it there.
- Theme overrides go in this repo's `layouts/`, never by editing `themes/hugo-profile/`
  (that is a submodule — edits there are invisible to this repo).

## Verify
    hugo --gc --destination ./public-check

Check the routes that are intentionally unusual: `/logs/` returns 404 by design
(`content/logs/_index.md` sets `build.render: never`), and `/private/*` is handled by a
Cloudflare Zero Trust rule that is not represented in this repo.

## Out of scope for the agent
Cloudflare dashboard settings (build config, environment variables, Zero Trust Access rules,
managed robots.txt) are not in this repo and cannot be changed from here. Flag them for a human
instead of trying to work around them in code.

See CODEX-HANDOFF.md for full context and the open backlog.
```

### 8.6 Step 5 — retire the Claude Code setup

- Delete the local `AGENTS.md` that was gitignored, if one exists, so it cannot shadow the
  committed one.
- Nothing in `.github/` to remove — there are no workflows.
- Leave the `claude/*` branch names already merged into `master`; renaming history is not worth
  it. New Codex branches will simply use a different prefix.
- **Nothing in Cloudflare needs to change.** It watches `master`, not an agent.

### 8.7 First tasks to hand Codex

Good scoped starters, in order — each is small and independently verifiable:

1. Untrack `.hugo_build.lock`, add it to `.gitignore`, remove the dead partial calls in
   `layouts/index.html:16-20`. *(Pure cleanup, zero visual change.)*
2. Add a GitHub Actions workflow running `hugo --gc` on PRs, with `submodules: recursive` in the
   checkout step. *(Builds the safety net that PR #44 proved was missing.)*
3. Fix the `/logs/` + `/courses/` navigation decisions (§7 items 3–4). *(Needs a product call —
   ask first.)*
4. Write the next real project writeup, replacing one "Coming soon" placeholder in `hugo.yaml`.
   *(The actual point of the site.)*

Do **not** start with the theme submodule question (§3.2) or the FontAwesome trim. Both are
larger than they look, and the first needs an owner decision.

---

## 9. Open items — not verified

Honest gaps in this document, so you do not mistake them for settled:

1. **Do old public preview deployments still serve the deleted `static/private/` coursework?**
   Preview deployments are public and permanent (§3.4 item 3), and they predate PR #45's
   deletion. The Access app is scoped to `ecce.me`, so it does **not** cover
   `<hash>.ecce.pages.dev`. Known preview URLs from the dashboard: `c9708a57`, `7217a368`,
   `30b54b03`, `3e6342a5` (all `.ecce.pages.dev`).
   **Check this first:** fetch e.g. `https://c9708a57.ecce.pages.dev/private/c952/ch10.html`.
   If it returns content, that material is publicly reachable despite having been "removed", and
   the fix is to enable "Restrict previews" in Pages settings and/or delete those deployments.
   *This was not verified — the check was not run.*
2. **The exact Zero Trust Access policy** (which rules, which identity provider, what it allows)
   was not read — only its existence and redirect target, observed from the outside.
3. **The fork-vs-upstream theme diff** was not computed. The fork was not accessible in the
   session that produced this document.
4. **Deployments 16–176** were not reviewed; only page 1 of 12 of the deployment list was
   available.

---

## 10. Quick reference

```
Repo            loopinlogsbro/EcceMe        (production branch: master, protected)
Theme submodule loopinlogsbro/hugo-profile  @ 379a89b  (fork of gurusabarish/hugo-profile)
Live            https://ecce.me  +  https://ecce.pages.dev
CF Pages project  ecce            (account "Logans Cloudflare")
Build command   hugo              (no flags)   Output: public
Hugo version    0.147.7 — UNPINNED, Cloudflare build-system-v3 default
Zero Trust team ecceme.cloudflareaccess.com  (app still gating /private/*)
Last real commit 378108b  "Hero: handwritten Caveat write-on animation..."  2026-07-05
CI              none
```
