#!/usr/bin/env node
/**
 * 自测脚本（开发期用，不随插件发布）
 * ---------------------------------------------------------------------------
 * 在没有 Vortex、没有网络的环境里验证核心逻辑：
 *   - 纯函数（变量构造 / 格式化 / reducer 状态迁移）
 *   - GraphQL 客户端（用假的 https 模拟 Nexus 返回，覆盖成功/错误/限流）
 *   - NexusService（缓存、并发去重、错误归一化、文件排序）
 *
 * 用法：node scripts/selftest.js
 */

const assert = require("assert");
const https = require("https");
const { EventEmitter } = require("events");

// ---------------------------------------------------------------------------
// 1) 拦截 https.request，模拟 Nexus
// ---------------------------------------------------------------------------
let requestCount = 0;
let responder = () => ({ status: 200, body: { data: {} } });

https.request = function fakeRequest(options, callback) {
  const req = new EventEmitter();
  let body = "";
  req.write = (chunk) => {
    body += chunk;
  };
  req.setTimeout = () => {};
  req.destroy = () => {};
  req.end = () => {
    requestCount += 1;
    const parsed = JSON.parse(body);
    const reply = responder(parsed.query, parsed.variables);
    const res = new EventEmitter();
    res.statusCode = reply.status;
    process.nextTick(() => {
      callback(res);
      res.emit("data", Buffer.from(JSON.stringify(reply.body)));
      res.emit("end");
    });
  };
  return req;
};

// 必须在 patch 之后再 require 被测模块
const { buildSearchVariables } = require("../dist/nexus/queries");
const { describeError } = require("../dist/nexus/client");
const { NexusService } = require("../dist/nexus/service");
const { reducerSpec, DEFAULTS, nexusBrowserSlice } = require("../dist/state/reducer");
const format = require("../dist/util/format");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error("      " + (err && err.message));
    process.exitCode = 1;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error("      " + (err && err.message));
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 2) 纯函数
// ---------------------------------------------------------------------------
console.log("\n[1] 查询变量构造");
test("有关键词：AND + gameDomainName + nameStemmed(WILDCARD)", () => {
  const vars = buildSearchVariables({
    domain: "skyrimspecialedition",
    query: "weather",
    sortField: "relevance",
    offset: 0,
    count: 24,
  });
  assert.strictEqual(vars.filter.op, "AND");
  assert.strictEqual(vars.filter.filter.length, 2);
  assert.strictEqual(vars.filter.filter[0].gameDomainName[0].value, "skyrimspecialedition");
  assert.strictEqual(vars.filter.filter[1].nameStemmed[0].op, "WILDCARD");
  assert.deepStrictEqual(vars.sort, [{ relevance: { direction: "DESC" } }]);
  assert.strictEqual(vars.count, 24);
});

test("空关键词 + relevance → 回退到 endorsements 排序", () => {
  const vars = buildSearchVariables({
    domain: "skyrimspecialedition",
    query: "   ",
    sortField: "relevance",
    offset: 24,
    count: 24,
  });
  assert.strictEqual(vars.filter.filter.length, 1);
  assert.deepStrictEqual(vars.sort, [{ endorsements: { direction: "DESC" } }]);
  assert.strictEqual(vars.offset, 24);
});

console.log("\n[2] 格式化");
test("formatCount", () => {
  assert.strictEqual(format.formatCount(999), "999");
  assert.strictEqual(format.formatCount(1500), "1.5K");
  assert.strictEqual(format.formatCount(2410000), "2.41M");
  assert.strictEqual(format.formatCount(undefined), "-");
});

test("formatBytes 接受 BigInt 字符串", () => {
  assert.strictEqual(format.formatBytes("56674"), "55.3 KB");
  assert.strictEqual(format.formatBytes(1048576), "1.0 MB");
  assert.strictEqual(format.formatBytes(null), "-");
});

test("formatUnixDate", () => {
  assert.strictEqual(format.formatUnixDate(0), "-");
  assert.match(format.formatUnixDate(1714521600), /^2024-0[45]-\d\d$/);
});

test("bbcodeToPlainText 去掉标记与图片", () => {
  const input = "[b]Hello[/b] [img]http://x/y.png[/img] [url=https://a.b]link[/url]\n\n\n\ntail";
  assert.strictEqual(format.bbcodeToPlainText(input), "Hello  link\n\ntail");
});

// ---------------------------------------------------------------------------
// 3) reducer 状态迁移
// ---------------------------------------------------------------------------
console.log("\n[3] reducer");
const reduce = (state, action) => {
  const fn = reducerSpec.reducers[action.type];
  assert.ok(fn, `未知 action: ${action.type}`);
  return fn(state, action.payload);
};

test("SET_QUERY 重置分页与结果并置 loading", () => {
  const next = reduce({ ...DEFAULTS, page: 3, results: [{ modId: 1 }], totalCount: 99 }, {
    type: "NEXUS_BROWSER_SET_QUERY",
    payload: { query: "armor" },
  });
  assert.strictEqual(next.query, "armor");
  assert.strictEqual(next.page, 0);
  assert.deepStrictEqual(next.results, []);
  assert.strictEqual(next.totalCount, 0);
  assert.strictEqual(next.loading, true);
});

test("LOAD_SUCCESS 落结果并停止 loading", () => {
  const next = reduce({ ...DEFAULTS, loading: true }, {
    type: "NEXUS_BROWSER_LOAD_SUCCESS",
    payload: { domain: "skyrimspecialedition", results: [{ modId: 7 }], totalCount: 42 },
  });
  assert.strictEqual(next.loading, false);
  assert.strictEqual(next.totalCount, 42);
  assert.strictEqual(next.results.length, 1);
  assert.strictEqual(next.domain, "skyrimspecialedition");
});

test("SET_GAME 重置结果但保留排序与自动安装偏好", () => {
  const next = reduce(
    { ...DEFAULTS, sort: "downloads", autoInstall: false, results: [{ modId: 1 }] },
    { type: "NEXUS_BROWSER_SET_GAME", payload: { domain: "fallout4" } },
  );
  assert.strictEqual(next.domain, "fallout4");
  assert.strictEqual(next.results.length, 0);
  assert.strictEqual(next.sort, "downloads");
  assert.strictEqual(next.autoInstall, false);
  assert.strictEqual(next.loading, true);
});

test("CLOSE_DETAIL 清空详情但不影响结果", () => {
  const next = reduce(
    {
      ...DEFAULTS,
      results: [{ modId: 1 }],
      selectedModId: 1,
      detail: { modId: 1 },
      detailError: "boom",
      files: [{ fileId: 2 }],
      detailLoading: true,
    },
    { type: "NEXUS_BROWSER_CLOSE_DETAIL", payload: {} },
  );
  assert.strictEqual(next.selectedModId, undefined);
  assert.strictEqual(next.detail, undefined);
  assert.strictEqual(next.detailError, undefined);
  assert.strictEqual(next.files.length, 0);
  assert.strictEqual(next.detailLoading, false);
  assert.strictEqual(next.results.length, 1);
});

test("SELECT_MOD 只重置详情相关字段，不动列表", () => {
  const next = reduce(
    {
      ...DEFAULTS,
      results: [{ modId: 1 }],
      totalCount: 9,
      selectedModId: 1,
      detail: { modId: 1 },
      detailError: "old",
      files: [{ fileId: 2 }],
    },
    { type: "NEXUS_BROWSER_SELECT_MOD", payload: { modId: 42 } },
  );
  assert.strictEqual(next.selectedModId, 42);
  assert.strictEqual(next.detail, undefined);
  assert.strictEqual(next.detailError, undefined);
  assert.strictEqual(next.files.length, 0);
  assert.strictEqual(next.detailLoading, true);
  assert.strictEqual(next.results.length, 1);
  assert.strictEqual(next.totalCount, 9);
});

test("SET_DETAIL 落详情并清掉错误与 loading", () => {
  const next = reduce(
    { ...DEFAULTS, selectedModId: 7, detailError: "old", detailLoading: true },
    { type: "NEXUS_BROWSER_SET_DETAIL", payload: { detail: { modId: 7, name: "X" } } },
  );
  assert.strictEqual(next.detail.name, "X");
  assert.strictEqual(next.detailError, undefined);
  assert.strictEqual(next.detailLoading, false);
  assert.strictEqual(next.selectedModId, 7);
});

test("SET_DETAIL_ERROR 结束 loading 并保留选中（供 Retry）", () => {
  const next = reduce(
    { ...DEFAULTS, selectedModId: 7, detail: { modId: 7 }, detailLoading: true },
    { type: "NEXUS_BROWSER_SET_DETAIL_ERROR", payload: { message: "网络错误" } },
  );
  assert.strictEqual(next.detail, undefined);
  assert.strictEqual(next.detailError, "网络错误");
  assert.strictEqual(next.detailLoading, false);
  assert.strictEqual(next.selectedModId, 7);
});

test("nexusBrowserSlice 防御式取值", () => {
  assert.deepStrictEqual(nexusBrowserSlice({}), DEFAULTS);
  assert.strictEqual(nexusBrowserSlice({ session: { nexusBrowser: { query: "x" } } }).query, "x");
});

// ---------------------------------------------------------------------------
// 4) GraphQL 客户端 + 服务层（走假的 https）
// ---------------------------------------------------------------------------
const GAME = { id: "1704", name: "Skyrim Special Edition", domainName: "skyrimspecialedition", modCount: 140000 };
const MOD_A = {
  modId: 100,
  uid: "1",
  name: "A Mod",
  summary: "first",
  version: "1.0",
  downloads: 10,
  endorsements: 2,
  adultContent: false,
  pictureUrl: "https://example.invalid/a.jpg",
  game: { id: "1704", domainName: "skyrimspecialedition" },
  uploader: { name: "someone" },
};
const FILES = [
  { fileId: 2, uid: "f2", name: "old", category: 3, primary: 0, sizeInBytes: "10", date: 1000 },
  { fileId: 1, uid: "f1", name: "main", category: 1, primary: 1, sizeInBytes: "20", date: 2000 },
  { fileId: 3, uid: "f3", name: "patch", category: 3, primary: 0, sizeInBytes: "30", date: 3000 },
];

function defaultResponder(query, variables) {
  if (query.includes("ResolveGame")) {
    return { status: 200, body: { data: { game: GAME } } };
  }
  if (query.includes("SearchMods")) {
    return {
      status: 200,
      body: { data: { mods: { totalCount: 1, nodes: [MOD_A] } } },
    };
  }
  if (query.includes("ModDetail")) {
    assert.strictEqual(variables.gameId, "1704", "mod() 必须传数字 gameId");
    return { status: 200, body: { data: { mod: { ...MOD_A, description: "[b]desc[/b]" } } } };
  }
  if (query.includes("ModRequirements")) {
    assert.strictEqual(variables.gameId, "1704", "mod() 必须传数字 gameId");
    return {
      status: 200,
      body: {
        data: {
          mod: {
            modId: 100,
            legacyModRequirementsEnabled: true,
            modRequirements: {
              nexusRequirements: {
                totalCount: 2,
                nodes: [
                  {
                    gameId: "1704",
                    modId: "30379",
                    modName: "SKSE &amp; Tools",
                    notes: "需要 1.6.640+",
                    url: "",
                    externalRequirement: false,
                  },
                  {
                    gameId: "1704",
                    modId: "0",
                    modName: "VC++",
                    notes: "",
                    url: "https://example.invalid/vc",
                    externalRequirement: true,
                  },
                ],
              },
              dlcRequirements: [
                { gameExpansion: { id: "73,1704", name: "Saints &amp; Seducers" }, notes: "" },
              ],
            },
          },
        },
      },
    };
  }
  if (query.includes("ModFiles")) {
    return { status: 200, body: { data: { modFiles: FILES } } };
  }
  return { status: 200, body: { data: {} } };
}

async function main() {
  console.log("\n[4] NexusService（假 https）");

  await testAsync("search 解析 totalCount / nodes", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => "fake-key");
    const result = await service.search({
      domain: "skyrimspecialedition",
      query: "weather",
      sortField: "endorsements",
      offset: 0,
      count: 24,
    });
    assert.strictEqual(result.totalCount, 1);
    assert.strictEqual(result.nodes[0].name, "A Mod");
  });

  await testAsync("相同查询走缓存，不重复请求", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => undefined);
    const options = {
      domain: "skyrimspecialedition",
      query: "armor",
      sortField: "endorsements",
      offset: 0,
      count: 24,
    };
    const before = requestCount;
    await service.search(options);
    await service.search(options);
    assert.strictEqual(requestCount - before, 1, "第二次应命中缓存");
  });

  await testAsync("并发相同查询只发一次（去重）", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => undefined);
    const options = {
      domain: "skyrimspecialedition",
      query: "magic",
      sortField: "endorsements",
      offset: 0,
      count: 24,
    };
    const before = requestCount;
    await Promise.all([service.search(options), service.search(options), service.search(options)]);
    assert.strictEqual(requestCount - before, 1, "并发应合并为一次请求");
  });

  await testAsync("resolveGame 只请求一次，后续详情复用", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => undefined);
    const before = requestCount;
    await service.modDetail("skyrimspecialedition", 100);
    await service.modFiles("skyrimspecialedition", 100);
    // 1 次 ResolveGame + 1 次 ModDetail + 1 次 ModFiles
    assert.strictEqual(requestCount - before, 3);
  });

  await testAsync("modFiles 主文件优先、其余按日期倒序", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => undefined);
    const files = await service.modFiles("skyrimspecialedition", 100);
    assert.deepStrictEqual(files.map((f) => f.fileId), [1, 3, 2]);
  });

  await testAsync("modRequirements 解析 nexus/dlc，第二次命中缓存", async () => {
    responder = defaultResponder;
    const service = new NexusService(() => undefined);
    const before = requestCount;
    const info = await service.modRequirements("skyrimspecialedition", 100);

    assert.strictEqual(info.gameNumericId, "1704");
    assert.strictEqual(info.legacyModRequirementsEnabled, true);
    assert.strictEqual(info.nexus.length, 2);
    assert.strictEqual(info.nexus[0].modId, "30379");
    assert.strictEqual(info.nexus[1].externalRequirement, true);
    assert.strictEqual(info.dlc.length, 1);
    assert.strictEqual(info.totalCount, 2);

    await service.modRequirements("skyrimspecialedition", 100);
    assert.strictEqual(requestCount - before, 2, "ResolveGame + ModRequirements，第二次命中缓存");
  });

  await testAsync("GraphQL errors[] 归一化为 code", async () => {
    responder = () => ({
      status: 200,
      body: {
        errors: [
          {
            message: "You must be logged in",
            extensions: { code: "UNAUTHORIZED" },
          },
        ],
      },
    });
    const service = new NexusService(() => undefined);
    let caught;
    try {
      await service.modDetail("skyrimspecialedition", 999);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, "应当抛错");
    assert.strictEqual(caught.code, "UNAUTHORIZED");
    assert.match(describeError(caught), /登录/);
  });

  await testAsync("HTTP 429 给出可读提示", async () => {
    responder = () => ({ status: 429, body: {} });
    const service = new NexusService(() => undefined);
    let caught;
    try {
      await service.search({
        domain: "x",
        query: "",
        sortField: "endorsements",
        offset: 0,
        count: 1,
      });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught);
    assert.match(describeError(caught), /429/);
  });

  await testAsync("游戏无 Nexus 页面时 resolveGame 返回 undefined", async () => {
    responder = () => ({ status: 200, body: { data: { game: null } } });
    const service = new NexusService(() => undefined);
    const game = await service.resolveGame("somecustomgame");
    assert.strictEqual(game, undefined);
  });

  // -------------------------------------------------------------------------
  // 5) 下载桥接（回归测试）
  //    背景：
  //      - start-download 回调只在**下载完成后**触发；
  //      - 用户关掉「免费账号授权」弹窗时，Vortex 会静默丢弃下载，回调永远不来；
  //      - UI 必须在"下载真的开始"后才显示 Downloading…（onStarted 回调）。
  // -------------------------------------------------------------------------
  const { downloadModFile } = require("../dist/bridge/download.js");
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  console.log("\n[5] 下载桥接");

  function makeBridgeApi(state, onEmit) {
    return {
      getState: () => state,
      events: {
        emit: (...args) => {
          onEmit(args);
        },
      },
      showErrorNotification: () => {},
    };
  }

  await testAsync("关掉授权弹窗（无下载记录）→ 立刻 canceled", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    const api = makeBridgeApi(state, () => {});
    const pending = downloadModFile(
      api,
      {
        domain: "skyrimspecialedition",
        internalGameId: "skyrimse",
        modId: 1,
        fileId: 2,
        autoInstall: false,
      },
      { pollIntervalMs: 80 },
    );

    state.session.nexus.freeUserDLQueue.push("nxm://skyrimspecialedition/mods/1/files/2");
    await wait(180);

    state.session.nexus.freeUserDLQueue.length = 0; // 用户 Skip/取消

    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout", "不应一直挂起");
    assert.strictEqual(outcome.canceled, true);
  });

  await testAsync("下载真的开始时触发一次 onStarted，完成时返回 downloadId", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    let startedCount = 0;
    let startedId;
    const api = makeBridgeApi(state, () => {});

    const pending = downloadModFile(
      api,
      {
        domain: "skyrimspecialedition",
        internalGameId: "skyrimse",
        modId: 7,
        fileId: 8,
        autoInstall: false,
      },
      {
        pollIntervalMs: 80,
        onStarted: (id) => {
          startedCount += 1;
          startedId = id;
        },
      },
    );

    // 还没开始下载 → 不应触发
    await wait(200);
    assert.strictEqual(startedCount, 0, "下载开始前 onStarted 不应触发");

    // 下载记录出现（started）→ 触发一次
    state.persistent.downloads.files["dl-9"] = { modInfo: { modId: 7, fileId: 8 }, state: "started" };
    await wait(200);
    assert.strictEqual(startedCount, 1, "下载开始时 onStarted 应触发一次");
    assert.strictEqual(startedId, "dl-9");

    // 记录变成 finished → 结束（且 onStarted 不再触发）
    state.persistent.downloads.files["dl-9"].state = "finished";
    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout");
    assert.strictEqual(outcome.downloadId, "dl-9");
    assert.strictEqual(startedCount, 1);
  });

  await testAsync("下载记录中途消失 → canceled（用户删了下载）", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    const api = makeBridgeApi(state, () => {});
    const pending = downloadModFile(
      api,
      {
        domain: "skyrimspecialedition",
        internalGameId: "skyrimse",
        modId: 11,
        fileId: 12,
        autoInstall: false,
      },
      { pollIntervalMs: 80 },
    );

    state.persistent.downloads.files["dl-11"] = {
      modInfo: { modId: 11, fileId: 12 },
      state: "started",
    };
    await wait(180);
    delete state.persistent.downloads.files["dl-11"];

    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout");
    assert.strictEqual(outcome.canceled, true);
  });

  await testAsync("一直没开始下载 → startTimeout 后返回 pending", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    const api = makeBridgeApi(state, () => {});
    const pending = downloadModFile(
      api,
      {
        domain: "skyrimspecialedition",
        internalGameId: "skyrimse",
        modId: 21,
        fileId: 22,
        autoInstall: false,
      },
      { startTimeoutMs: 250, pollIntervalMs: 80 },
    );

    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout");
    assert.strictEqual(outcome.pending, true);
  });

  await testAsync("下载已开始后不会被 startTimeout 打断", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    const api = makeBridgeApi(state, () => {});
    const pending = downloadModFile(
      api,
      {
        domain: "skyrimspecialedition",
        internalGameId: "skyrimse",
        modId: 23,
        fileId: 24,
        autoInstall: false,
      },
      { startTimeoutMs: 200, pollIntervalMs: 60 },
    );

    state.persistent.downloads.files["dl-23"] = {
      modInfo: { modId: 23, fileId: 24 },
      state: "started",
    };

    // 超过 startTimeout 后仍不应结束（下载进行中）
    const early = await Promise.race([pending.then(() => "done"), wait(600).then(() => "waiting")]);
    assert.strictEqual(early, "waiting", "下载已开始时不应超时");

    state.persistent.downloads.files["dl-23"].state = "finished";
    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.strictEqual(outcome.downloadId, "dl-23");
  });

  await testAsync("下载开始的回调返回 downloadId", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    let captured;
    const api = makeBridgeApi(state, (args) => {
      captured = args;
    });

    const pending = downloadModFile(api, {
      domain: "skyrimspecialedition",
      internalGameId: "skyrimse",
      modId: 3,
      fileId: 4,
      autoInstall: false,
    });

    assert.ok(captured, "应发出 start-download 事件");
    assert.strictEqual(captured[0], "start-download");
    assert.strictEqual(captured[1][0], "nxm://skyrimspecialedition/mods/3/files/4");
    captured[4](null, "dl-1");

    const outcome = await pending;
    assert.strictEqual(outcome.downloadId, "dl-1");
    assert.strictEqual(outcome.canceled, undefined);
  });

  await testAsync("回调返回 UserCanceled → canceled", async () => {
    const state = {
      session: { nexus: { freeUserDLQueue: [] } },
      persistent: { downloads: { files: {} } },
    };
    let captured;
    const api = makeBridgeApi(state, (args) => {
      captured = args;
    });

    const pending = downloadModFile(api, {
      domain: "skyrimspecialedition",
      internalGameId: "skyrimse",
      modId: 5,
      fileId: 6,
      autoInstall: false,
    });

    const canceledError = new Error("canceled");
    canceledError.name = "UserCanceled";
    captured[4](canceledError);

    const outcome = await pending;
    assert.strictEqual(outcome.canceled, true);
  });

  // -------------------------------------------------------------------------
  // 6) 已安装判定（util/mods）：只认 attributes.modId，不认名字，排除合集
  // -------------------------------------------------------------------------
  const { installedNexusModIds, isNexusModInstalled } = require("../dist/util/mods.js");

  console.log("\n[6] 已安装判定");

  test("只认 attributes.modId；合集不算已安装", () => {
    const state = {
      persistent: {
        mods: {
          skyrimse: {
            "internal-a": { attributes: { modId: 123, source: "nexus" } },
            "internal-b": { attributes: { modId: 456 } },
            "internal-c": { type: "collection", attributes: { modId: 999 } },
            "internal-d": { attributes: {} },
            "internal-e": {},
          },
        },
      },
    };
    const ids = installedNexusModIds(state, "skyrimse");
    assert.deepStrictEqual(ids.sort((a, b) => a - b), [123, 456]);
    assert.strictEqual(isNexusModInstalled(state, "skyrimse", 123), true);
    assert.strictEqual(isNexusModInstalled(state, "skyrimse", 999), false, "合集不算已安装");
    assert.strictEqual(isNexusModInstalled(state, "skyrimse", 1234), false);
  });

  test("不同游戏不串味 + 防御空 state", () => {
    const state = {
      persistent: {
        mods: {
          skyrimse: { a: { attributes: { modId: 1 } } },
          fallout4: { b: { attributes: { modId: 2 } } },
        },
      },
    };
    assert.deepStrictEqual(installedNexusModIds(state, "fallout4"), [2]);
    assert.deepStrictEqual(installedNexusModIds(state, undefined), []);
    assert.deepStrictEqual(installedNexusModIds({}, "skyrimse"), []);
  });

  // -------------------------------------------------------------------------
  // 7) 文件分类工具（util/modFiles）：兼容数字 / 枚举名两种返回
  // -------------------------------------------------------------------------
  const { isMainFile, describeFileCategory, compareModFiles } = require("../dist/util/modFiles.js");

  console.log("\n[7] 文件分类");

  test('主文件判定兼容 1 / "MAIN" / primary', () => {
    assert.strictEqual(isMainFile({ fileId: 1, category: 1 }), true);
    assert.strictEqual(isMainFile({ fileId: 1, category: "MAIN" }), true);
    assert.strictEqual(isMainFile({ fileId: 1, category: "main" }), true);
    assert.strictEqual(isMainFile({ fileId: 1, category: 3 }), false);
    assert.strictEqual(isMainFile({ fileId: 1, category: "OPTIONAL" }), false);
    assert.strictEqual(isMainFile({ fileId: 1, primary: 1 }), true, "primary 兜底");
    assert.strictEqual(isMainFile(undefined), false);
  });

  test("分类标签", () => {
    assert.strictEqual(describeFileCategory(3).label, "可选文件");
    assert.strictEqual(describeFileCategory("OLD_VERSION").label, "旧版本");
    assert.strictEqual(describeFileCategory(99), undefined);
    assert.strictEqual(describeFileCategory(undefined), undefined);
  });

  test("排序：主文件优先，其余按日期倒序（字符串枚举也生效）", () => {
    const files = [
      { fileId: 1, category: "OPTIONAL", date: 300 },
      { fileId: 2, category: "MAIN", date: 100 },
      { fileId: 3, category: 3, date: 200 },
    ];
    const sorted = files.slice().sort(compareModFiles);
    assert.deepStrictEqual(sorted.map((f) => f.fileId), [2, 1, 3]);
  });

  // -------------------------------------------------------------------------
  // 8) 选文件（ui/chooseFile）：只认 MAIN；多个 MAIN 才弹窗
  // -------------------------------------------------------------------------
  const { chooseModFile, mainFilesOf, CHOOSE_FILE_ACTION } = require("../dist/ui/chooseFile.js");

  console.log("\n[8] 选文件");

  function fakeDialogApi(reply) {
    const calls = [];
    return {
      calls,
      showDialog: async (...args) => {
        calls.push(args);
        return reply;
      },
    };
  }

  const MAIN_A = { fileId: 11, name: "R18 Version", category: "MAIN", version: "1.0", sizeInBytes: "1000", date: 100 };
  const MAIN_B = { fileId: 12, name: "Non-R18 Version", category: 1, version: "1.0", sizeInBytes: "900", date: 200, primary: 1 };
  const OPTIONAL = { fileId: 13, name: "Old 0.9", category: "OPTIONAL", version: "0.9", sizeInBytes: "800", date: 50 };
  const OLD = { fileId: 14, name: "Archived", category: "OLD_VERSION", version: "0.1", sizeInBytes: "700", date: 10 };

  test("mainFilesOf 只保留主文件（数字/枚举名都认）", () => {
    const mains = mainFilesOf([MAIN_A, MAIN_B, OPTIONAL, OLD]);
    assert.deepStrictEqual(mains.map((f) => f.fileId), [11, 12]);
  });

  await testAsync("只有一个主文件：不弹窗，直接返回", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.download, input: {} });
    const file = await chooseModFile(api, "Test", [OPTIONAL, MAIN_A]);
    assert.strictEqual(file.fileId, 11);
    assert.strictEqual(api.calls.length, 0, "不应弹窗");
  });

  await testAsync("多个主文件：弹窗，选项只含主文件，默认选中 primary", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.download, input: { "file-12": true } });
    const file = await chooseModFile(api, "Test", [MAIN_A, MAIN_B, OPTIONAL, OLD]);

    assert.strictEqual(api.calls.length, 1, "应弹一次窗");
    const [type, title, content, actions] = api.calls[0];
    assert.strictEqual(type, "question");
    assert.ok(String(title).length > 0);
    assert.strictEqual(content.choices.length, 2, "只列主文件，不含 optional/old");
    assert.deepStrictEqual(
      content.choices.map((c) => c.id),
      ["file-11", "file-12"],
    );
    const preselected = content.choices.filter((c) => c.value === true);
    assert.strictEqual(preselected.length, 1, "应恰好预选一个");
    assert.strictEqual(preselected[0].id, "file-12", "预选 primary=1 的那个");
    assert.ok(content.choices[0].subText.indexOf("主文件") !== -1, "副标题应带分类");
    assert.strictEqual(actions[1].label, CHOOSE_FILE_ACTION.download);
    // 不设默认按钮：避免宿主 autoFocus 让 Download 一直高亮
    assert.strictEqual(actions[0].default, undefined, "Cancel 不应是默认按钮");
    assert.strictEqual(actions[1].default, undefined, "Download 也不应设默认，避免 autoFocus");
    // 文案是英文（零宽空格只是为了绕开宿主 i18n，不显示出来）
    assert.strictEqual(actions[0].label.replace(/\u200B/g, ""), "Cancel");
    assert.strictEqual(actions[1].label.replace(/\u200B/g, ""), "Download");

    assert.strictEqual(file.fileId, 12);
  });

  await testAsync("用户选了另一个主文件", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.download, input: { "file-11": true } });
    const file = await chooseModFile(api, "Test", [MAIN_A, MAIN_B]);
    assert.strictEqual(file.fileId, 11);
  });

  await testAsync("用户点取消：返回 undefined", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.cancel, input: {} });
    const file = await chooseModFile(api, "Test", [MAIN_A, MAIN_B]);
    assert.strictEqual(file, undefined);
  });

  await testAsync("没有主文件：退回按日期最新的文件", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.download, input: {} });
    const file = await chooseModFile(api, "Test", [OPTIONAL, OLD]);
    assert.strictEqual(file.fileId, 13, "OPTIONAL 日期 50 > OLD 日期 10");
    assert.strictEqual(api.calls.length, 0, "不应弹窗");
  });

  await testAsync("空文件列表：返回 undefined", async () => {
    const api = fakeDialogApi({ action: CHOOSE_FILE_ACTION.download, input: {} });
    const file = await chooseModFile(api, "Test", []);
    assert.strictEqual(file, undefined);
  });

  // -------------------------------------------------------------------------
  // 9) 免费账号走浏览器（跳过宿主授权弹窗）
  // -------------------------------------------------------------------------
  const {
    downloadViaBrowser,
    downloadForUser,
    DEFAULT_START_TIMEOUT_MS,
  } = require("../dist/bridge/download.js");

  console.log("\n[9] 免费账号下载路径");

  function browserState(premium) {
    return {
      session: {},
      persistent: {
        downloads: { files: {} },
        nexus: { userInfo: { isPremium: premium } },
      },
    };
  }

  await testAsync("开浏览器而不是 emit start-download；记录出现即 onStarted，finished 返回 id", async () => {
    const state = browserState(false);
    let emitted = 0;
    let openedUrl;
    let started = 0;

    const api = {
      getState: () => state,
      events: {
        emit: () => {
          emitted += 1;
        },
      },
      showErrorNotification: () => {},
    };

    const pending = downloadViaBrowser(
      api,
      { domain: "skyrimspecialedition", internalGameId: "skyrimse", modId: 9, fileId: 10, autoInstall: false },
      {
        openBrowser: (url) => {
          openedUrl = url;
        },
        pollIntervalMs: 60,
        startTimeoutMs: 5000,
        onStarted: () => {
          started += 1;
        },
      },
    );

    assert.ok(openedUrl.indexOf("/mods/9") !== -1, "应打开该 mod 的文件页");
    assert.ok(openedUrl.indexOf("nmm=1") !== -1, "必须带 nmm=1");
    assert.strictEqual(emitted, 0, "不应 emit start-download（否则会弹宿主授权框）");

    await wait(150);
    assert.strictEqual(started, 0, "下载未开始时不应切换按钮");

    state.persistent.downloads.files["d9"] = { modInfo: { modId: 9, fileId: 10 }, state: "started" };
    await wait(150);
    assert.strictEqual(started, 1, "记录出现后应触发一次 onStarted");

    state.persistent.downloads.files["d9"].state = "finished";
    const outcome = await Promise.race([pending, wait(3000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout");
    assert.strictEqual(outcome.downloadId, "d9");
  });

  await testAsync("一直没开始下载 → 超时 pending", async () => {
    const state = browserState(false);
    const api = { getState: () => state, events: { emit: () => {} }, showErrorNotification: () => {} };

    const outcome = await downloadViaBrowser(
      api,
      { domain: "x", internalGameId: "g", modId: 1, fileId: 2, autoInstall: false },
      { openBrowser: () => {}, pollIntervalMs: 50, startTimeoutMs: 200 },
    );

    assert.strictEqual(outcome.pending, true);
  });

  await testAsync("downloadForUser：免费 → 开浏览器；Premium → emit start-download", async () => {
    // 免费
    const freeState = browserState(false);
    let freeOpened = 0;
    let freeEmitted = 0;
    const freeApi = {
      getState: () => freeState,
      events: { emit: () => { freeEmitted += 1; } },
      showErrorNotification: () => {},
    };
    void downloadForUser(
      freeApi,
      { domain: "x", internalGameId: "g", modId: 1, fileId: 2, autoInstall: false },
      { openBrowser: () => { freeOpened += 1; }, pollIntervalMs: 50, startTimeoutMs: 120 },
    );
    await wait(60);
    assert.strictEqual(freeOpened, 1, "免费账号应打开浏览器");
    assert.strictEqual(freeEmitted, 0, "免费账号不应 emit");

    // Premium
    const premiumState = browserState(true);
    let premiumOpened = 0;
    let premiumEmitted = 0;
    const premiumApi = {
      getState: () => premiumState,
      events: {
        emit: (...args) => {
          if (args[0] === "start-download") {
            premiumEmitted += 1;
          }
        },
      },
      showErrorNotification: () => {},
    };
    void downloadForUser(
      premiumApi,
      { domain: "x", internalGameId: "g", modId: 3, fileId: 4, autoInstall: false },
      { openBrowser: () => { premiumOpened += 1; }, pollIntervalMs: 50, startTimeoutMs: 120 },
    );
    await wait(60);
    assert.strictEqual(premiumEmitted, 1, "Premium 应走 start-download");
    assert.strictEqual(premiumOpened, 0, "Premium 不应打开浏览器");
  });

  await testAsync("会员信息未加载 → 交给宿主（emit），不擅自开浏览器", async () => {
    const state = { session: {}, persistent: { downloads: { files: {} }, nexus: {} } };
    let opened = 0;
    let emitted = 0;
    const api = {
      getState: () => state,
      events: {
        emit: (...args) => {
          if (args[0] === "start-download") {
            emitted += 1;
          }
        },
      },
      showErrorNotification: () => {},
    };

    void downloadForUser(
      api,
      { domain: "x", internalGameId: "g", modId: 7, fileId: 8, autoInstall: false },
      { openBrowser: () => { opened += 1; }, pollIntervalMs: 50, startTimeoutMs: 100 },
    );
    await wait(60);

    assert.strictEqual(opened, 0, "信息未知时不应擅自开浏览器");
    assert.strictEqual(emitted, 1, "应交给宿主 start-download");
  });

  await testAsync("宿主 nxm 下载的记录把 id 放在 nexus.ids 里，也能被识别", async () => {
    const state = {
      session: {},
      persistent: { downloads: { files: {} }, nexus: { userInfo: { isPremium: false } } },
    };
    let started = 0;
    const api = { getState: () => state, events: { emit: () => {} }, showErrorNotification: () => {} };

    const pending = downloadViaBrowser(
      api,
      { domain: "x", internalGameId: "g", modId: 9, fileId: 10, autoInstall: false },
      { openBrowser: () => {}, pollIntervalMs: 50, startTimeoutMs: 5000, onStarted: () => { started += 1; } },
    );

    // 关键：没有顶层 modId/fileId，只有 nexus.ids
    state.persistent.downloads.files["d9"] = {
      modInfo: { source: "nexus", nexus: { ids: { modId: 9, fileId: 10 } } },
      state: "started",
    };
    await wait(150);
    assert.strictEqual(started, 1, "嵌套结构也应触发 onStarted");

    state.persistent.downloads.files["d9"].state = "finished";
    const outcome = await Promise.race([pending, wait(3000).then(() => "timeout")]);
    assert.strictEqual(outcome.downloadId, "d9");
  });

  test("两条路径的等待超时统一为 2 分钟", () => {
    assert.strictEqual(DEFAULT_START_TIMEOUT_MS, 2 * 60 * 1000);
  });

  await testAsync("已安装过就不再重复安装", async () => {
    const state = {
      session: {},
      persistent: {
        downloads: { files: {} },
        nexus: { userInfo: { isPremium: false } },
        mods: { g: { existing: { attributes: { modId: 9 } } } },
      },
    };
    const emitted = [];
    const api = {
      getState: () => state,
      events: { emit: (...args) => { emitted.push(args[0]); } },
      showErrorNotification: () => {},
    };

    const pending = downloadViaBrowser(
      api,
      { domain: "x", internalGameId: "g", modId: 9, fileId: 10, autoInstall: true },
      { openBrowser: () => {}, pollIntervalMs: 50, startTimeoutMs: 5000 },
    );

    state.persistent.downloads.files["d9"] = {
      modInfo: { nexus: { ids: { modId: 9, fileId: 10 } } },
      state: "finished",
    };

    const outcome = await Promise.race([pending, wait(3000).then(() => "timeout")]);
    assert.strictEqual(outcome.downloadId, "d9");
    assert.strictEqual(emitted.indexOf("start-install-download"), -1, "已安装过不应再装一次");
  });

  await testAsync("cancel() 作废等待：停止轮询且不安装", async () => {
    const state = {
      session: {},
      persistent: { downloads: { files: {} }, nexus: { userInfo: { isPremium: false } } },
    };
    const emitted = [];
    const api = {
      getState: () => state,
      events: { emit: (...args) => { emitted.push(args[0]); } },
      showErrorNotification: () => {},
    };

    let canceled = false;
    const pending = downloadViaBrowser(
      api,
      { domain: "x", internalGameId: "g", modId: 5, fileId: 6, autoInstall: true },
      {
        openBrowser: () => {},
        pollIntervalMs: 50,
        startTimeoutMs: 5000,
        cancel: () => canceled,
      },
    );

    await wait(80);
    canceled = true;
    const outcome = await Promise.race([pending, wait(2000).then(() => "timeout")]);
    assert.notStrictEqual(outcome, "timeout", "cancel 后应立即结束");
    assert.strictEqual(outcome.canceled, true);
    assert.strictEqual(emitted.indexOf("start-install-download"), -1, "作废后不应安装");
  });

  await testAsync("超时返回 timedOut（页面据此提示可直接重试）", async () => {
    const state = { session: {}, persistent: { downloads: { files: {} }, nexus: {} } };
    const api = { getState: () => state, events: { emit: () => {} }, showErrorNotification: () => {} };
    const outcome = await downloadViaBrowser(
      api,
      { domain: "x", internalGameId: "g", modId: 1, fileId: 2, autoInstall: false },
      { openBrowser: () => {}, pollIntervalMs: 40, startTimeoutMs: 120 },
    );
    assert.strictEqual(outcome.pending, true);
    assert.strictEqual(outcome.timedOut, true);
  });

  console.log("\n[10] 详情弹窗数据（图片兜底 / 简介回退 / 换行归一化）");
  const detailUtil = require("../dist/util/detail");

  test("主图三级兜底：保序、去空、去重", () => {
    assert.deepStrictEqual(
      detailUtil.detailImageSources({
        pictureUrl: "https://p/main.png",
        thumbnailLargeUrl: "https://p/large.png",
        thumbnailUrl: "https://p/small.png",
      }),
      ["https://p/main.png", "https://p/large.png", "https://p/small.png"],
    );
    // 热门 MOD 常见的"主图为 null"：自动把大缩略图顶到第一位
    assert.deepStrictEqual(
      detailUtil.detailImageSources({ pictureUrl: null, thumbnailLargeUrl: "https://p/large.png" }),
      ["https://p/large.png"],
    );
    // 重复 URL 只留一份；空白串当没有
    assert.deepStrictEqual(
      detailUtil.detailImageSources({
        pictureUrl: "https://p/main.png",
        thumbnailLargeUrl: "https://p/main.png",
        thumbnailUrl: "   ",
      }),
      ["https://p/main.png"],
    );
    assert.deepStrictEqual(detailUtil.detailImageSources({}), []);
    assert.deepStrictEqual(detailUtil.detailImageSources(undefined), []);
  });

  test("简介回退链：description → summary → 兜底文案", () => {
    assert.strictEqual(
      detailUtil.detailBody({ description: "[b]full[/b]", summary: "short" }),
      "[b]full[/b]",
    );
    assert.strictEqual(detailUtil.detailBody({ description: "   ", summary: "short" }), "short");
    assert.strictEqual(detailUtil.detailBody({ description: "", summary: "" }), detailUtil.EMPTY_DESCRIPTION);
    assert.strictEqual(detailUtil.detailBody(undefined), detailUtil.EMPTY_DESCRIPTION);
    // 只有 <br /> 的描述渲染出来是空白 → 也算"没提供简介"
    assert.strictEqual(detailUtil.detailBody({ description: "<br />", summary: "" }), detailUtil.EMPTY_DESCRIPTION);
  });

  test("换行归一化成成对的 [br][/br]（裸 \\n 不丢、不双倍）", () => {
    // 真实 N 网样本：BBCode + \n<br />，每个 <br> 前都带裸 \n
    const real =
      "[center][img]https://x/a.png[/img][/center]\n<br />[b]Features[/b]\n<br />" +
      "[list]\n<br />[*]One[/*]\n<br />[/list]";
    const normalized = detailUtil.normalizeDetailText(real);

    assert.strictEqual(normalized.indexOf("<br"), -1, "不应残留 HTML <br>");
    assert.strictEqual(
      (normalized.match(/\[br\]\[\/br\]/g) || []).length,
      4,
      "4 个换行应变成 4 个 [br][/br]（没有因为 \\n + <br> 而翻倍）",
    );
    // 关键：每个 [br] 必须成对，否则宿主的解析器会把后续正文吞进 BrTag
    assert.strictEqual(/\[br\](?!\[\/br\])/.test(normalized), false, "[br] 必须成对出现");
    assert.ok(normalized.indexOf("[b]Features[/b]") !== -1, "正文不能被吞掉");
  });

  test("换行归一化：裸换行、CRLF、首尾空行", () => {
    assert.strictEqual(detailUtil.normalizeDetailText("A\nB"), "A[br][/br]B");
    assert.strictEqual(detailUtil.normalizeDetailText("A\r\n<br />B"), "A[br][/br]B");
    assert.strictEqual(detailUtil.normalizeDetailText("\n<br />A\n<br />\n<br />"), "A");
    assert.strictEqual(detailUtil.normalizeDetailText(""), "");
    assert.strictEqual(detailUtil.normalizeDetailText(undefined), "");
  });

  test("元信息：作者 · 版本 · 下载 · 点赞（缺项自动省略）", () => {
    assert.strictEqual(
      detailUtil.detailMeta({
        uploader: { name: "Stracker" },
        version: "1.24",
        downloads: 1284000,
        endorsements: 21800,
      }),
      "Stracker  ·  v1.24  ·  1.28M 次下载  ·  21.8K 点赞",
    );
    assert.strictEqual(detailUtil.detailMeta({ author: "Solo" }), "Solo");
    assert.strictEqual(detailUtil.detailMeta({}), "");
    assert.strictEqual(detailUtil.detailMeta(undefined), "");
  });

  console.log("\n[11] 前置弹窗数据（行模型 / 手动标记 / 选文件 / 偏好）");
  const reqUtil = require("../dist/util/requirements");
  const prefsState = require("../dist/state/prefs");
  const modsUtil = require("../dist/util/mods");
  const fileUtil = require("../dist/util/modFiles");

  const REQ_INFO = {
    gameNumericId: "1704",
    legacyModRequirementsEnabled: true,
    totalCount: 7,
    nexus: [
      {
        gameId: "1704",
        modId: "30379",
        modName: "SKSE &amp; Tools",
        notes: "需要 1.6.640+",
        url: "",
        externalRequirement: false,
      },
      { gameId: "1704", modId: "266", modName: "USSEP", externalRequirement: false },
      { gameId: "1704", modId: "999", modName: "Manual Mod", externalRequirement: false },
      { gameId: "1704", modId: "123", modName: "Installed Mod", externalRequirement: false },
      {
        gameId: "1704",
        modId: "0",
        modName: "VC++ &amp; .NET",
        url: "https://example.invalid/vc",
        externalRequirement: true,
      },
      { gameId: "9999", modId: "555", modName: "Cross Game", url: "", externalRequirement: false },
      { gameId: "1704", modId: "100", modName: "Self", externalRequirement: false },
    ],
    dlc: [
      { gameExpansion: { id: "73,1704", name: "Saints &amp; Seducers" }, notes: "" },
      { gameExpansion: { id: "73,1704", name: "Saints &amp; Seducers" }, notes: "" },
    ],
  };

  const buildRows = (info) =>
    reqUtil.buildRequirementRows({
      info,
      installed: new Map([[123, { version: "1.2.3" }]]),
      manual: [999],
      domain: "skyrimspecialedition",
      selfModId: 100,
    });

  test("前置行模型：分类 / 排序 / 链接 / 本地版本", () => {
    const rows = buildRows(REQ_INFO);
    assert.deepStrictEqual(
      rows.map((row) => row.kind),
      ["missing", "missing", "manual", "installed", "external", "otherGame"],
    );
    assert.strictEqual(rows[0].name, "SKSE & Tools");
    assert.strictEqual(
      rows[0].url,
      "https://www.nexusmods.com/skyrimspecialedition/mods/30379",
    );
    assert.strictEqual(rows[0].notes, "需要 1.6.640+");
    assert.strictEqual(rows[2].kind, "manual");
    assert.strictEqual(rows[2].downloadable, false, "不再提醒的行不参与下载");
    assert.strictEqual(rows[3].localVersion, "1.2.3");
    assert.strictEqual(rows[3].downloadable, false);
    assert.strictEqual(rows[4].modId, 0);
    assert.strictEqual(rows[4].url, "https://example.invalid/vc");
    assert.strictEqual(rows[5].url, undefined);
    // 自己依赖自己要被丢掉
    assert.strictEqual(rows.some((row) => row.name === "Self"), false);
  });

  test("DLC 去重 + 实体解码", () => {
    const dlc = reqUtil.buildDlcRows(REQ_INFO);
    assert.strictEqual(dlc.length, 1);
    assert.strictEqual(dlc[0].name, "Saints & Seducers");
  });

  test("默认勾选只包含未安装项", () => {
    const rows = buildRows(REQ_INFO);
    assert.deepStrictEqual(reqUtil.defaultSelectedModIds(rows), [30379, 266]);
    assert.deepStrictEqual(
      reqUtil.downloadableRows(rows).map((row) => row.modId),
      [30379, 266],
    );
  });

  test("不再提醒：勾上=mark，取消=unmark", () => {
    assert.deepStrictEqual(reqUtil.diffIgnoredMarks([999], [999, 30379]), {
      mark: [30379],
      unmark: [],
    });
    assert.deepStrictEqual(reqUtil.diffIgnoredMarks([999], []), {
      mark: [],
      unmark: [999],
    });
    assert.deepStrictEqual(reqUtil.diffIgnoredMarks([], []), { mark: [], unmark: [] });
    assert.deepStrictEqual(reqUtil.diffIgnoredMarks([1, 2], [2, 3]), {
      mark: [3],
      unmark: [1],
    });
  });

  test("只有未安装的 Nexus 前置才弹窗（已装/DLC/站外不触发）", () => {
    const onlyInstalled = reqUtil.buildRequirementRows({
      info: { ...REQ_INFO, nexus: [REQ_INFO.nexus[3]], dlc: [] },
      installed: new Map([[123, { version: "1" }]]),
      manual: [],
      domain: "d",
      selfModId: 1,
    });
    assert.strictEqual(onlyInstalled[0].kind, "installed");
    assert.strictEqual(reqUtil.hasRequirementsPrompt(onlyInstalled, []), false);
    // 只剩已安装 + DLC：不弹（DLC 只在弹窗因未安装前置打开时附带显示）
    assert.strictEqual(reqUtil.hasRequirementsPrompt(onlyInstalled, [{ name: "DLC" }]), false);

    // 只剩"不再提醒"的前置 → 不再弹窗
    const onlyIgnored = reqUtil.buildRequirementRows({
      info: { ...REQ_INFO, nexus: [REQ_INFO.nexus[2]], dlc: [] },
      installed: new Map(),
      manual: [999],
      domain: "d",
      selfModId: 1,
    });
    assert.strictEqual(onlyIgnored[0].kind, "manual");
    assert.strictEqual(reqUtil.hasRequirementsPrompt(onlyIgnored, []), false);

    // 只有站外组件 → 不弹
    const onlyExternal = reqUtil.buildRequirementRows({
      info: { ...REQ_INFO, nexus: [REQ_INFO.nexus[4]], dlc: [] },
      installed: new Map(),
      manual: [],
      domain: "d",
      selfModId: 1,
    });
    assert.strictEqual(onlyExternal[0].kind, "external");
    assert.strictEqual(reqUtil.hasRequirementsPrompt(onlyExternal, []), false);

    // 有未安装的 Nexus 前置 → 弹（DLC 一起显示）
    const rows = buildRows(REQ_INFO);
    assert.strictEqual(reqUtil.hasRequirementsPrompt(rows, []), true);
    assert.strictEqual(reqUtil.hasRequirementsPrompt(rows, [{ name: "DLC" }]), true);
  });

  test("行状态文案", () => {
    const rows = buildRows(REQ_INFO);
    assert.strictEqual(reqUtil.rowStatusLabel(rows[0]), "未安装");
    assert.strictEqual(reqUtil.rowStatusLabel(rows[2]), "不再提醒");
    assert.strictEqual(reqUtil.rowStatusLabel(rows[3]), "已安装 v1.2.3");
    assert.strictEqual(reqUtil.rowStatusLabel(rows[4]), "站外组件");
    assert.strictEqual(reqUtil.rowStatusLabel(rows[5]), "其他游戏");
  });

  test("pickPrimaryFile：primary → 最新 MAIN → 最新文件", () => {
    const mains = [
      { fileId: 10, name: "new-main", category: "MAIN", primary: 0, date: 300 },
      { fileId: 11, name: "primary-main", category: "MAIN", primary: 1, date: 100 },
      { fileId: 12, name: "optional", category: "OPTIONAL", primary: 0, date: 400 },
    ];
    assert.strictEqual(fileUtil.pickPrimaryFile(mains).fileId, 11);
    assert.strictEqual(fileUtil.pickPrimaryFile([mains[0], mains[2]]).fileId, 10);
    assert.strictEqual(fileUtil.pickPrimaryFile([mains[2]]).fileId, 12);
    assert.strictEqual(fileUtil.pickPrimaryFile([]), undefined);
    assert.strictEqual(fileUtil.pickPrimaryFile(undefined), undefined);
  });

  test("installedNexusMods 带本地版本，排除合集", () => {
    const state = {
      persistent: {
        mods: {
          skyrimse: {
            a: { attributes: { modId: 1, version: "1.0" } },
            b: { attributes: { modId: 1 } },
            c: { type: "collection", attributes: { modId: 2, version: "2.0" } },
            d: { attributes: { modId: 3, version: "3.0" } },
            e: {},
          },
        },
      },
    };
    const map = modsUtil.installedNexusMods(state, "skyrimse");
    assert.strictEqual(map.get(1).version, "1.0");
    assert.strictEqual(map.has(2), false);
    assert.strictEqual(map.get(3).version, "3.0");
    assert.deepStrictEqual(modsUtil.installedNexusModIds(state, "skyrimse"), [1, 3]);
  });

  test("手动安装标记：去重 / 排序 / 删除空域名", () => {
    const reducePrefs = (state, action) =>
      prefsState.prefsReducerSpec.reducers[action.type](state, action.payload);
    let state = prefsState.PREFS_DEFAULTS;
    state = reducePrefs(
      state,
      prefsState.prefsActions.markManualRequirement("skyrimspecialedition", 30379),
    );
    state = reducePrefs(
      state,
      prefsState.prefsActions.markManualRequirement("skyrimspecialedition", 30379),
    );
    state = reducePrefs(
      state,
      prefsState.prefsActions.markManualRequirement("skyrimspecialedition", 266),
    );
    assert.deepStrictEqual(state.manualRequirements["skyrimspecialedition"], [266, 30379]);

    state = reducePrefs(
      state,
      prefsState.prefsActions.unmarkManualRequirement("skyrimspecialedition", 30379),
    );
    assert.deepStrictEqual(state.manualRequirements["skyrimspecialedition"], [266]);

    state = reducePrefs(
      state,
      prefsState.prefsActions.unmarkManualRequirement("skyrimspecialedition", 266),
    );
    assert.deepStrictEqual(state.manualRequirements, {});
    assert.deepStrictEqual(prefsState.prefsSlice({}), prefsState.PREFS_DEFAULTS);
  });

  await testAsync("buildRequirementsPromptData：查询 + 行模型 + DLC", async () => {
    responder = defaultResponder;
    const prompt = require("../dist/ui/requirementsPrompt");
    const api = { getState: () => ({}), sendNotification: () => {} };

    const data = await prompt.buildRequirementsPromptData(api, {
      domain: "skyrimspecialedition",
      internalGameId: "skyrimse",
      modId: 100,
      modName: "A Mod",
      installed: new Map(),
      manual: [],
    });

    assert.ok(data, "应返回弹窗数据");
    assert.strictEqual(data.modName, "A Mod");
    assert.deepStrictEqual(data.rows.map((row) => row.kind), ["missing", "external"]);
    assert.deepStrictEqual(data.defaultSelected, [30379]);
    assert.strictEqual(data.dlc.length, 1);
    assert.strictEqual(data.dlc[0].name, "Saints & Seducers");
    assert.strictEqual(data.freeAccount, undefined, "弹窗数据不再带免费账号字段");
  });

  // -------------------------------------------------------------------------
  // 12) 多语言
  // -------------------------------------------------------------------------
  console.log("\n[12] 多语言");

  const i18n = require("../dist/i18n.js");
  const prefsUtil = require("../dist/state/prefs.js");
  const { SORT_OPTIONS } = require("../dist/constants.js");

  test("i18n：默认中文、英文切换、占位符替换", () => {
    i18n.setLanguage("zh");
    assert.strictEqual(i18n.getLanguage(), "zh");
    assert.strictEqual(i18n.t("common.download"), "下载");
    assert.strictEqual(i18n.t("page.results", { count: 3 }), "3 个结果");

    i18n.setLanguage("en");
    assert.strictEqual(i18n.getLanguage(), "en");
    assert.strictEqual(i18n.t("common.download"), "Download");
    assert.strictEqual(i18n.t("page.results", { count: 3 }), "3 results");
    assert.ok(
      i18n.t("filePicker.text", { modName: "Test", count: 2 }).indexOf("Test") >= 0,
      "占位符应被替换",
    );

    i18n.setLanguage("ja");
    assert.strictEqual(i18n.getLanguage(), "ja");
    assert.strictEqual(i18n.t("common.download"), "ダウンロード");
    assert.strictEqual(i18n.t("page.results", { count: 3 }), "3 件の結果");
    assert.strictEqual(i18n.isLanguage("ja"), true);
    i18n.setLanguage("zh");
  });

  test("语言偏好：默认中文，SET_LANGUAGE 只在变化时产生新 state", () => {
    assert.strictEqual(prefsUtil.prefsLanguage({}), "zh");
    const reducer = prefsUtil.prefsReducerSpec.reducers[prefsUtil.PREFS_ACTIONS.SET_LANGUAGE];
    const next = reducer({ manualRequirements: {}, language: "zh" }, { language: "en" });
    assert.strictEqual(next.language, "en");
    const same = reducer(next, { language: "en" });
    assert.strictEqual(same, next, "相同语言不应产生新 state");
  });

  test("排序选项拆成单语 key，不再中英混排", () => {
    assert.strictEqual(SORT_OPTIONS.length, 5);
    for (const option of SORT_OPTIONS) {
      assert.strictEqual(typeof option.labelKey, "string");
      assert.strictEqual(option.label, undefined);
    }

    i18n.setLanguage("zh");
    assert.strictEqual(i18n.t(SORT_OPTIONS[0].labelKey), "相关度");
    i18n.setLanguage("en");
    assert.strictEqual(i18n.t(SORT_OPTIONS[0].labelKey), "Relevance");
    i18n.setLanguage("ja");
    assert.strictEqual(i18n.t(SORT_OPTIONS[0].labelKey), "関連度");
    i18n.setLanguage("zh");
  });

  console.log(`\n通过 ${passed} 项。`);
  if (process.exitCode) {
    console.error("存在失败项。");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
