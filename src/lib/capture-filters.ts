import net from "node:net";

import type { CaptureFilterRequest } from "../types/domain.js";

function hasValue(value: unknown): value is string | number {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function validateIpOrCidr(value: string): string {
  const trimmed = value.trim();
  const [ip, prefix] = trimmed.split("/");
  if (!net.isIP(ip)) {
    throw new Error(`Invalid IP or CIDR: ${value}`);
  }
  if (prefix !== undefined) {
    const prefixNumber = Number(prefix);
    const max = net.isIP(ip) === 4 ? 32 : 128;
    if (!Number.isInteger(prefixNumber) || prefixNumber < 0 || prefixNumber > max) {
      throw new Error(`Invalid CIDR prefix: ${value}`);
    }
  }
  return trimmed;
}

function hostOrNet(value: string, direction?: "src" | "dst"): string {
  const validated = validateIpOrCidr(value);
  const target = validated.includes("/") ? `net ${validated}` : `host ${validated}`;
  return direction ? `${direction} ${target}` : target;
}

function validatePort(value: string | number): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

export function buildBpfFilter(input: CaptureFilterRequest): string {
  if (hasValue(input.advancedBpf)) {
    return String(input.advancedBpf).trim();
  }

  const clauses: string[] = [];
  const protocol = input.protocol && input.protocol !== "any" ? input.protocol : "";

  if (protocol) {
    clauses.push(protocol);
  }
  if (hasValue(input.ip)) {
    clauses.push(hostOrNet(String(input.ip)));
  }
  if (hasValue(input.srcIp)) {
    clauses.push(hostOrNet(String(input.srcIp), "src"));
  }
  if (hasValue(input.dstIp)) {
    clauses.push(hostOrNet(String(input.dstIp), "dst"));
  }
  if (hasValue(input.port)) {
    clauses.push(`port ${validatePort(input.port)}`);
  }
  if (hasValue(input.srcPort)) {
    clauses.push(`src port ${validatePort(input.srcPort)}`);
  }
  if (hasValue(input.dstPort)) {
    clauses.push(`dst port ${validatePort(input.dstPort)}`);
  }

  return clauses.join(" and ");
}

export function durationToSeconds(value: number, unit: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Duration must be greater than zero.");
  }

  const rounded = Math.floor(value);
  switch (unit) {
    case "minutes":
      return rounded * 60;
    case "hours":
      return rounded * 60 * 60;
    case "days":
      return rounded * 24 * 60 * 60;
    case "weeks":
      return rounded * 7 * 24 * 60 * 60;
    default:
      throw new Error("Invalid duration unit.");
  }
}
