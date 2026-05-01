import { spawn } from 'node:child_process';

export interface GitCloneOptions {
  url: string;
  destination: string;
  /** Optional branch / tag / sha. Passed to `--branch`. */
  ref?: string;
  /** Override the binary used to invoke git. Mostly for tests. */
  gitBin?: string;
}

export interface GitCloneResult {
  ok: boolean;
  exitCode: number;
  stderr: string;
}

/**
 * Minimal git clone wrapper.
 *
 * Always shallow (`--depth 1`) and quiet. We deliberately do not implement
 * retries, credential helpers, or SSH-key handling -- if `git clone` fails,
 * we surface the exit code and stderr verbatim and let the caller decide
 * how to message the user.
 */
export type GitClone = (options: GitCloneOptions) => Promise<GitCloneResult>;

export const defaultGitClone: GitClone = async (options) => {
  const args = ['clone', '--depth', '1', '--quiet'];
  if (options.ref) args.push('--branch', options.ref);
  args.push('--', options.url, options.destination);

  return await new Promise<GitCloneResult>((resolve) => {
    const child = spawn(options.gitBin ?? 'git', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({ ok: false, exitCode: -1, stderr: String(err.message ?? err) });
    });
    child.on('close', (code) => {
      const exitCode = code ?? -1;
      resolve({ ok: exitCode === 0, exitCode, stderr: stderr.trim() });
    });
  });
};
