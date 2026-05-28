import type { AppConfig } from "../config.js";
import type { NetworkStatus, WifiNetwork } from "../types/domain.js";
import type { CommandRunner } from "./command.js";
import { nodeCommandRunner } from "./command.js";

function parseTerseTable(output: string): string[][] {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(":"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class NetworkManager {
  constructor(
    private readonly config: AppConfig,
    private readonly commandRunner: CommandRunner = nodeCommandRunner,
    private readonly scanSettleMs = 3000
  ) {}

  async status(): Promise<NetworkStatus> {
    const result = await this.commandRunner.execFile("nmcli", [
      "-t",
      "-f",
      "DEVICE,TYPE,STATE,CONNECTION",
      "device"
    ]);
    const rows = parseTerseTable(result.stdout);
    const wifiRow = rows.find((row) => row[0] === this.config.wifiInterface);
    const connection = wifiRow?.[3] || null;
    const hotspotActive = connection === "picap-hotspot";
    const connected = wifiRow?.[2] === "connected";

    return {
      wifiInterface: this.config.wifiInterface,
      mode: hotspotActive ? "hotspot" : connected ? "wifi" : wifiRow ? "disconnected" : "unknown",
      ssid: hotspotActive ? "picap-hotspot" : connection,
      hotspotActive,
      raw: result.stdout
    };
  }

  async scan(): Promise<WifiNetwork[]> {
    await this.commandRunner.execFile("sudo", ["nmcli", "radio", "wifi", "on"]);
    await this.commandRunner.execFile("sudo", [
      "nmcli",
      "device",
      "set",
      this.config.wifiInterface,
      "managed",
      "yes"
    ]);
    await this.ensureWifiAvailable();
    await this.commandRunner.execFile("sudo", [
      "nmcli",
      "--wait",
      "15",
      "device",
      "wifi",
      "rescan",
      "ifname",
      this.config.wifiInterface
    ]);
    await sleep(this.scanSettleMs);

    const result = await this.commandRunner.execFile("nmcli", [
      "--wait",
      "15",
      "-t",
      "-f",
      "SSID,SIGNAL,SECURITY",
      "device",
      "wifi",
      "list",
      "ifname",
      this.config.wifiInterface,
      "--rescan",
      "yes"
    ]);

    const networks = new Map<string, WifiNetwork>();
    for (const row of parseTerseTable(result.stdout)) {
      const ssid = row[0]?.trim();
      if (!ssid) {
        continue;
      }
      const signal = Number(row[1]);
      const network = {
        ssid,
        signal: Number.isFinite(signal) ? signal : null,
        security: row[2] || ""
      };
      const existing = networks.get(ssid);
      if (!existing || (network.signal || 0) > (existing.signal || 0)) {
        networks.set(ssid, network);
      }
    }
    return [...networks.values()].sort((a, b) => (b.signal || 0) - (a.signal || 0));
  }

  private async ensureWifiAvailable(): Promise<void> {
    const result = await this.commandRunner.execFile("nmcli", [
      "-t",
      "-f",
      "DEVICE,TYPE,STATE",
      "device"
    ]);
    const rows = parseTerseTable(result.stdout);
    const wifiRow = rows.find((row) => row[0] === this.config.wifiInterface);
    if (!wifiRow) {
      throw new Error(`Wi-Fi interface ${this.config.wifiInterface} was not found.`);
    }
    if (wifiRow[1] !== "wifi") {
      throw new Error(`${this.config.wifiInterface} is not a Wi-Fi device.`);
    }
    if (wifiRow[2] === "unavailable") {
      throw new Error(
        `${this.config.wifiInterface} is unavailable. Check rfkill, Wi-Fi country/regulatory settings, and that NetworkManager manages the interface.`
      );
    }
  }

  async connectWifi(ssid: string, password: string): Promise<void> {
    const args = [
      "nmcli",
      "device",
      "wifi",
      "connect",
      ssid,
      "ifname",
      this.config.wifiInterface
    ];
    if (password) {
      args.push("password", password);
    }
    await this.commandRunner.execFile("sudo", args);
  }

  async startHotspot(ssid: string, password: string, _country: string, channel?: string): Promise<void> {
    const args = [
      "nmcli",
      "device",
      "wifi",
      "hotspot",
      "ifname",
      this.config.wifiInterface,
      "con-name",
      "picap-hotspot",
      "ssid",
      ssid,
      "password",
      password
    ];
    if (channel) {
      args.push("channel", channel);
    }
    await this.commandRunner.execFile("sudo", args);
  }

  async stopHotspot(): Promise<void> {
    await this.commandRunner.execFile("sudo", ["nmcli", "connection", "down", "picap-hotspot"]);
  }
}
