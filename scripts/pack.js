#!/usr/bin/env node
/**
 * 打包脚本
 * ---------------------------------------------------------------------------
 * 按 Nexus 官方要求生成发布包：
 *   - info.json / index.js 必须在压缩包**根目录**（不能套一层文件夹，这是最常见的审核失败原因）
 *   - 版本号必须与 info.json 一致
 *
 * 用法：
 *   node scripts/pack.js          # 生成 release/nexus-mod-browser-<version>.zip
 *   node scripts/pack.js --7z     # 额外用 7-Zip 生成 .7z（需要 7z 在 PATH 或 7Z_PATH 环境变量）
 *
 * 产物：release/ 目录下
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, "build", "package");
const releaseDir = path.join(projectRoot, "release");

const args = process.argv.slice(2);
const alsoSevenZip = args.includes("--7z");

const info = JSON.parse(fs.readFileSync(path.join(projectRoot, "info.json"), "utf8"));
const baseName = `nexus-mod-browser-${info.version}`;

function fail(message) {
  console.error("[pack] " + message);
  process.exit(1);
}

if (!fs.existsSync(path.join(projectRoot, "dist", "index.js"))) {
  fail("dist/index.js 不存在，请先运行 `npm run build`。");
}

// ---- 1. 准备 staging ------------------------------------------------------
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  fs.copyFileSync(src, dest);
}

fs.copyFileSync(path.join(projectRoot, "info.json"), path.join(stagingDir, "info.json"));
copyRecursive(path.join(projectRoot, "dist"), stagingDir);

// 可选：把说明文件一起打进去（不影响加载）
for (const extra of ["README.md", "LICENSE", "NOTICE"]) {
  const source = path.join(projectRoot, extra);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(stagingDir, extra));
  }
}

// ---- 2. 校验 staging 结构 -------------------------------------------------
const mustHave = ["info.json", "index.js"];
for (const file of mustHave) {
  if (!fs.existsSync(path.join(stagingDir, file))) {
    fail(`打包内容缺少 ${file}（必须在压缩包根目录）`);
  }
}

// ---- 3. 打 zip ------------------------------------------------------------
fs.mkdirSync(releaseDir, { recursive: true });
const zipPath = path.join(releaseDir, `${baseName}.zip`);
fs.rmSync(zipPath, { force: true });

/**
 * 优先用 7-Zip 打 zip：
 *   PowerShell 的 Compress-Archive 在 Windows 上会把路径存成反斜杠（bridge\download.js），
 *   严格按 zip 规范解压的工具可能把它当成文件名的一部分。7-Zip 写的是标准正斜杠。
 */
function findSevenZip() {
  const candidates = [
    process.env["7Z_PATH"],
    "7z",
    "C:\\Program Files\\7-Zip\\7z.exe",
    "C:\\Program Files (x86)\\7-Zip\\7z.exe",
    "E:\\Software\\7-Zip\\7z.exe",
    "D:\\Software\\7-Zip\\7z.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      if (candidate.includes("\\") && !fs.existsSync(candidate)) {
        continue;
      }
      execFileSync(candidate, ["i"], { stdio: "ignore" });
      return candidate;
    } catch {
      /* 试下一个 */
    }
  }
  return undefined;
}

const sevenZip = findSevenZip();

if (sevenZip !== undefined) {
  execFileSync(sevenZip, ["a", "-tzip", "-mx=9", zipPath, "*"], {
    cwd: stagingDir,
    stdio: "inherit",
  });
} else {
  console.warn("[pack] 未找到 7-Zip，回退到 Compress-Archive（zip 内路径可能是反斜杠）。");
  const psCommand =
    `Compress-Archive -Path '${stagingDir}\\*' -DestinationPath '${zipPath}' -Force`;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psCommand], {
      stdio: "inherit",
    });
  } catch (err) {
    fail("Compress-Archive 失败：" + (err && err.message));
  }
}

const zipSize = fs.statSync(zipPath).size;
console.log(`[pack] 生成 ${path.relative(projectRoot, zipPath)} (${(zipSize / 1024).toFixed(1)} KB)`);

// ---- 4. 可选打 7z ----------------------------------------------------------
if (alsoSevenZip) {
  if (sevenZip === undefined) {
    console.warn("[pack] 未找到 7-Zip，跳过 .7z 打包。");
  } else {
    const sevenZipPath = path.join(releaseDir, `${baseName}.7z`);
    fs.rmSync(sevenZipPath, { force: true });
    execFileSync(sevenZip, ["a", "-mx=9", sevenZipPath, "*"], {
      cwd: stagingDir,
      stdio: "inherit",
    });
    console.log(`[pack] 生成 ${path.relative(projectRoot, sevenZipPath)}`);
  }
}

// ---- 5. 源码包（给 GitHub / 备份用）------------------------------------------
const sourceZipPath = path.join(releaseDir, `nexus-mod-browser-${info.version}-source.zip`);
fs.rmSync(sourceZipPath, { force: true });

if (sevenZip !== undefined) {
  execFileSync(
    sevenZip,
    [
      "a",
      "-tzip",
      "-mx=9",
      sourceZipPath,
      "*",
      "-xr!dist",
      "-xr!build",
      "-xr!release",
      "-xr!node_modules",
      "-xr!.git",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  console.log(`[pack] 源码包 ${path.relative(projectRoot, sourceZipPath)}`);
} else {
  console.warn("[pack] 未找到 7-Zip，跳过源码包。");
}

// ---- 6. 发布副本：文件名必须含 "Extension" -------------------------------
// Vortex 用文件名判断"这个下载是扩展还是游戏 MOD"
// （mod_management/util/queryGameId.ts: fileName.toLowerCase().includes("extension")），
// 名字里没有 extension 就会被当成普通 MOD 装进当前游戏。
const uploadName = path.join(
  releaseDir,
  `Nexus Mod Browser - Vortex Extension ${info.version}.zip`,
);
fs.copyFileSync(zipPath, uploadName);
console.log(`[pack] 上传用副本 ${path.relative(projectRoot, uploadName)}`);

console.log("[pack] 完成。上传到 nexusmods.com/site → 分类选 Modding Tools > Vortex Extensions。");
