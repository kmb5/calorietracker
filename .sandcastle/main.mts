// Parallel Planner with Review — four-phase orchestration loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If it produces commits, a
//                               reviewer runs in the same sandbox on the same
//                               branch (1 iteration). All issue pipelines run
//                               concurrently via Promise.allSettled().
//   Phase 3 (Merge):            A single agent merges all completed branches
//                               into the current branch.
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round of merges.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { nerdctl } from "./nerdctl-provider.js";

// Each parallel container registers 3 process listeners (exit, SIGINT, SIGTERM).
// Raise the limit to avoid MaxListenersExceededWarning with large parallel runs.
process.setMaxListeners(100);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SANDBOX = nerdctl({
  imageName: "sandcastle:calorietracker_v3",
  containerUid: 501,
  containerGid: 1000,
  env: {
    NODE_OPTIONS: "--max-old-space-size=4096",
  },
  mounts: [
    { hostPath: "~/.aws", sandboxPath: "/home/agent/.aws", readonly: true },
    { hostPath: "~/Library/pnpm/store", sandboxPath: "/pnpm-store", readonly: true },
  ],
});

const AGENT = sandcastle.pi("eu.anthropic.claude-sonnet-4-6");
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: "cd frontend && pnpm install --store-dir /pnpm-store" },
      { command: "cd api && uv sync --frozen" },
    ],
  },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree: string[] = []; // no node_modules to copy — pnpm install runs in the sandbox

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — we parse that to drive Phase 2.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    sandbox: SANDBOX,
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code.
    maxIterations: 1,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: AGENT,
    promptFile: "./.sandcastle/plan-prompt.md",
  });

  // Extract the <plan>…</plan> block from the agent's stdout.
  const planMatch = plan.stdout.match(/<plan>([\s\S]*?)<\/plan>/);
  if (!planMatch) {
    throw new Error(
      "Planning agent did not produce a <plan> tag.\n\n" + plan.stdout,
    );
  }

  // The plan JSON contains an array of issues, each with id, title, branch.
  const { issues } = JSON.parse(planMatch[1]!) as {
    issues: { id: string; title: string; branch: string }[];
  };

  if (issues.length === 0) {
    // No unblocked work — either everything is done or everything is blocked.
    console.log("No unblocked issues to work on. Exiting.");
    break;
  }

  console.log(
    `Planning complete. ${issues.length} issue(s) to work in parallel:`,
  );
  for (const issue of issues) {
    console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
  }

  // -------------------------------------------------------------------------
  // Phase 2: Implement → Create PR → Review PR
  //
  // For each issue, one sandbox handles the full pipeline:
  //   1. Implementer writes code and commits
  //   2. If commits exist: open a GitHub PR from the branch
  //   3. PR reviewer reads the diff and posts inline + summary comments
  //
  // End state: open PRs ready for manual approval or further iteration.
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: SANDBOX,
        hooks: {
          ...hooks,
          host: {
            onSandboxReady: [{ command: `gh issue edit ${issue.id} --add-label sc:in-progress --remove-label sc:ready --repo kmb5/calorietracker` }],
          },
        },
        timeouts: { copyToWorktreeMs: 300_000 },
        copyToWorktree,
      });

      try {
        // Step 1: Implement
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: AGENT,
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        if (implement.commits.length === 0) {
          return implement;
        }

        // Step 2: Open a GitHub PR
        await sandbox.run({
          name: "pr-creator",
          maxIterations: 1,
          agent: AGENT,
          prompt:
            `Create a GitHub PR for branch ${issue.branch} into main using gh pr create. ` +
            `Title: "${issue.title}". ` +
            `Body should summarise what was implemented and include "Closes #${issue.id}". ` +
            `Then update issue #${issue.id} labels: remove sc:ready and sc:in-progress, add sc:in-review, using gh issue edit. ` +
            `Output <promise>COMPLETE</promise> when done.`,
        });

        // Step 3: Review the PR — posts inline comments + summary table
        const review = await sandbox.run({
          name: "pr-reviewer",
          maxIterations: 1,
          agent: AGENT,
          promptFile: "./.sandcastle/pr-review-prompt.md",
          promptArgs: { BRANCH: issue.branch },
        });

        return {
          ...review,
          commits: [...implement.commits, ...review.commits],
        };
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any pipelines that threw
  for (const [i, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      console.error(
        `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
      );
    }
  }

  const completedBranches = settled
    .map((outcome, i) => ({ outcome, issue: issues[i]! }))
    .filter(
      (entry) =>
        entry.outcome.status === "fulfilled" &&
        entry.outcome.value.commits.length > 0,
    )
    .map((entry) => entry.issue.branch);

  console.log(`\nDone. ${completedBranches.length} PR(s) open for review:`);
  for (const branch of completedBranches) {
    console.log(`  ${branch}`);
  }

  // No merge phase — PRs are left open for manual approval.
  break;
}

console.log("\nAll done.");
