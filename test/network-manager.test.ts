import assert from "node:assert/strict";
import test from "node:test";

import type { AppConfig } from "../src/config.js";
import type { CommandRunner, ExecResult, SpawnedProcess } from "../src/lib/command.js";
import { NetworkManager } from "../src/lib/network-manager.js";

const config: AppConfig = {
  host: "0.0.0.0",
  port: 8080,
  passwordHash: "hash",
  sessionSecret: "secret",
  captureDir: "/tmp/captures",
  dbPath: "/tmp/picap.sqlite3",
  captureInterface: "eth0",
  wifiInterface: "wlan0",
  maxTotalCaptureGb: 32,
  defaultChunkSeconds: 300,
  defaultChunkMb: 256,
  secureCookies: false
};

class FakeRunner implements CommandRunner {
  public calls: Array<{ command: string; args: string[] }> = [];

  async execFile(command: string, args: string[]): Promise<ExecResult> {
    this.calls.push({ command, args });
    if (args.includes("list")) {
      return {
        stdout: "Lab:88:WPA2\nLab:50:WPA2\nOpen:20:\n",
        stderr: ""
      };
    }
    return { stdout: "wlan0:wifi:connected:picap-hotspot\neth0:ethernet:connected:Wired\n", stderr: "" };
  }

  spawn(): SpawnedProcess {
    throw new Error("not used");
  }
}

test("parses network status and wifi scans", async () => {
  const runner = new FakeRunner();
  const manager = new NetworkManager(config, runner);
  const status = await manager.status();
  assert.equal(status.mode, "hotspot");

  const networks = await manager.scan();
  assert.deepEqual(networks[0], { ssid: "Lab", signal: 88, security: "WPA2" });
  assert.equal(networks.length, 2);
});

test("builds hotspot command through sudo nmcli", async () => {
  const runner = new FakeRunner();
  const manager = new NetworkManager(config, runner);
  await manager.startHotspot("PiCap", "password123", "US", "6");
  assert.deepEqual(runner.calls.at(-1), {
    command: "sudo",
    args: [
      "nmcli",
      "device",
      "wifi",
      "hotspot",
      "ifname",
      "wlan0",
      "con-name",
      "picap-hotspot",
      "ssid",
      "PiCap",
      "password",
      "password123",
      "channel",
      "6"
    ]
  });
});
