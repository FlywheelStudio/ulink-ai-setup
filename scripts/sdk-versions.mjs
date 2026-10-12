#!/usr/bin/env node
/**
 * Keeps the SDK versions pinned in skills/setup-ulink/SKILL.md in step with
 * the package registries.
 *
 *   node scripts/sdk-versions.mjs --check   report pins behind the registries (exit 1 if any)
 *   node scripts/sdk-versions.mjs --write   rewrite them to the latest published versions
 *
 * The current version of each SDK is the one its pins already use; only pins at
 * that version move, and only forward. The daily sdk-version-sync workflow runs
 * --write and opens a PR. ulink.ly re-syncs its served copy of SKILL.md from
 * main on every deploy; the npm package needs a release to pick it up.
 */
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = resolve(__dirname, '../skills/setup-ulink/SKILL.md');

export const PINS = {
  android: [/ly\.ulink:ulink-sdk:(\d+\.\d+\.\d+)/g],
  ios: [/pod 'ULinkSDK', '~> (\d+\.\d+\.\d+)'/g, /ios_ulink_sdk\.git", from: "(\d+\.\d+\.\d+)"/g],
  flutter: [/flutter_ulink_sdk: \^(\d+\.\d+\.\d+)/g],
};

const STABLE = /^\d+\.\d+\.\d+$/;

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** The version each SDK is pinned at; throws if an SDK's pins disagree or are missing. */
export function readCurrentVersions(text) {
  const current = {};
  for (const [sdk, patterns] of Object.entries(PINS)) {
    const found = new Set(patterns.flatMap((p) => [...text.matchAll(p)].map((m) => m[1])));
    if (found.size !== 1) {
      throw new Error(`SKILL.md: expected one ${sdk} version, found ${[...found].join(', ') || 'none'}`);
    }
    current[sdk] = [...found][0];
  }
  return current;
}

export function rewritePins(text, sdk, from, to) {
  let count = 0;
  let next = text;
  for (const pattern of PINS[sdk]) {
    next = next.replace(pattern, (match, version) => {
      if (version !== from) return match;
      count += 1;
      return match.replace(version, to);
    });
  }
  return { text: next, count };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

export async function fetchLatestVersions() {
  const maven = await fetch('https://repo1.maven.org/maven2/ly/ulink/ulink-sdk/maven-metadata.xml');
  if (!maven.ok) throw new Error(`Maven Central -> HTTP ${maven.status}`);
  const android = (await maven.text()).match(/<release>([^<]+)<\/release>/)?.[1];
  const flutter = (await fetchJson('https://pub.dev/api/packages/flutter_ulink_sdk')).latest?.version;
  const ios = (await fetchJson('https://trunk.cocoapods.org/api/v1/pods/ULinkSDK')).versions
    .map((v) => v.name)
    .filter((v) => STABLE.test(v))
    .sort(compareVersions)
    .at(-1);
  const latest = { android, ios, flutter };
  for (const [sdk, version] of Object.entries(latest)) {
    if (!version || !STABLE.test(version)) throw new Error(`${sdk}: unexpected latest version "${version}"`);
  }
  return latest;
}

async function main() {
  const write = process.argv.includes('--write');
  let text = await readFile(SKILL_PATH, 'utf8');
  const current = readCurrentVersions(text);
  const latest = await fetchLatestVersions();

  const bumps = Object.keys(current)
    .filter((sdk) => compareVersions(latest[sdk], current[sdk]) > 0)
    .map((sdk) => ({ sdk, from: current[sdk], to: latest[sdk] }));
  for (const sdk of Object.keys(current)) {
    console.log(`${sdk}: pinned ${current[sdk]}, registry ${latest[sdk]}`);
  }
  if (bumps.length === 0) {
    console.log('All SDK pins are current.');
    return;
  }

  const summary = bumps.map((b) => `${b.sdk} ${b.from} -> ${b.to}`).join(', ');
  if (!write) {
    console.error(`SDK pins behind the registries: ${summary}`);
    process.exitCode = 1;
    return;
  }
  for (const { sdk, from, to } of bumps) text = rewritePins(text, sdk, from, to).text;
  await writeFile(SKILL_PATH, text);
  console.log(`Updated SDK pins: ${summary}`);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `summary=${summary}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
