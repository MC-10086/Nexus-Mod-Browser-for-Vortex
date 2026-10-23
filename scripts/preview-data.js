#!/usr/bin/env node
/**
 * 预览用假数据（开发期用，不随插件发布）
 * ---------------------------------------------------------------------------
 * 只给 scripts/render-preview.js 用：生成一批带封面的假 Mod，
 * 让静态预览不依赖网络也能看到完整卡片效果。
 */

function cover(hue, label) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},42%,34%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 40},48%,18%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#g)"/>` +
    `<text x="160" y="98" font-family="Segoe UI, Arial, sans-serif" font-size="19" ` +
    `fill="rgba(255,255,255,0.82)" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

const SEEDS = [
  {
    name: "Stracker's Loader",
    author: "Stracker",
    category: "Utility",
    summary:
      "Restores the plugin loader and enables mods that depend on native plugin support. Required by many other mods.",
    version: "1.24",
    downloads: 1284000,
    endorsements: 21800,
    hue: 205,
  },
  {
    name: "Worldly Improvements",
    author: "KaptainChrucklz",
    category: "Essentials",
    summary: "Bare essentials for QoL and performance improvements. Vanilla-like and safe for multiplayer.",
    version: "2.1",
    downloads: 341000,
    endorsements: 5400,
    hue: 140,
  },
  {
    name: "Renn's Armor Replacer",
    author: "garcia1402",
    category: "Themed",
    adult: true,
    summary: "Replacing most armor with more detailed variants. Adult themed, read the description first.",
    version: "1.6",
    downloads: 92000,
    endorsements: 2100,
    hue: 330,
  },
  {
    name: "MHW: Full Texture Pack",
    author: "ZeroXNoxus",
    category: "Visuals",
    adult: true,
    summary: "A high resolution texture pack covering armor sets and body types. 18+, requires the texture loader.",
    version: "3.0",
    downloads: 64000,
    endorsements: 1800,
    hue: 20,
  },
  {
    name: "Better Camera Control",
    author: "AsteriskAmpersand",
    category: "Gameplay",
    summary: "Free camera distance, FOV and shake control, with a small in-game config menu.",
    version: "1.3.2",
    downloads: 219000,
    endorsements: 4300,
    hue: 190,
  },
  {
    name: "Performance Booster",
    author: "FusionRise",
    category: "Performance",
    summary: "Culls distant props and reduces shadow cascades. Works with the vanilla renderer.",
    version: "2.0.5",
    downloads: 402000,
    endorsements: 7600,
    hue: 100,
  },
];

function generate(count) {
  const out = [];
  for (let index = 0; index < count; index += 1) {
    const seed = SEEDS[index % SEEDS.length];
    const round = Math.floor(index / SEEDS.length);
    out.push({
      modId: 1000 + index,
      uid: String(index),
      name: round === 0 ? seed.name : `${seed.name} ${round + 1}`,
      summary: seed.summary,
      version: seed.version,
      author: seed.author,
      category: seed.category,
      uploader: { name: seed.author },
      adultContent: seed.adult === true,
      downloads: Math.max(1, Math.round(seed.downloads / (round + 1))),
      endorsements: Math.max(1, Math.round(seed.endorsements / (round + 1))),
      pictureUrl: cover(seed.hue + round * 12, seed.category),
      game: { domainName: "monsterhunterworld" },
    });
  }
  return out;
}

/**
 * 详情弹窗用的长简介（贴近真实 N 网写法：BBCode + \n<br /> 换行）
 * 目的：在静态预览里看长文滚动、粗体、链接、列表的排版。
 */
const DESCRIPTION = [
  "[center][b]A comprehensive QoL overhaul[/b][/center]",
  "[b]Features[/b]",
  "[list]",
  "[*]Full-text search across every container and merchant in the game.[/*]",
  "[*]Sortable, filterable inventory columns with extended data.[/*]",
  "[*]Eight customizable hotkey groups for your favourites.[/*]",
  "[*]MCM support for every option, including per-save overrides.[/*]",
  "[/list]",
  "[b]Installation[/b]",
  "Install with your mod manager, then run the game once so the MCM registers itself.",
  "[url=https://www.nexusmods.com/skyrimspecialedition]Open the mod page on Nexus Mods[/url]",
  "[quote]This description is only sample text used by the local preview build. It is not part of the extension bundle.[/quote]",
  "[b]Compatibility[/b]",
  "Works with the vanilla UI and with most interface overhauls. Load it after any mod that replaces the inventory menu.",
].join("\n<br />");

/** 给假的 Mod 补上"详情"字段（主图 + 大/小缩略图 + 长简介） */
function detailOf(mod) {
  return {
    ...mod,
    description: DESCRIPTION,
    thumbnailLargeUrl: cover((mod.modId % 360) + 40, "large thumbnail"),
    thumbnailUrl: cover((mod.modId % 360) + 80, "thumbnail"),
  };
}

module.exports = { generate, detailOf, DESCRIPTION };
