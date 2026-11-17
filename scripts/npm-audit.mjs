#!/usr/bin/env node
/**
 * The frontend's dependency audit: `npm audit --audit-level=high` with the
 * backend's one way out, server-kit's `dependency_audit --ignore-until-fixed
 * ID=reason`. An advisory is accepted with its reason only while no fixed
 * version exists for the version installed, and it blocks again the day a fix
 * ships.
 *
 *     node scripts/npm-audit.mjs --ignore-until-fixed GHSA-xxxx-xxxx-xxxx="dev only, no fix"
 *
 * Marcel, 2026-11-17: GHSA-fc5q-39xc-vjpf (picomatch, a ReDoS, high) had no
 * fixed version, sat only in vite, vitest and typescript-eslint, and stopped
 * every push. He chose a narrow exception over waiting. UI-Kit plans a kit
 * tool for every app; once it ships, this script makes way for it.
 *
 * Exit 0: nothing high or critical but what is accepted. Exit 1: a finding
 * blocks. Exit 2: the audit could not be read or a flag is wrong. Never a
 * silent pass.
 *
 * What it deliberately does not do:
 *
 * - **Accept anything a reader's browser gets.** The runtime dependencies
 *   (`npm audit --omit=dev`) are audited first, and no exception applies to
 *   them.
 * - **Trust an exception it cannot check.** Whether a fix exists is read from
 *   OSV, where server-kit reads it. If OSV cannot be reached, if the record
 *   does not name the installed version, or if npm reports a version OSV does
 *   not, the advisory blocks (fail closed).
 * - **Keep a stale exception.** An accepted advisory that npm no longer
 *   reports blocks, so the line is removed rather than left to hide the next
 *   advisory.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BLOCKING = new Set(["high", "critical"]);
const OSV_URL = "https://api.osv.dev/v1/vulns/";

/** The audit could not be read, or a flag is wrong: exit 2, never a pass. */
class Unreadable extends Error {}

/** `--ignore-until-fixed ID=reason`, repeatable; anything else is a wrong flag. */
function exceptions(argv) {
  const accepted = new Map();
  for (let i = 0; i < argv.length; i++) {
    const flag = "--ignore-until-fixed";
    const text = argv[i] === flag ? argv[++i] : argv[i].startsWith(`${flag}=`) ? argv[i].slice(flag.length + 1) : null;
    if (text === null || text === undefined) throw new Unreadable(`unknown argument ${JSON.stringify(argv[i])}`);
    const at = text.indexOf("=");
    const id = at < 0 ? "" : text.slice(0, at).trim();
    const reason = at < 0 ? "" : text.slice(at + 1).trim();
    if (!id || !reason) throw new Unreadable(`${JSON.stringify(text)} is not ID=reason: an accepted advisory says why`);
    accepted.set(id, reason);
  }
  return accepted;
}

/** npm's report (`auditReportVersion` 2), read strictly. */
function npmAudit(extra) {
  const done = spawnSync("npm", ["audit", "--json", ...extra], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (done.error) throw new Unreadable(`npm audit did not run: ${done.error.message}`);
  if (done.status !== 0 && done.status !== 1) throw new Unreadable(`npm audit failed (exit ${done.status})`);
  let report;
  try {
    report = JSON.parse(done.stdout);
  } catch {
    throw new Unreadable("npm audit's JSON could not be read");
  }
  if (report.error) throw new Unreadable(`npm audit: ${report.error.summary ?? JSON.stringify(report.error)}`);
  if (report.auditReportVersion !== 2 || typeof report.vulnerabilities !== "object")
    throw new Unreadable(`npm audit's report is not version 2: ${String(report.auditReportVersion)}`);
  return report;
}

/**
 * The advisories behind a report, by id. A package that is vulnerable only
 * through another (vite through picomatch) names that package, not an
 * advisory, and so its severity is the advisory's. Blocking on the advisories
 * blocks what `--audit-level=high` blocks.
 */
function advisories(report) {
  const found = new Map();
  for (const entry of Object.values(report.vulnerabilities)) {
    for (const via of entry.via) {
      if (typeof via !== "object") continue;
      const id = String(via.url ?? "")
        .split("/")
        .pop();
      if (!id) throw new Unreadable(`an advisory on ${via.name} has no id: ${JSON.stringify(via)}`);
      const known = found.get(id) ?? { id, name: via.name, severity: via.severity, title: via.title, nodes: new Set() };
      for (const node of entry.name === via.name ? entry.nodes : []) known.nodes.add(node);
      found.set(id, known);
    }
  }
  return [...found.values()];
}

const parts = (version) => version.split(/[-+]/)[0].split(".").map(Number);
function compare(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/**
 * The fixed version OSV names for `version` of `name`, `null` if none exists
 * yet. Throws if OSV cannot say, which keeps the advisory blocking.
 */
async function fixFor(id, name, version) {
  let record;
  try {
    const response = await fetch(OSV_URL + encodeURIComponent(id), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    record = await response.json();
  } catch (error) {
    throw new Unreadable(`OSV has no answer on ${id} (${error.message}): it blocks until it has`);
  }
  for (const affected of record.affected ?? []) {
    if (affected.package?.ecosystem !== "npm" || affected.package?.name !== name) continue;
    for (const range of affected.ranges ?? []) {
      if (range.type !== "SEMVER") continue;
      let from = null;
      for (const event of range.events ?? []) {
        if (event.introduced !== undefined) from = event.introduced;
        else if (from !== null && (event.fixed !== undefined || event.last_affected !== undefined)) {
          const end = event.fixed ?? event.last_affected;
          const inside =
            compare(version, from) >= 0 && (event.fixed ? compare(version, end) < 0 : compare(version, end) <= 0);
          if (inside) return event.fixed ?? null;
          from = null;
        }
      }
      if (from !== null && compare(version, from) >= 0) return null; // open-ended: no fix yet
    }
  }
  throw new Unreadable(`OSV's ${id} does not name ${name}@${version}, which npm reports: it blocks`);
}

const installed = (node) => JSON.parse(readFileSync(join(process.cwd(), node, "package.json"), "utf8")).version;

async function main() {
  const accepted = exceptions(process.argv.slice(2));
  for (const [id, reason] of accepted) console.log(`audit: accepted while unfixed ${id} — ${reason}`);
  const blocking = [];

  for (const advisory of advisories(npmAudit(["--omit=dev"])))
    if (BLOCKING.has(advisory.severity))
      blocking.push(`${advisory.id} ${advisory.name} (${advisory.severity}) reaches the runtime: no exception there`);

  const found = advisories(npmAudit([]));
  for (const advisory of found) {
    if (!BLOCKING.has(advisory.severity)) {
      console.log(`audit: warning ${advisory.id} ${advisory.name} (${advisory.severity}): ${advisory.title}`);
      continue;
    }
    if (!accepted.has(advisory.id)) {
      blocking.push(`${advisory.id} ${advisory.name} (${advisory.severity}): ${advisory.title}`);
      continue;
    }
    if (advisory.nodes.size === 0) throw new Unreadable(`npm names no installed copy of ${advisory.name}`);
    for (const node of advisory.nodes) {
      const version = installed(node);
      const fix = await fixFor(advisory.id, advisory.name, version);
      if (fix !== null)
        blocking.push(
          `${advisory.id} ${advisory.name}@${version}: fixed in ${fix}, so update it and drop the exception`,
        );
    }
  }
  for (const id of accepted.keys())
    if (!found.some((advisory) => advisory.id === id))
      blocking.push(`${id} is accepted but npm no longer reports it: drop the exception`);

  if (blocking.length === 0) {
    console.log(`audit: nothing high or critical (${found.length} advisories, ${accepted.size} accepted)`);
    return 0;
  }
  for (const line of blocking) console.log(`audit: BLOCKS ${line}`);
  console.log("audit: upgrade the package, or accept an advisory without a fix: --ignore-until-fixed ID=reason");
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.log(`audit: the dependency audit could not be read — ${error.message}`);
    process.exit(2);
  },
);
