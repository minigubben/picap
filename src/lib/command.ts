import { execFile, spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";

export type SpawnedProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  execFile(command: string, args: string[]): Promise<ExecResult>;
  spawn(command: string, args: string[]): SpawnedProcess;
}

export const nodeCommandRunner: CommandRunner = {
  execFile(command, args) {
    return new Promise((resolve, reject) => {
      execFile(command, args, { encoding: "utf8" }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  },
  spawn(command, args) {
    return spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  }
};
