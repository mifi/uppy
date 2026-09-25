---
name: worklog
description: Summarize my work as a log — one line per day, listing what I did that day, from git commits on all branches plus my GitHub activity (PRs, reviews, issues, comments). Use when the user asks for a work log, timesheet, daily summary of work, standup/changelog digest, or "what did I do" over a date range.
---

# Worklog

Build a day-by-day log of what **the user** did: commits on every branch, plus
GitHub activity (PRs opened/merged, reviews, issues, comments). One line per
day, task groups separated by semicolons, most important first. The goal is a complete
picture so nothing has to be written down by hand.

## Arguments

Free-form. Anything the user does not specify, infer or default:

- **Range** — e.g. `since aug 1`, `last 2 weeks`, `2026-08-01..2026-09-01`.
  Default: the current month so far; if today is within the first 7 days of
  the month, the previous month instead.
- **Repo** — the current project's GitHub repository (from the `origin`
  remote), plus its upstream if it is a fork (the repo's `parent` in the
  GitHub API), since PRs usually target the upstream. Activity in other
  repos is left out unless asked for. If the project has no GitHub remote,
  use git history only.
- **Timezone** — use it if the user states one; otherwise see step 1.

## Who is "me"

- GitHub: the authenticated user's login, name and email.
- Git: that name/email, the login's noreply email
  (`<id>+<login>@users.noreply.github.com`), `git config user.name`/`email`
  unless it is an AI identity (cloud sessions often set it to `Claude`), and
  any other author names/emails that clearly belong to the same person.
- AI-authored commits (author `Claude` or similar) count when the user is
  the committer or a `Co-Authored-By` trailer names the user. Older ones
  without either count when they are on a branch whose PR the user opened.
- Commits authored by other people never count, even when a trailer names
  the user as co-author (typical of squash merges of PRs the user helped on).

## Method

### 1. Timezone

Unless given, take the most common UTC offset of the user's own (non-AI)
commits in the range (`git log --author=<me> --format=%ai`) and use
`TZ=Etc/GMT<inverted sign><hours>` (e.g. `+0200` → `Etc/GMT-2`). Converting
everything to one zone keeps AI/CI commits made in UTC on the right day.

### 2. Git commits, all branches

```
git fetch --all --prune --shallow-since=<start>   # plain fetch if not shallow
TZ=<tz> git log --branches --remotes --no-merges \
  --since='<start> 05:00' --until='<day after end> 05:00' \
  --date=format-local:'%Y-%m-%d %H:%M' \
  --pretty=format:'%H|%ad|%an|%cn|%(trailers:key=Co-Authored-By,valueonly,separator=;)|%D|%s'
```

Always give `--since`/`--until` a time: with a bare date git uses the
current time of day and silently drops earlier commits. Then keep only the
user's commits, per "Who is me" (`--author` alone can't express the
committer/trailer rule for AI commits).

- The same change often appears several times (rebased, cherry-picked, and
  squash-merged to the default branch). Count it once: dedupe by subject, and
  when a branch's commits landed as a squash-merged PR, report the PR instead
  of its individual commits.
- Unmerged branches still count — they are work done.

### 3. GitHub activity

Use whatever GitHub access is available (`gh` CLI, GitHub MCP tools, or the
REST API), limited to the repo(s) above.

- **Events feed** (best, if reachable): `gh api users/<login>/events
  --paginate`, filtered to the repo(s), lists PRs, reviews, comments and
  issues with exact timestamps. It only covers the last 90 days / 300 events.
- **Search** (for older ranges or no events feed), adding
  `repo:<owner>/<name>` to each query (and `-author:<login>` to the review
  and comment queries, so the user's own PRs don't show up as reviews):
  - `author:<login> created:<start>..<end>` — PRs and issues opened
  - `author:<login> is:pr merged:<start>..<end>` — PRs merged
  - `reviewed-by:<login> updated:>=<start>` — PRs reviewed
  - `commenter:<login> updated:>=<start>` — issues/PRs commented on

  Search only says an item was touched in the range, and `reviewed-by:` /
  `commenter:` match the user's activity at *any* time. For those hits, fetch
  the item's reviews/comments and keep only the user's, dated inside the
  range. That needs API access to the repo; in a cloud session the upstream
  of a fork usually has to be attached to the session first.

  If the dates can't be fetched:
  1. Drop items the log already covers (a PR whose follow-ups the user
     committed or opened a PR for, a PR the user's work builds on or
     supersedes).
  2. Keep items opened inside the range: the user's activity on them must be
     in range too. If one was opened and closed the same day, put it on that
     day.
  3. Drop items opened before the range: the activity may be older.
  Items left after step 2 go in the "date unknown" list (see Output format).

Convert every timestamp to the chosen timezone. Drop activity that duplicates
a commit already listed (e.g. opening the PR for a branch already covered is
not a separate item; merging it is not either). A PR on the fork that mirrors
one on the upstream (same title) is one item.

### 4. Group into work days

Work days run **05:00–05:00 local**, not calendar days, so a session past
midnight stays on the day it started. Mention this only if the log actually
has past-midnight work (in the footer).

### 5. Write each day's task groups

- Drop noise subjects (`fix`, `wip`, `cleanup`, `simplify`, `update comment`,
  `refac`) or fold them into the group they belong to.
- Group the day's work into **task groups**: one per PR, feature or theme,
  written `<name>: <details>` with the details comma-separated. A small
  standalone item is just its name. Collapse a run of commits on one theme
  into the details, using the repo's own vocabulary (e.g. several kysely
  conversions → "finish the knex→kysely conversion in the scripts").
- Keep real features, bug fixes and behavior changes distinct (their own
  groups or details).
- Prefer the commit's/PR's own wording over invented phrasing.
- GitHub-only items get short verbs: "review #6601: s3 multipart retries",
  "open issue #6610 about …", "discuss #6590". Several comments on one thread
  are one group. Use `owner/repo#n` only if both fork and upstream appear.
- **Order by size and impact**, not time: large features and important fixes
  first, then smaller fixes, then refactors/chores/deps, then reviews and
  discussion.

### 6. Estimate hours

Hours are a rough guide; the items matter more. For each day, guess the time
spent from both:

- the timestamp spread of the day's commits and GitHub activity (gaps over
  ~90 minutes are breaks), and
- how much work the items look like — a large feature commit reflects more
  time before it than a typo fix; reviews and discussion take time too.

Round up to the nearest 30 minutes, minimum 30 minutes.

## Output format

Each day line is a semicolon-separated CSV row: `<d>.<mon>; <hours>;
<group>; <group>; …`. Commas appear only inside a group's details, never
semicolons.

Hours are a span starting at 08:00: ~2.5h → `08:00-10:30`. If the estimate
is over 16h, write the duration instead (`~17h`).

```
Work log for <repo>, <range> (TZ <tz>)

5.aug; 08:00-10:30; improve orpc error logging; don't rate limit health checks; update readme
24.aug; 08:00-15:00; downloader CLI rework (#410): fold downloader CLIs into one command, parse CLI args with node:util parseArgs and zod; replace tsx; review #412: upload retries

total ~9.5h
No activity: 6.aug–23.aug
Hours are estimates from commit/activity timestamps and item size.

Date unknown:
https://github.com/acme/app/pull/415 add retry backoff
https://github.com/acme/app/issues/420#issuecomment-123456789 flaky upload test
```

- Day label is `<d>.<mon>` lowercase. Lines can be as long as needed.
- Skip days with no activity.
- The header line and the footer (total, no-activity days, the hours note,
  the 05:00 note if it applies, the date-unknown list) are the only text
  outside the day lines.
- **Date-unknown list**: last, under `Date unknown:`, one item per line as
  `<full URL> <short title>`. Link straight to the user's own review or
  comment (`…/pull/<n>#pullrequestreview-<id>`, `…#issuecomment-<id>`) when
  its id is known, otherwise to the PR/issue itself, so the user can look up
  the date.
