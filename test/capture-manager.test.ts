import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { AppConfig } from "../src/config.js";
import { CaptureManager } from "../src/lib/capture-manager.js";
import { AppDatabase } from "../src/lib/db.js";

test("builds rotated tcpdump args", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "picap-capture-"));
  const config: AppConfig = {
    host: "0.0.0.0",
    port: 8080,
    passwordHash: "hash",
    sessionSecret: "secret",
    captureDir: path.join(dir, "captures"),
    dbPath: path.join(dir, "picap.sqlite3"),
    tcpdumpUser: "picap",
    captureInterface: "eth0",
    wifiInterface: "wlan0",
    maxTotalCaptureGb: 32,
    defaultChunkSeconds: 300,
    defaultChunkMb: 256,
    secureCookies: false
  };
  const db = new AppDatabase(config.dbPath);
  const manager = new CaptureManager(config, db);

  assert.deepEqual(manager.buildTcpdumpArgs(7, {
    interfaceName: "eth0",
    chunkSeconds: 60,
    chunkMb: 128,
    bpfFilter: "tcp and port 443"
  }), [
    "tcpdump",
    "-Z",
    "picap",
    "-i",
    "eth0",
    "-nn",
    "-s",
    "0",
    "-G",
    "60",
    "-C",
    "128",
    "-w",
    path.join(config.captureDir, "7", "chunk-%Y%m%d-%H%M%S.pcap"),
    "tcp",
    "and",
    "port",
    "443"
  ]);
  db.close();
});
