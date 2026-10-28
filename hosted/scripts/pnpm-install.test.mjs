import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { InstallProgress, resolveInstallLockPath } from "./pnpm-install.mjs";

const script = fileURLToPath(new URL("./pnpm-install.mjs", import.meta.url));

test("install lock paths stay inside the designated lock locations", async t => {
  const previousDirectory = process.cwd();
  const previousRuntime = process.env.SITES_RUNTIME_ROOT;
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "pnpm-lock-test-")));
  const runtime = path.join(directory, ".sites-runtime");
  mkdirSync(runtime);
  process.chdir(directory);
  delete process.env.SITES_RUNTIME_ROOT;
  try {
    await t.test("accepts the default project install lock", () => {
      assert.equal(resolveInstallLockPath("project"),
        path.join(runtime, "install.lock"));
    });
    await t.test("preserves an explicitly configured runtime root", () => {
      const configured = path.join(directory, "configured-runtime");
      mkdirSync(configured);
      process.env.SITES_RUNTIME_ROOT = configured;
      try {
        assert.equal(resolveInstallLockPath("project"),
          path.join(configured, "install.lock"));
      } finally {
        delete process.env.SITES_RUNTIME_ROOT;
      }
    });
    const hold = (args = [], env = {}) => spawnSync(process.execPath,
      [script, "--hold-install-locks", ...args],
      { cwd: directory, env: { ...process.env, SITES_PNPM_STORE_LOCK_TIMEOUT: "0", ...env },
        input: "shared\n", encoding: "utf8", timeout: 5000 });
    await t.test("rejects all CLI-selected lock paths before creating any lock", () => {
      for (const candidate of [
        "", "install.lock", ".sites-runtime/install.lock",
        `${runtime}/../outside.lock`, `${runtime}/../.sites-runtime/install.lock`,
        path.join(directory, "outside.lock"), path.join(runtime, "other.lock"),
        `${runtime}-other/install.lock`, path.join(runtime, "install.lock"),
        "/workspace/.sites-runtime/pnpm-store.seed.lock",
      ]) {
        const result = hold([candidate]);
        assert.ifError(result.error);
        assert.equal(result.status, 64);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, /accepts no path arguments/);
      }
      assert.equal(existsSync(path.join(runtime, "install.lock")), false);
      assert.throws(() => resolveInstallLockPath("unknown"));
    });
    await t.test("rejects relative and traversal runtime configuration", () => {
      for (const configured of ["relative", `${runtime}/../.sites-runtime`]) {
        process.env.SITES_RUNTIME_ROOT = configured;
        try {
          assert.throws(() => resolveInstallLockPath("project"), /absolute path without traversal/);
        } finally {
          delete process.env.SITES_RUNTIME_ROOT;
        }
      }
    });
    await t.test("rejects invalid timeouts before creating any lock", () => {
      for (const timeout of ["-1", "Infinity", "1e10", "0; echo invalid", "abc"]) {
        const result = hold([], { SITES_PNPM_STORE_LOCK_TIMEOUT: timeout });
        assert.ifError(result.error);
        assert.equal(result.status, 64);
        assert.equal(result.stdout, "");
      }
      assert.equal(existsSync(path.join(runtime, "install.lock")), false);
    });
    await t.test("rejects symlinked lock directories and ancestors", () => {
      const alias = path.join(directory, "runtime-alias");
      symlinkSync(runtime, alias, "dir");
      for (const configured of [alias, path.join(alias, "nested")]) {
        mkdirSync(path.join(runtime, "nested"), { recursive: true });
        process.env.SITES_RUNTIME_ROOT = configured;
        try {
          assert.throws(() => resolveInstallLockPath("project"),
            /must not be a symlink/);
        } finally {
          delete process.env.SITES_RUNTIME_ROOT;
        }
      }
    });
    await t.test("legacy CLI traversal is rejected without creating the outside file", () => {
      const result = hold([`${runtime}/../outside.lock`, path.join(directory, "shared.lock"), "0"]);
      assert.ifError(result.error);
      assert.equal(result.status, 64);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /accepts no path arguments/);
      assert.equal(existsSync(path.join(directory, "outside.lock")), false);
    });
    await t.test("final-component symlinks are not opened or modified", () => {
      const outside = path.join(directory, "outside.txt");
      writeFileSync(outside, "preserve");
      const lock = path.join(runtime, "install.lock");
      symlinkSync(outside, lock);
      try {
        const result = hold();
        assert.ifError(result.error);
        assert.equal(result.stdout, "unavailable\nunavailable\n");
        assert.equal(readFileSync(outside, "utf8"), "preserve");
      } finally {
        rmSync(lock);
      }
    });
    await t.test("valid project paths still create a regular lock file", () => {
      const lock = path.join(runtime, "install.lock");
      const result = hold();
      assert.ifError(result.error);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /^(locked|unavailable)\nunavailable\n$/);
      assert.doesNotMatch(result.stderr, /Invalid or unavailable install lock/);
      assert.equal(readFileSync(lock, "utf8"), "");
      assert.equal(existsSync(path.join(directory, "shared.lock")), false);
    });

    await t.test("install progress counts only events from the installer's working directory", () => {
      const project = process.cwd();
      const progress = new InstallProgress();
      assert.equal(new InstallProgress().project, project);
      progress.accept({ name: "pnpm:progress", requester: project, status: "found_in_store", packageId: "a" });
      progress.accept({ name: "pnpm:progress", requester: project, status: "fetched", packageId: "b" });
      progress.accept({ name: "pnpm:progress", requester: `${project}-other`, status: "fetched", packageId: "c" });
      progress.accept({ name: "pnpm:stats", prefix: project, added: 2 });
      assert.deepEqual(progress.counts(true), {});
      progress.accept({ name: "pnpm:stage", prefix: project, stage: "importing_done" });
      assert.deepEqual(progress.counts(true), { packages_reused: 1, packages_downloaded: 1 });
      assert.deepEqual(progress.counts(false), {});
    });
  } finally {
    process.chdir(previousDirectory);
    if (previousRuntime === undefined) delete process.env.SITES_RUNTIME_ROOT;
    else process.env.SITES_RUNTIME_ROOT = previousRuntime;
    rmSync(directory, { recursive: true, force: true });
  }
});
