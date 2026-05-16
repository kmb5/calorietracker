# PR Review

## Setup

Find the open PR for the current branch:

```
gh pr list --head {{BRANCH}} --json number,title,url --jq '.[0]'
```

Note the PR number — use it for all subsequent commands.

## Review workflow

1. `gh pr view <number>` — read title, description, linked issue
2. `gh pr diff <number>` — scan all changed files
3. Read every changed source file directly — the diff alone misses context
4. Check in this order: **security → reliability → correctness → test coverage**
5. Apply project standards from @.sandcastle/CODING_STANDARDS.md

## Posting comments

Post one comment per issue via the GitHub API:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/reviews \
  --method POST \
  --field event="COMMENT" \
  --field body="<summary table here>" \
  --field 'comments[][path]=path/to/file.py' \
  --field 'comments[][position]=<line number in diff>' \
  --field 'comments[][body]=<issue description>'
```

To find `{owner}/{repo}`:
```bash
gh repo view --json nameWithOwner --jq .nameWithOwner
```

If there are no inline comments (general feedback only), use:
```bash
gh pr review <number> --comment --body "<your comment>"
```

## Comment format

```
**<Category>: <short title>**

1–3 sentences describing the exact problem.

Fix: <concrete suggestion>
```

Categories: `Security` · `Reliability` · `Correctness` · `Testing` · `Config`

## Review rules

- **Only flag issues that block merging** — no praise, no style nits
- Flag: security holes, resource leaks, untested critical paths, logic bugs, misconfiguration
- Skip: cosmetic naming, minor refactors, formatting — unless they mask a real bug
- Always read the full file, not just the diff lines

## Summary comment (post last, as a separate `gh pr review --comment`)

```
| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | 🔴 Security | `file.py` | Short description |
| 2 | 🟠 Reliability | `other.py` | Short description |
| 3 | 🟡 Testing | `tests/` | Short description |
```

If there are no issues: post a single comment — `✅ No blocking issues found.`

Severity key: 🔴 Security / data-loss · 🟠 Reliability / correctness · 🟡 Test coverage / minor

Once complete, output <promise>COMPLETE</promise>.
