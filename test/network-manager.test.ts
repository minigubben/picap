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
    if (args.includes("DEVICE,TYPE,STATE")) {
      return { stdout: "wlan0:wifi:disconnected\neth0:ethernet:connected\n", stderr: "" };
    }
    return { stdout: "wlan0:wifi:connected:picap-hotspot\neth0:ethernet:connected:Wired\n", stderr: "" };
  }

  spawn(): SpawnedProcess {
    throw new Error("not used");
  }
}

test("parses network status and wifi scans", async () => {
  const runner = new FakeRunner();
  const manager = new NetworkManager(config, runner, 0);
  const status = await manager.status();
  assert.equal(status.mode, "hotspot");

  const networks = await manager.scan();
  assert.deepEqual(networks[0], { ssid: "Lab", signal: 88, security: "WPA2" });
  assert.equal(networks.length, 2);
  assert.deepEqual(runner.calls.slice(1, 6), [
    { command: "sudo", args: ["nmcli", "radio", "wifi", "on"] },
    { command: "sudo", args: ["nmcli", "device", "set", "wlan0", "managed", "yes"] },
    { command: "nmcli", args: ["-t", "-f", "DEVICE,TYPE,STATE", "device"] },
    {
      command: "sudo",
      args: ["nmcli", "--wait", "15", "device", "wifi", "rescan", "ifname", "wlan0"]
    },
    {
      command: "nmcli",
      args: [
        "--wait",
        "15",
        "-t",
        "-f",
        "SSID,SIGNAL,SECURITY",
        "device",
        "wifi",
        "list",
        "ifname",
        "wlan0",
        "--rescan",
        "yes"
      ]
    }
  ]);
});

test("explains unavailable wifi before scanning", async () => {
  class UnavailableRunner extends FakeRunner {
    override async execFile(command: string, args: string[]): Promise<ExecResult> {
      this.calls.push({ command, args });
      if (args.includes("DEVICE,TYPE,STATE")) {
        return { stdout: "wlan0:wifi:unavailable\n", stderr: "" };
      }
      return { stdout: "", stderr: "" };
    }
  }

  const runner = new UnavailableRunner();
  const manager = new NetworkManager(config, runner, 0);
  await assert.rejects(() => manager.scan(), /wlan0 is unavailable/);
});

test("builds hotspot command through sudo nmcli", async () => {
  const runner = new FakeRunner();
  const manager = new NetworkManager(config, runner, 0);
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
