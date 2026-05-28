import assert from "node:assert/strict";
import test from "node:test";

import { buildBpfFilter, durationToSeconds } from "../src/lib/capture-filters.js";

test("builds simple host and port filters", () => {
  assert.equal(
    buildBpfFilter({ ip: "192.168.1.10", port: "443", protocol: "tcp" }),
    "tcp and host 192.168.1.10 and port 443"
  );
});

test("builds directional CIDR filters", () => {
  assert.equal(
    buildBpfFilter({ srcIp: "192.168.1.0/24", dstPort: 53, protocol: "udp" }),
    "udp and src net 192.168.1.0/24 and dst port 53"
  );
});

test("advanced BPF overrides simple fields", () => {
  assert.equal(
    buildBpfFilter({ advancedBpf: "tcp and port 443", ip: "10.0.0.1" }),
    "tcp and port 443"
  );
});

test("rejects invalid ports and CIDR prefixes", () => {
  assert.throws(() => buildBpfFilter({ port: 70_000 }), /Invalid port/);
  assert.throws(() => buildBpfFilter({ ip: "192.168.1.0/40" }), /Invalid CIDR/);
});

test("converts duration units to seconds", () => {
  assert.equal(durationToSeconds(2, "minutes"), 120);
  assert.equal(durationToSeconds(3, "hours"), 10_800);
  assert.equal(durationToSeconds(1, "days"), 86_400);
  assert.equal(durationToSeconds(2, "weeks"), 1_209_600);
});
