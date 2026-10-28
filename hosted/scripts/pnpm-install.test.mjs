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
import { resolveInstallLockPath } from "./pnpm-install.mjs";

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
      assert.equal(resolveInstallLockPath(path.join(runtime, "install.lock"), "project"),
        path.join(runtime, "install.lock"));
    });
    await t.test("preserves an explicitly configured runtime root", () => {
      const configured = path.join(directory, "configured-runtime");
      mkdirSync(configured);
      process.env.SITES_RUNTIME_ROOT = configured;
      try {
        assert.equal(resolveInstallLockPath(path.join(configured, "install.lock"), "project"),
          path.join(configured, "install.lock"));
        assert.throws(() => resolveInstallLockPath(path.join(runtime, "install.lock"), "project"));
      } finally {
        delete process.env.SITES_RUNTIME_ROOT;
      }
    });
    await t.test("rejects relative, traversal, unrelated and prefix-collision paths", () => {
      for (const candidate of [
        undefined, "", "install.lock", ".sites-runtime/install.lock",
        `${runtime}/../outside.lock`, `${runtime}/../.sites-runtime/install.lock`,
        path.join(directory, "outside.lock"), path.join(runtime, "other.lock"),
        `${runtime}-other/install.lock`, `${runtime}/install.lock\0`,
      ]) {
        assert.throws(() => resolveInstallLockPath(candidate, "project"));
      }
      assert.throws(() => resolveInstallLockPath(path.join(runtime, "install.lock"), "unknown"));
    });
    await t.test("shared locks cannot be redirected to a CLI-selected file", () => {
      assert.throws(() => resolveInstallLockPath(path.join(runtime, "pnpm-store.seed.lock"), "shared"));
      assert.throws(() => resolveInstallLockPath("/workspace/.sites-runtime/../outside.lock", "shared"));
    });
    await t.test("rejects symlinked lock directories and ancestors", () => {
      const alias = path.join(directory, "runtime-alias");
      symlinkSync(runtime, alias, "dir");
      for (const configured of [alias, path.join(alias, "nested")]) {
        mkdirSync(path.join(runtime, "nested"), { recursive: true });
        process.env.SITES_RUNTIME_ROOT = configured;
        try {
          assert.throws(() => resolveInstallLockPath(path.join(configured, "install.lock"), "project"),
            /must not be a symlink/);
        } finally {
          delete process.env.SITES_RUNTIME_ROOT;
        }
      }
    });
    const hold = filename => spawnSync(process.execPath,
      [script, "--hold-install-locks", filename, path.join(directory, "shared.lock"), "0"],
      { cwd: directory, env: process.env, input: "shared\n", encoding: "utf8", timeout: 5000 });
    await t.test("CLI traversal is rejected without creating the outside file", () => {
      const result = hold(`${runtime}/../outside.lock`);
      assert.ifError(result.error);
      assert.equal(result.status, 0);
      assert.equal(result.stdout, "unavailable\nunavailable\n");
      assert.match(result.stderr, /Invalid or unavailable install lock/);
      assert.equal(existsSync(path.join(directory, "outside.lock")), false);
    });
    await t.test("final-component symlinks are not opened or modified", () => {
      const outside = path.join(directory, "outside.txt");
      writeFileSync(outside, "preserve");
      const lock = path.join(runtime, "install.lock");
      symlinkSync(outside, lock);
      try {
        const result = hold(lock);
        assert.ifError(result.error);
        assert.equal(result.stdout, "unavailable\nunavailable\n");
        assert.equal(readFileSync(outside, "utf8"), "preserve");
      } finally {
        rmSync(lock);
      }
    });
    await t.test("valid project paths still create a regular lock file", () => {
      const lock = path.join(runtime, "install.lock");
      const result = hold(lock);
      assert.ifError(result.error);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /^(locked|unavailable)\nunavailable\n$/);
      assert.doesNotMatch(result.stderr, /Invalid or unavailable install lock/);
      assert.equal(readFileSync(lock, "utf8"), "");
      assert.equal(existsSync(path.join(directory, "shared.lock")), false);
    });
  } finally {
    process.chdir(previousDirectory);
    if (previousRuntime === undefined) delete process.env.SITES_RUNTIME_ROOT;
    else process.env.SITES_RUNTIME_ROOT = previousRuntime;
    rmSync(directory, { recursive: true, force: true });
  }
});
