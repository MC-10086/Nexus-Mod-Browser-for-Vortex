#!/usr/bin/env node
/**
 * 离线构建脚本
 * ---------------------------------------------------------------------------
 * 为什么不用 webpack：
 *   1. 扩展不需要打包成单文件 —— 宿主用原生 `require` 加载 index.js，
 *      同目录下的相对 require 一样能被 Node 解析（官方内置扩展也是这么被加载的）
 *   2. 目标机器可能没有网络，装不了 webpack / ts-loader / @types/react；
 *      而 VS Code 自带完整的 TypeScript 编译器，可以直接离线编译
 *   3. 依赖越少，别人接手时越容易跑起来
 *
 * 编译器查找顺序：
 *   1. 环境变量 TSC_PATH 指向的 typescript.js / tsc.js
 *   2. 项目本地 node_modules 里的 typescript（如果你后来 `npm i -D typescript`）
 *   3. VS Code 安装目录自带的 typescript
 *
 * 用法：
 *   node scripts/tsbuild.js            # 编译到 dist/
 *   node scripts/tsbuild.js --noEmit   # 只做类型检查
 *   node scripts/tsbuild.js --watch    # 预留（当前未实现）
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const tsconfigPath = path.join(projectRoot, "tsconfig.json");

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** 找到可用的 typescript 模块并 require 进来 */
function loadTypeScript() {
  const candidates = [];

  if (process.env.TSC_PATH) {
    candidates.push(process.env.TSC_PATH);
  }

  // 1) 本地安装的 typescript
  try {
    const local = require.resolve("typescript", { paths: [projectRoot] });
    candidates.push(local);
  } catch {
    /* 没装，继续 */
  }

  // 2) VS Code 自带的 typescript
  const vscodeRoots = [
    process.env.VSCODE_PATH,
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft VS Code"),
    "C:\\Program Files\\Microsoft VS Code",
    "C:\\Program Files (x86)\\Microsoft VS Code",
    "E:\\Software\\Microsoft VS Code",
    "D:\\Software\\Microsoft VS Code",
  ].filter(Boolean);

  for (const root of vscodeRoots) {
    if (!exists(root)) {
      continue;
    }
    // 新版 VS Code 把 app 放在一个哈希子目录里
    let appDirs = [path.join(root, "resources", "app")];
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          appDirs.push(path.join(root, entry.name, "resources", "app"));
        }
      }
    } catch {
      /* 忽略 */
    }
    for (const appDir of appDirs) {
      candidates.push(path.join(appDir, "extensions", "node_modules", "typescript", "lib", "typescript.js"));
    }
  }

  for (const candidate of candidates) {
    if (candidate && exists(candidate)) {
      try {
        const ts = require(candidate);
        if (ts && typeof ts.createProgram === "function") {
          return { ts, from: candidate };
        }
      } catch {
        /* 这个候选不可用，试下一个 */
      }
    }
  }

  console.error(
    [
      "找不到可用的 TypeScript 编译器。",
      "",
      "请三选一：",
      "  a) 安装 VS Code（自带 TypeScript），或",
      "  b) 在本项目执行 npm install -D typescript，或",
      "  c) 设置环境变量 TSC_PATH 指向 typescript.js，例如：",
      "     $env:TSC_PATH = 'C:\\path\\to\\typescript\\lib\\typescript.js'",
    ].join("\n"),
  );
  process.exit(2);
}

function main() {
  const args = process.argv.slice(2);
  const noEmit = args.includes("--noEmit");

  const { ts, from } = loadTypeScript();
  console.log(`[tsbuild] TypeScript ${ts.version} (${from})`);

  // 清理产物：tsc 不会删除已移除的源文件对应的旧 .js，容易把过期代码打进发布包
  const outDir = path.join(projectRoot, "dist");
  if (!noEmit && exists(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
    console.log("[tsbuild] 已清空 dist/");
  }

  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));
    process.exit(1);
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    projectRoot,
  );

  if (parsed.errors && parsed.errors.length > 0) {
    for (const diagnostic of parsed.errors) {
      console.error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
    process.exit(1);
  }

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit },
  });

  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  if (diagnostics.length > 0) {
    let errorCount = 0;
    for (const diagnostic of diagnostics) {
      if (diagnostic.category === ts.DiagnosticCategory.Warning) {
        continue;
      }
      errorCount += 1;
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      if (diagnostic.file && diagnostic.start !== undefined) {
        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        const rel = path.relative(projectRoot, diagnostic.file.fileName);
        console.error(`${rel}:${position.line + 1}:${position.character + 1} - ${message}`);
      } else {
        console.error(message);
      }
    }
    if (errorCount > 0) {
      console.error(`\n[tsbuild] 失败：${errorCount} 个错误`);
      process.exit(1);
    }
  }

  if (noEmit) {
    console.log("[tsbuild] 类型检查通过（未输出文件）");
    return;
  }

  console.log("[tsbuild] 编译完成 → dist/");
}

main();
