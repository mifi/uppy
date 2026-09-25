---
name: worklog
description: Summarize git history as a work log — one line per day, listing what was done that day. Use when the user asks for a commit-log overview, a daily summary of work, a standup/changelog digest, or "what did I do" over a date range or branch.
---

# Worklog

Turn a git commit log into a human-readable day-by-day summary of what was
worked on. One line per day, items comma-separated.

## Arguments

Free-form. Anything the user does not specify, infer or default:

- **Range** — e.g. `since aug 1`, `last 2 weeks`, `2026-08-01..2026-09-01`.
  Default: all days in the current month.
- **Branch / ref** — e.g. `origin/some-branch`, `--all`. Default: the current
  branch (`HEAD`). If the user names a remote branch that isn't local, fetch it
  first: `git fetch origin <branch>`.
- **Author** — default: all authors. Note that AI-assisted commits may be
  authored by `Claude` or similar; include them unless told otherwise.

## Method

1. Fetch the ref if needed, then pull the log with timestamps:

   ```
   TZ=<local tz> git log <ref> --since=<start> --until=<end> --no-merges \
     --date=format-local:'%Y-%m-%d %H:%M' --pretty=format:'%ad|%an|%s'
   ```

   Use `format-local` with an explicit `TZ` so commits made in different
   timezones (or by CI/agents committing in UTC) land on the right day.
   Determine the local timezone from the dominant committer offset in the log
   rather than assuming UTC.

2. Group into **work days running 05:00–05:00 local**, not calendar days, so a
   session that runs past midnight stays on the day it started. Mention this
   convention only if the log actually has past-midnight work.

3. For each day, condense the subjects into a readable sentence of
   comma-separated items:
   - Merge commits, and pure noise subjects (`fix`, `wip`, `cleanup`, `simplify`,
     `update comment`, `refac`) are dropped or folded into the neighboring item
     they belong to.
   - Collapse a run of commits on one theme into a single item that says what
     changed, using the repo's own vocabulary (e.g. several kysely conversions →
     "finish the knex→kysely conversion in the scripts").
   - Keep real feature work, bug fixes, and behavior changes distinct — do not
     merge those away.
   - Keep the day's own ordering (earliest first).
   - Prefer the commit's own wording over invented phrasing.

4. Estimate each day's hours from the commit timestamps: cluster the day's
   commits into sessions (a gap over 90 minutes starts a new session), sum the
   first-to-last-commit span of each session, with a 30-minute floor per
   session. Round to one decimal. This undercounts — it cannot see thinking,
   reviewing, or testing outside the commit spans — so note once, after the
   list, that the estimates are lower bounds of active branch work.

5. Skip days with no commits. After the list, state which days in the range had
   no activity.

## Output format

For each day's total hours, assume the day starts at 10:00, so if the total hours is ~2.5, then the working hours will become 10:00-12:30. Also round hours (up) to the nearest 30 minutes.

```
5.aug 10:00-12:30 update readme, don't rate limit health checks, improve orpc error logging
24.aug 10:00-17:00 replace tsx, parse CLI args with node:util parseArgs and zod, fold downloader CLIs into one command
```

Day label is `<d>.<mon>` lowercase, followed by the day's hours estimate
inline (`hh:mm-hh:mm`), then the items. Lines can be as long as needed. End with a
total (`total ~<h>h`). No per-day commentary, no preamble beyond a one-line
header naming the ref and range.