/**
 * nerdctl sandbox provider for Rancher Desktop.
 *
 * Drop-in replacement for docker() when using Rancher Desktop with the
 * containerd runtime. Calls the `nerdctl` binary on PATH (~/.rd/bin/nerdctl).
 *
 * Usage:
 *   import { nerdctl } from "./.sandcastle/nerdctl-provider.js";
 *   await run({ agent: claudeCode("claude-opus-4-7"), sandbox: nerdctl() });
 */

import {
  execFile,
  execFileSync,
  spawn,
  type StdioOptions,
} from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import {
  createBindMountSandboxProvider,
  type SandboxProvider,
  type BindMountCreateOptions,
  type BindMountSandboxHandle,
  type ExecResult,
  type InteractiveExecOptions,
} from "@ai-hero/sandcastle";

export interface NerdctlOptions {
  /** Image name (default: derived from repo directory name). */
  readonly imageName?: string;
  /**
   * The UID of the `agent` user inside the container image.
   * Defaults to the host UID (process.getuid()) or 1000.
   * Must match the UID baked into the image at build time.
   */
  readonly containerUid?: number;
  /**
   * The GID of the `agent` user inside the container image.
   * Defaults to the host GID (process.getgid()) or 1000.
   */
  readonly containerGid?: number;
  /** Environment variables injected by this provider at launch time. */
  readonly env?: Record<string, string>;
  /**
   * Additional host directories to bind-mount into the sandbox.
   * hostPath supports ~ expansion.
   */
  readonly mounts?: ReadonlyArray<{
    hostPath: string;
    sandboxPath: string;
    readonly?: boolean;
  }>;
  /**
   * Network(s) to attach the container to.
   * - "my-network"         → --network my-network
   * - ["net1", "net2"]     → --network net1 --network net2
   * Defaults to nerdctl's default bridge network.
   */
  readonly network?: string | readonly string[];
}

/** Derive a default image name from the repo directory path (mirrors Sandcastle's convention). */
const defaultImageName = (repoPath: string): string => {
  const parts = repoPath.replace(/\\/g, "/").split("/").filter(Boolean);
  const dirName = parts[parts.length - 1] ?? "sandcastle";
  return `sandcastle:${dirName}`;
};

/**
 * Create a nerdctl sandbox provider (Rancher Desktop / containerd).
 */
export const nerdctl = (options?: NerdctlOptions): SandboxProvider => {
  const configuredImageName = options?.imageName;

  return createBindMountSandboxProvider({
    name: "docker",
    env: options?.env,
    sandboxHomedir: "/home/agent",

    create: async (
      createOptions: BindMountCreateOptions,
    ): Promise<BindMountSandboxHandle> => {
      const containerName = `sandcastle-${randomUUID()}`;

      const worktreePath =
        createOptions.mounts.find(
          (m) => m.hostPath === createOptions.worktreePath,
        )?.sandboxPath ?? "/home/agent/workspace";

      const imageName =
        configuredImageName ?? defaultImageName(createOptions.hostRepoPath);

      const containerUid = options?.containerUid ?? process.getuid?.() ?? 1000;
      const containerGid = options?.containerGid ?? process.getgid?.() ?? 1000;

      // Pre-flight: verify image exists locally
      await checkImageExists(imageName);

      // Build args
      const env = { ...createOptions.env, HOME: "/home/agent" };
      const envArgs = Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`]);

      const expandHome = (p: string) => p.replace(/^~/, homedir());

      const allMounts = [
        ...createOptions.mounts,
        ...(options?.mounts ?? []).map((m) => ({
          ...m,
          hostPath: expandHome(m.hostPath),
        })),
      ];

      const volumeArgs = allMounts.flatMap((m) => [
        "-v",
        m.readonly
          ? `${m.hostPath}:${m.sandboxPath}:ro`
          : `${m.hostPath}:${m.sandboxPath}`,
      ]);

      const networks = options?.network
        ? Array.isArray(options.network)
          ? options.network
          : [options.network]
        : [];
      const networkArgs = networks.flatMap((n) => ["--network", String(n)]);

      // Start container
      await new Promise<void>((resolve, reject) => {
        execFile(
          "docker",
          [
            "run",
            "-d",
            "--name", containerName,
            "--user", `${containerUid}:${containerGid}`,
            "-w", worktreePath,
            ...networkArgs,
            ...envArgs,
            ...volumeArgs,
            "--entrypoint", "sleep",
            imageName,
            "infinity",
          ],
          (error) => {
            if (error) {
              reject(new Error(`docker run failed: ${error.message}`));
            } else {
              resolve();
            }
          },
        );
      });

      // Cleanup on process exit
      const onExit = () => {
        try {
          execFileSync("docker", ["rm", "-f", containerName], { stdio: "ignore" });
        } catch { /* best-effort */ }
      };
      const onSignal = () => { onExit(); process.exit(1); };
      process.on("exit", onExit);
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);

      const handle: BindMountSandboxHandle = {
        worktreePath,

        exec: (
          command: string,
          opts?: { onLine?: (line: string) => void; cwd?: string; sudo?: boolean; stdin?: string },
        ): Promise<ExecResult> => {
          const effectiveCommand = opts?.sudo ? `sudo ${command}` : command;
          const args = ["exec"];
          if (opts?.stdin !== undefined) args.push("-i");
          if (opts?.cwd) args.push("-w", opts.cwd);
          args.push(containerName, "sh", "-c", effectiveCommand);

          return new Promise((resolve, reject) => {
            const proc = spawn("docker", args, {
              stdio: [opts?.stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
            });

            if (opts?.stdin !== undefined) {
              proc.stdin!.write(opts.stdin);
              proc.stdin!.end();
            }

            const stdoutChunks: string[] = [];
            const stderrChunks: string[] = [];

            if (opts?.onLine) {
              const onLine = opts.onLine;
              const rl = createInterface({ input: proc.stdout! });
              rl.on("line", (line) => { stdoutChunks.push(line); onLine(line); });
            } else {
              proc.stdout!.on("data", (chunk: Buffer) => { stdoutChunks.push(chunk.toString()); });
            }

            proc.stderr!.on("data", (chunk: Buffer) => { stderrChunks.push(chunk.toString()); });

            proc.on("error", (error) => {
              reject(new Error(`docker exec failed: ${error.message}`));
            });

            proc.on("close", (code) => {
              resolve({
                stdout: stdoutChunks.join(opts?.onLine ? "\n" : ""),
                stderr: stderrChunks.join(""),
                exitCode: code ?? 0,
              });
            });
          });
        },

        interactiveExec: (
          args: string[],
          opts: InteractiveExecOptions,
        ): Promise<{ exitCode: number }> => {
          return new Promise((resolve, reject) => {
            const dockerArgs = ["exec"];
            if ("isTTY" in opts.stdin && (opts.stdin as { isTTY?: boolean }).isTTY) {
              dockerArgs.push("-it");
            } else {
              dockerArgs.push("-i");
            }
            if (opts.cwd) dockerArgs.push("-w", opts.cwd);
            dockerArgs.push(containerName, ...args);

            const proc = spawn("docker", dockerArgs, {
              stdio: [opts.stdin, opts.stdout, opts.stderr] as StdioOptions,
            });

            proc.on("error", (error: Error) => {
              reject(new Error(`docker exec failed: ${error.message}`));
            });
            proc.on("close", (code: number | null) => {
              resolve({ exitCode: code ?? 0 });
            });
          });
        },

        copyFileIn: (hostPath: string, sandboxPath: string): Promise<void> =>
          new Promise((resolve, reject) => {
            execFile("docker", ["cp", hostPath, `${containerName}:${sandboxPath}`], (error) => {
              if (error) reject(new Error(`docker cp (in) failed: ${error.message}`));
              else resolve();
            });
          }),

        copyFileOut: (sandboxPath: string, hostPath: string): Promise<void> =>
          new Promise((resolve, reject) => {
            execFile("docker", ["cp", `${containerName}:${sandboxPath}`, hostPath], (error) => {
              if (error) reject(new Error(`docker cp (out) failed: ${error.message}`));
              else resolve();
            });
          }),

        close: async (): Promise<void> => {
          process.removeListener("exit", onExit);
          process.removeListener("SIGINT", onSignal);
          process.removeListener("SIGTERM", onSignal);
          await new Promise<void>((resolve, reject) => {
            execFile("docker", ["rm", "-f", containerName], (error) => {
              if (error) reject(new Error(`docker rm failed: ${error.message}`));
              else resolve();
            });
          });
        },
      };

      return handle;
    },
  });
};

const checkImageExists = (imageName: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    execFile("docker", ["image", "inspect", imageName], (error) => {
      if (error) {
        reject(
          new Error(
            `Image '${imageName}' not found. Build it first:\n` +
            `  nerdctl build -t ${imageName} .sandcastle/`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
