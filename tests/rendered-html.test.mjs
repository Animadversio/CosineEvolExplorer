import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the dataset explorer shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Cosine Evolution Dataset Explorer<\/title>/i);
  assert.match(html, /Loading 309 experiment records/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/i);
});

test("validated population records expose all three activity scales", async () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const index = JSON.parse(await readFile(new URL("data/index.json", publicRoot), "utf8"));
  let available = 0;
  let unitScales = 0;
  let unscalable = 0;

  for (const row of index.threads) {
    if (!row.populationAvailable) continue;
    available += 1;
    const detail = JSON.parse(await readFile(new URL(row.detail.slice(1), publicRoot), "utf8"));
    const population = detail.population;
    const unitCount = population.units.length;
    const generationCount = population.trajectory.length;
    for (const field of ["targetRawHz", "referenceMeanRawHz", "referenceStdRawHz", "targetReferenceZ"]) {
      assert.equal(population[field].length, unitCount, `${row.key}: ${field}`);
    }
    for (const field of ["meanRawHz", "semRawHz", "meanReferenceZ", "semReferenceZ"]) {
      assert.equal(population[field].length, generationCount, `${row.key}: ${field}`);
      assert.ok(population[field].every((vector) => vector.length === unitCount), `${row.key}: ${field} width`);
    }
    population.referenceStdRawHz.forEach((scale, unitIndex) => {
      unitScales += 1;
      if (scale == null || scale <= 1e-8) {
        unscalable += 1;
        assert.equal(population.targetReferenceZ[unitIndex], null);
        assert.ok(population.meanReferenceZ.every((vector) => vector[unitIndex] == null));
      }
    });
  }
  assert.equal(available, 272);
  assert.ok(unscalable > 0 && unscalable / unitScales < 0.01);
});

test("short validated sessions retain descriptive counts and explicit eligibility reasons", async () => {
  const publicRoot = new URL("../public/", import.meta.url);
  const index = JSON.parse(await readFile(new URL("data/index.json", publicRoot), "utf8"));
  assert.ok(index.threads.every((row) => Number.isInteger(row.nGenerations) && row.nGenerations > 0));
  const expected = new Map([
    ["Diablito-15052024-005#thread000", { units: 51, generations: 2 }],
    ["Diablito-20052024-004#thread000", { units: 48, generations: 5 }],
  ]);

  for (const [key, counts] of expected) {
    const row = index.threads.find((item) => item.key === key);
    assert.ok(row, key);
    assert.equal(row.nGenerations, counts.generations, key);
    assert.equal(row.populationAvailable, false, key);
    assert.equal(row.q1bEligible, false, key);
    const detail = JSON.parse(await readFile(new URL(row.detail.slice(1), publicRoot), "utf8"));
    assert.equal(detail.metadata.nObjectiveUnits, counts.units, key);
    assert.equal(detail.metadata.nCompleteGenerations, counts.generations, key);
    assert.equal(detail.status.q1bIneligibilityReason, "fewer_than_8_generations", key);
    assert.equal(detail.population.availability, "unavailable", key);
  }
});
