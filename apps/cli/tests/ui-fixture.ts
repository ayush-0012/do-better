import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const UI_FIXTURE_INDEX =
  '<!doctype html><html><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

export async function createUiFixture() {
  const directory = await mkdtemp(join(tmpdir(), "do-better-ui-"));
  await mkdir(join(directory, "assets"), { recursive: true });
  await mkdir(join(directory, "fonts"), { recursive: true });
  await writeFile(join(directory, "index.html"), UI_FIXTURE_INDEX);
  await writeFile(join(directory, "assets", "app.js"), "console.log('ui');");
  await writeFile(join(directory, "assets", "app.css"), "body { color: black; }");
  await writeFile(join(directory, "fonts", "manrope-variable.ttf"), "fixture-font");
  return directory;
}

export async function removeUiFixture(directory: string) {
  await rm(directory, { recursive: true, force: true });
}
