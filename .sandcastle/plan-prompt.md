# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --label sc:ready --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Assign each issue a branch name. The `sc:ready` label means they have been explicitly approved for agent work — ignore any other labels like `HITL` or `AFK`.

For each issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "sandcastle/issue-42-fix-auth-bug"}]}
</plan>

Include every issue from the list. If the list is empty, output `<plan>{"issues": []}</plan>`.
