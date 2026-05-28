import fs from "node:fs/promises";
import path from "node:path";

import type { AppConfig } from "../config.js";
import type { CaptureRequest, CaptureStatus, CaptureWithFiles } from "../types/domain.js";
import { buildBpfFilter, durationToSeconds } from "./capture-filters.js";
import type { CommandRunner, SpawnedProcess } from "./command.js";
import { nodeCommandRunner } from "./command.js";
import type { AppDatabase } from "./db.js";
import type { Logger } from "./logger.js";
import { consoleLogger } from "./logger.js";

interface RunningCapture {
  process: SpawnedProcess;
  stderr: string;
  timeout: NodeJS.Timeout;
  quotaTimer: NodeJS.Timeout;
  stopping: boolean;
  desiredStatus: CaptureStatus | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPositiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

async function directorySize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await directorySize(fullPath);
    } else if (entry.isFile()) {
      total += (await fs.stat(fullPath)).size;
    }
  }
  return total;
}

export class CaptureManager {
  private readonly running = new Map<number, RunningCapture>();

  constructor(
    private readonly config: AppConfig,
    private readonly db: AppDatabase,
    private readonly commandRunner: CommandRunner = nodeCommandRunner,
    private readonly logger: Logger = consoleLogger
  ) {}

  async validateBpf(interfaceName: string, filter: string): Promise<void> {
    const args = ["tcpdump", "-i", interfaceName, "-d"];
    if (filter) {
      args.push(...filter.split(" "));
    }
    await this.commandRunner.execFile("sudo", args);
  }

  buildTcpdumpArgs(captureId: number, input: {
    interfaceName: string;
    chunkSeconds: number;
    chunkMb: number;
    bpfFilter: string;
  }): string[] {
    const outputPattern = path.join(
      this.config.captureDir,
      String(captureId),
      "chunk-%Y%m%d-%H%M%S.pcap"
    );
    const args = [
      "tcpdump",
      "-Z",
      this.config.tcpdumpUser,
      "-i",
      input.interfaceName,
      "-nn",
      "-s",
      "0",
      "-G",
      String(input.chunkSeconds),
      "-C",
      String(input.chunkMb),
      "-w",
      outputPattern
    ];

    if (input.bpfFilter) {
      args.push(...input.bpfFilter.split(" "));
    }

    return args;
  }

  async startCapture(request: CaptureRequest): Promise<CaptureWithFiles> {
    const interfaceName = request.interfaceName?.trim() || this.config.captureInterface;
    const bpfFilter = buildBpfFilter(request.filter || {});
    const durationSeconds = durationToSeconds(
      Number(request.durationValue),
      request.durationUnit || "minutes"
    );
    const chunkSeconds = toPositiveInteger(
      request.chunkSeconds,
      this.config.defaultChunkSeconds,
      "Chunk seconds"
    );
    const chunkMb = toPositiveInteger(request.chunkMb, this.config.defaultChunkMb, "Chunk MB");
    const maxJobGb = Number(request.maxJobGb || this.config.maxTotalCaptureGb);
    if (!Number.isFinite(maxJobGb) || maxJobGb <= 0) {
      throw new Error("Capture storage limit must be greater than zero.");
    }
    const maxJobBytes = Math.floor(maxJobGb * 1024 * 1024 * 1024);

    await this.validateBpf(interfaceName, bpfFilter);
    await fs.mkdir(this.config.captureDir, { recursive: true });

    const placeholderDir = path.join(this.config.captureDir, "pending");
    const capture = this.db.createCapture({
      name: request.name?.trim() || `capture-${Date.now()}`,
      status: "pending",
      interfaceName,
      bpfFilter,
      durationSeconds,
      chunkSeconds,
      chunkMb,
      maxJobBytes,
      captureDir: placeholderDir
    });

    const captureDir = path.join(this.config.captureDir, String(capture.id));
    await fs.mkdir(captureDir, { recursive: true });
    this.db.updateCapture(capture.id, { captureDir, status: "running", startedAt: nowIso() });

    const args = this.buildTcpdumpArgs(capture.id, {
      interfaceName,
      chunkSeconds,
      chunkMb,
      bpfFilter
    });
    const child = this.commandRunner.spawn("sudo", args);
    const running: RunningCapture = {
      process: child,
      stderr: "",
      timeout: setTimeout(() => {
        void this.stopCapture(capture.id, "completed");
      }, durationSeconds * 1000),
      quotaTimer: setInterval(() => {
        void this.checkQuota(capture.id, maxJobBytes);
      }, 30_000),
      stopping: false,
      desiredStatus: null
    };

    child.stderr.on("data", (chunk: Buffer) => {
      running.stderr = `${running.stderr}${chunk.toString()}`.slice(-4000);
    });
    child.on("close", (code) => {
      const status = running.desiredStatus || (code === 0 ? "completed" : "failed");
      void this.finishCapture(capture.id, status, code);
    });

    this.running.set(capture.id, running);
    return this.getCapture(capture.id);
  }

  async stopCapture(id: number, status: CaptureStatus = "stopped"): Promise<CaptureWithFiles> {
    const running = this.running.get(id);
    if (!running) {
      const capture = this.db.getCapture(id);
      if (!capture) {
        throw new Error("Capture not found.");
      }
      await this.indexFiles(id);
      return this.getCapture(id);
    }

    running.stopping = true;
    running.desiredStatus = status;
    running.process.kill("SIGTERM");
    setTimeout(() => {
      if (this.running.has(id)) {
        running.process.kill("SIGKILL");
      }
    }, 5000);

    return this.getCapture(id);
  }

  async deleteCapture(id: number): Promise<void> {
    await this.stopCapture(id).catch(() => undefined);
    const capture = this.db.getCapture(id);
    if (capture) {
      await fs.rm(capture.captureDir, { recursive: true, force: true });
    }
    await fs.rm(path.join(this.config.captureDir, String(id)), { recursive: true, force: true });
    this.db.deleteCapture(id);
  }

  async getCapture(id: number): Promise<CaptureWithFiles> {
    const capture = this.db.getCapture(id);
    if (!capture) {
      throw new Error("Capture not found.");
    }
    await this.indexFiles(id);
    return { ...capture, files: this.db.listCaptureFiles(id) };
  }

  async listCaptures(): Promise<CaptureWithFiles[]> {
    const captures = this.db.listCaptures();
    return Promise.all(captures.map((capture) => this.getCapture(capture.id)));
  }

  async totalCaptureBytes(): Promise<number> {
    return directorySize(this.config.captureDir);
  }

  private async checkQuota(id: number, maxBytes: number): Promise<void> {
    const capture = this.db.getCapture(id);
    if (!capture) {
      return;
    }
    const size = await directorySize(path.join(this.config.captureDir, String(id)));
    if (size > maxBytes) {
      this.db.updateCapture(id, {
        status: "failed",
        errorMessage: "Capture stopped because the job disk limit was reached."
      });
      await this.stopCapture(id, "failed");
    }
  }

  private async finishCapture(id: number, status: CaptureStatus, code: number | null): Promise<void> {
    const running = this.running.get(id);
    if (running) {
      clearTimeout(running.timeout);
      clearInterval(running.quotaTimer);
      this.running.delete(id);
    }

    await this.indexFiles(id);
    const current = this.db.getCapture(id);
    const finalStatus = current?.status === "failed" ? "failed" : status;
    this.db.updateCapture(id, {
      status: finalStatus,
      endedAt: nowIso(),
      exitCode: code,
      errorMessage: finalStatus === "failed" ? running?.stderr || "tcpdump failed." : null
    });
    this.logger.info(`Capture ${id} finished with status ${finalStatus}.`);
  }

  private async indexFiles(id: number): Promise<void> {
    const captureDir = path.join(this.config.captureDir, String(id));
    const entries = await fs.readdir(captureDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".pcap")) {
        continue;
      }
      const filePath = path.join(captureDir, entry.name);
      const stat = await fs.stat(filePath);
      this.db.addCaptureFile({
        captureId: id,
        path: filePath,
        filename: entry.name,
        sizeBytes: stat.size
      });
    }
  }
}
