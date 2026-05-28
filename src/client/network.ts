import { readResponsePayload } from "./http";

interface WifiNetwork {
  ssid: string;
  signal: number | null;
  security: string;
}

function setStatus(message: string): void {
  const node = document.querySelector<HTMLElement>("[data-ui-status]");
  if (node) {
    node.textContent = message;
  }
  const wifiNode = document.querySelector<HTMLElement>("[data-wifi-scan-status]");
  if (wifiNode) {
    wifiNode.textContent = message;
  }
}

function replaceSelectWithMessage(select: HTMLSelectElement, message: string): void {
  const option = document.createElement("option");
  option.value = "";
  option.textContent = message;
  select.replaceChildren(option);
}

export function bindNetwork(root: ParentNode = document): void {
  const button = root.querySelector<HTMLButtonElement>("[data-wifi-scan]");
  const select = root.querySelector<HTMLSelectElement>("[data-wifi-networks]");
  if (!button || !select) {
    return;
  }
  button.addEventListener("click", async () => {
    button.disabled = true;
    replaceSelectWithMessage(select, "Scanning...");
    setStatus("Scanning Wi-Fi networks...");
    try {
      const response = await fetch("/api/network/wifi/scan");
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("Wi-Fi scan returned an unexpected response. Sign in again and retry.");
      }
      const payload = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Wi-Fi scan failed."));
      }
      if (!Array.isArray(payload?.networks)) {
        throw new Error("Wi-Fi scan response did not include a network list.");
      }
      const networks = payload.networks as unknown as WifiNetwork[];
      if (!networks.length) {
        replaceSelectWithMessage(select, "No networks found");
        setStatus("No Wi-Fi networks found. Enter an SSID manually or retry the scan.");
        return;
      }
      select.replaceChildren(
        (() => {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Select a network";
          return option;
        })(),
        ...networks.map((network) => {
          const option = document.createElement("option");
          option.value = network.ssid;
          option.textContent = `${network.ssid} ${network.signal ?? "?"}% ${network.security}`;
          return option;
        })
      );
      setStatus(`Found ${networks.length} Wi-Fi networks.`);
    } catch (error) {
      replaceSelectWithMessage(select, "Scan failed");
      setStatus(error instanceof Error ? error.message : "Wi-Fi scan failed.");
    } finally {
      button.disabled = false;
    }
  });
}
