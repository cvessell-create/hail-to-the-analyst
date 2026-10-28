import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const workspace = readFileSync(new URL("../pnpm-workspace.yaml", import.meta.url), "utf8");
const pnpmLock = readFileSync(new URL("../pnpm-lock.yaml", import.meta.url), "utf8");
const npmLock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const patchedSharp = "0.35.5";
const patchedNext = "16.4.1";

test("Next.js advisories: manifests and both lockfiles use the patched release", () => {
  assert.equal(manifest.dependencies.next, patchedNext);
  assert.equal(manifest.devDependencies["eslint-config-next"], patchedNext);
  const versions = [...pnpmLock.matchAll(/^\s+next@(\d+\.\d+\.\d+)/gm)];
  assert.ok(versions.length > 0);
  for (const match of versions) assert.equal(match[1], patchedNext);
  const packages = Object.entries(npmLock.packages).filter(([name]) => /(?:^|\/)node_modules\/next$/.test(name));
  assert.ok(packages.length > 0);
  for (const [, entry] of packages) assert.equal(entry.version, patchedNext);
});

test("GHSA-wq5f-xc86-pv6w: both package managers override every Sharp dependency", () => {
  assert.equal(manifest.overrides.sharp, patchedSharp);
  assert.match(workspace, /^overrides:\n  sharp: 0\.35\.5$/m);
  assert.match(pnpmLock, /^overrides:\n  sharp: 0\.35\.5$/m);
});

test("Aikido prototype-pollution advisories: both package managers pin protected versions", () => {
  assert.equal(manifest.dependencies.recharts, "3.10.1");
  for (const [name, version] of [["immer", "11.1.9"], ["es-toolkit", "1.51.0"]]) {
    assert.equal(manifest.overrides[name], version);
    for (const text of [workspace, pnpmLock])
      assert.ok(text.includes(`  ${name}: ${version}\n`));
    const versions = [...pnpmLock.matchAll(new RegExp(`^\\s+${name}@(\\d+\\.\\d+\\.\\d+)(?:[:(])`, "gm"))];
    assert.ok(versions.length > 0, `${name} must be present in pnpm`);
    for (const match of versions) assert.equal(match[1], version);
    const packages = Object.entries(npmLock.packages)
      .filter(([key]) => key.endsWith(`/node_modules/${name}`) || key === `node_modules/${name}`);
    assert.ok(packages.length > 0, `${name} must be present in npm`);
    for (const [, entry] of packages) assert.equal(entry.version, version);
  }
});

test("GHSA-wq5f-xc86-pv6w: pnpm locks only patched Sharp and libvips binaries", () => {
  const lock = pnpmLock;
  const sharpVersions = [...lock.matchAll(/^\s+sharp(?:@|: )(\d+\.\d+\.\d+)/gm)];
  assert.ok(sharpVersions.length > 0, "Sharp must be present in the dependency graph");
  for (const match of sharpVersions) assert.equal(match[1], patchedSharp);
  const binaries = [...lock.matchAll(/^\s+'@img\/sharp-([^'@]+)@([^']+)':/gm)];
  assert.ok(binaries.some(match => match[1] === "linux-x64"));
  assert.ok(binaries.some(match => match[1] === "libvips-linux-x64"));
  for (const match of binaries) {
    assert.equal(match[2], match[1].startsWith("libvips-") ? "1.3.4" : patchedSharp);
  }
});

test("GHSA-wq5f-xc86-pv6w: npm locks only patched Sharp and libvips binaries", () => {
  const packages = npmLock.packages;
  const sharp = Object.entries(packages).filter(([name]) => /(?:^|\/)node_modules\/sharp$/.test(name));
  assert.ok(sharp.length > 0, "Sharp must be present in the dependency graph");
  for (const [, entry] of sharp) assert.equal(entry.version, patchedSharp);
  const binaries = Object.entries(packages).filter(([name]) => /node_modules\/@img\/sharp-/.test(name));
  assert.ok(binaries.length > 0);
  for (const [name, entry] of binaries) {
    if (/node_modules\/@img\/sharp-[^/]+$/.test(name)) {
      assert.equal(entry.version, name.includes("/sharp-libvips-") ? "1.3.4" : patchedSharp);
    }
  }
});
