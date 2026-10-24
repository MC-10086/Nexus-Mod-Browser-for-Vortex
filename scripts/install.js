#!/usr/bin/env node
/**
 * 本地安装脚本（开发用）
 * ---------------------------------------------------------------------------
 * 把 info.json + dist/ 复制到 Vortex 的插件目录。
 *
 * 用法：
 *   node scripts/install.js                 # 装到 %APPDATA%\Vortex\plugins\nexus-mod-browser
 *   node scripts/install.js <目标目录>       # 装到指定目录（测试用）
 *   node scripts/install.js --dry-run       # 只打印将要做什么
 *
 * 注意：安装后需要**重启 Vortex** 才会加载。
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const PLUGIN_DIR_NAME = "nexus-mod-browser";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const explicitTarget = args.find((arg) => !arg.startsWith("--"));

const defaultTarget = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "Vortex",
  "plugins",
  PLUGIN_DIR_NAME,
);

const target = path.resolve(explicitTarget || defaultTarget);

function fail(message) {
  console.error("[install] " + message);
  process.exit(1);
}

// ---- 前置检查 -------------------------------------------------------------
if (!fs.existsSync(path.join(projectRoot, "dist", "index.js"))) {
  fail("dist/index.js 不存在，请先运行 `npm run build`。");
}
if (!fs.existsSync(path.join(projectRoot, "info.json"))) {
  fail("info.json 不存在。");
}
// 安全检查：只允许删除以插件名结尾的目录
if (path.basename(target) !== PLUGIN_DIR_NAME) {
  fail(
    `目标目录必须以 "${PLUGIN_DIR_NAME}" 结尾（当前：${target}）。\n` +
      `  这样做是为了避免误删其他目录。`,
  );
}

console.log(`[install] 源目录 : ${projectRoot}`);
console.log(`[install] 目标   : ${target}`);

if (dryRun) {
  console.log("[install] --dry-run，未做任何修改。");
  process.exit(0);
}

// ---- 复制 -----------------------------------------------------------------
function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// 先清空旧版本（保留目录本身），避免旧文件残留导致加载到过期代码
if (fs.existsSync(target)) {
  for (const entry of fs.readdirSync(target)) {
    fs.rmSync(path.join(target, entry), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(target, { recursive: true });
}

fs.copyFileSync(path.join(projectRoot, "info.json"), path.join(target, "info.json"));
copyRecursive(path.join(projectRoot, "dist"), target);

console.log("[install] 完成。请重启 Vortex，左侧导航会出现「Nexus Mod Browser」。");
