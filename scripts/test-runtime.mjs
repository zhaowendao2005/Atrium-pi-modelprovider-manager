import assert from "node:assert/strict";
import path from "node:path";
import { getRuntimeStorageDir } from "../src/utils/runtime-storage.ts";
import { parseRecentModels, recordRecentModel, recentKey } from "../src/model-manager-recent.ts";
import { filterAndRankModels } from "../src/model-manager-search.ts";

const home = path.resolve("test-home");
const production = getRuntimeStorageDir({}, home);
assert.equal(getRuntimeStorageDir({ PI_MODEL_MANAGER_ENV: "production" }, home), production);
assert.equal(getRuntimeStorageDir({ PI_MODEL_MANAGER_ENV: "development" }, home), path.join(production, "dev-cache"));
const recent = parseRecentModels(JSON.parse(JSON.stringify(recordRecentModel(recordRecentModel([], "p", "a", 10), "p", "b", 20))));
const times = new Map(recent.map(entry => [recentKey(entry.providerId, entry.modelId), entry.usedAt]));
const items = ["a", "b", "c"].map((id, modelOrder) => ({ providerId: "p", providerName: "Provider", modelId: id, modelName: id, series: "Other", providerOrder: 0, modelOrder, usedAt: times.get(recentKey("p", id)) }));
assert.deepEqual(filterAndRankModels("", items).map(item => item.modelId), ["b", "a", "c"]);
assert.deepEqual(filterAndRankModels("a", items).map(item => item.modelId), ["a"]);
assert.equal(recordRecentModel(recent, "p", "a", 30)[0].usedAt, 30);
console.log("Runtime storage isolation and recent-model ranking tests passed.");
