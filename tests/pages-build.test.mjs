import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages bundle uses the repository base path and contains its data", async () => {
  const output = new URL("../pages-dist/", import.meta.url);
  const html = await readFile(new URL("index.html", output), "utf8");

  assert.match(html, /Cosine Evolution Dataset Explorer/);
  assert.match(html, /\/CosineEvolExplorer\/assets\//);
  await access(new URL("data/index.json", output));
  await access(new URL("data/threads/Beto-02032022-005_thread000.json", output));
  await access(new URL("targets/1ddd98cf2aca9b9ed8beb632.webp", output));
});
