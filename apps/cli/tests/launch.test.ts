import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFile, rm, mkdtemp, writeFile } from "node:fs/promises";
import { type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { runCli } from "../src/cli.ts";
import { CONFIG_FILENAME, DEFAULT_PORT, loadConfig } from "../src/config.ts";
import { startLocalServer } from "../src/server.ts";
import { createUiFixture, removeUiFixture, UI_FIXTURE_INDEX } from "./ui-fixture.ts";

let uiDirectory: string;

beforeAll(async () => {
  uiDirectory = await createUiFixture();
});

afterAll(async () => {
  await removeUiFixture(uiDirectory);
});

async function withDirectory(check: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "do-better-launch-"));
  try {
    await check(directory);
  } finally {
    await rm(directory, { recursive: true });
    await expect(readFile(join(directory, CONFIG_FILENAME))).rejects.toThrow();
  }
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
}

function portOf(server: Server) {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");
  expect(address.address).toBe("127.0.0.1");
  return address.port;
}

describe("local UI launch", () => {
  test("loads a configured port and uses the default for an absent setting or file", async () => {
    await withDirectory(async (directory) => {
      expect(await loadConfig(directory)).toEqual({ port: DEFAULT_PORT });
      await writeFile(join(directory, CONFIG_FILENAME), "{}");
      expect(await loadConfig(directory)).toEqual({ port: DEFAULT_PORT });
      await writeFile(join(directory, CONFIG_FILENAME), '{"port":4567}');
      expect(await loadConfig(directory)).toEqual({ port: 4567 });
    });
  });

  test("rejects malformed config, invalid ports, and unknown settings", async () => {
    await withDirectory(async (directory) => {
      for (const content of ["{", "null", "[]", '{"port":0}', '{"port":65536}',
        '{"port":1.5}', '{"port":"4310"}', '{"port":null}', '{"prt":4310}']) {
        await writeFile(join(directory, CONFIG_FILENAME), content);
        await expect(loadConfig(directory)).rejects.toThrow();
      }
    });
  });

  test("start uses the configured port, serves the built UI, and launches the browser after listening", async () => {
    const reservation = await startLocalServer(0, { uiDirectory });
    const port = portOf(reservation);
    await close(reservation);
    await withDirectory(async (directory) => {
      await writeFile(join(directory, CONFIG_FILENAME), JSON.stringify({ port }));
      let launched = false;
      const server = await runCli(["start"], { directory, uiDirectory, launchBrowser: async (url) => {
        expect(url).toBe(`http://127.0.0.1:${port}`);
        const response = await fetch(url);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe(UI_FIXTURE_INDEX);
        expect((await fetch(`${url}/playground`)).status).toBe(200);
        launched = true;
      } });
      try {
        expect(launched).toBe(true);
        expect(server).toBeDefined();
      } finally {
        if (server) await close(server);
      }
    });
  });

  test("rejects a port argument and reports occupied ports without opening a browser", async () => {
    await expect(runCli(["start", "--port", "4310"])).rejects.toThrow("Usage");
    const server = await startLocalServer(0, { uiDirectory });
    try {
      await withDirectory(async (directory) => {
        await writeFile(join(directory, CONFIG_FILENAME), JSON.stringify({ port: portOf(server) }));
        let launched = false;
        await expect(runCli(["start"], { directory, uiDirectory, launchBrowser: async () => {
          launched = true;
        } })).rejects.toThrow("already in use");
        expect(launched).toBe(false);
      });
    } finally {
      await close(server);
    }
  });

  test("the executable entry point runs under Node", () => {
    const output = execFileSync("node", [join(import.meta.dir, "../src/index.ts"), "--help"], { encoding: "utf8" });
    expect(output).toContain("do-better start");
  });

  test("the HTTP server runs under Node", () => {
    const moduleUrl = new URL("../src/server.ts", import.meta.url).href;
    execFileSync("node", ["--input-type=module", "-e", `
      import { strict as assert } from 'node:assert';
      import { startLocalServer } from ${JSON.stringify(moduleUrl)};
      const server = await startLocalServer(0, { uiDirectory: ${JSON.stringify(uiDirectory)} });
      try {
        const url = 'http://127.0.0.1:' + server.address().port;
        const response = await fetch(url);
        assert.equal(response.status, 200);
        assert.match(await response.text(), /<div id="root">/);
        const route = await fetch(url + '/playground');
        assert.equal(route.status, 200);
        assert.equal((await fetch(url + '/assets/app.js')).status, 200);
      } finally {
        await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    `], { timeout: 10000 });
  });
});
