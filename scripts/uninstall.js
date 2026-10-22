#!/usr/bin/env node
/**
 * 卸载脚本（开发用）
 * ---------------------------------------------------------------------------
 * install.js 的逆操作：删除 %APPDATA%\Vortex\plugins\nexus-mod-browser 整个目录。
 *
 * 用法：
 *   node scripts/uninstall.js                 # 删除默认位置的插件
 *   node scripts/uninstall.js <目标目录>       # 删除指定目录（测试用）
 *   node scripts/uninstall.js --dry-run       # 只打印将删除什么
 *
 * 注意：
 *   - 请先**关闭 Vortex**，否则 Windows 上文件可能被占用（会提示 EBUSY/EPERM）
 *   - 只删除目录名以 nexus-mod-browser 结尾的目录，避免误删
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

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

if (path.basename(target) !== PLUGIN_DIR_NAME) {
  console.error(
    `[uninstall] 拒绝执行：目标目录必须以 "${PLUGIN_DIR_NAME}" 结尾（当前：${target}）`,
  );
  process.exit(1);
}

if (!fs.existsSync(target)) {
  console.log(`[uninstall] 目录不存在，无需删除：${target}`);
  process.exit(0);
}

console.log(`[uninstall] 目标：${target}`);

if (dryRun) {
  console.log("[uninstall] --dry-run，未做任何修改。");
  process.exit(0);
}

try {
  fs.rmSync(target, { recursive: true, force: true });
  console.log("[uninstall] 已删除。重启 Vortex 后该扩展会从左侧导航消失。");
} catch (err) {
  const code = err && err.code;
  if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
    console.error(
      "[uninstall] 删除失败：文件被占用。请先**完全退出 Vortex**（含托盘图标里的 Quit）再试。",
    );
    process.exit(1);
  }
  throw err;
}
