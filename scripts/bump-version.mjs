import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target || !/^\d+\.\d+\.\d+$/.test(target)) {
  console.error("用法：pnpm bump <版本号>，版本号需为 x.y.z 格式，例如：pnpm bump 0.3.1");
  process.exit(1);
}

const targets = [
  {
    file: "package.json",
    pattern: /"version": "[^"]*"/,
    replacement: `"version": "${target}"`,
  },
  {
    file: "src-tauri/tauri.conf.json",
    pattern: /"version": "[^"]*"/,
    replacement: `"version": "${target}"`,
  },
  {
    file: "src-tauri/Cargo.toml",
    pattern: /^version = "[^"]*"/m,
    replacement: `version = "${target}"`,
  },
  {
    file: "src-tauri/Cargo.lock",
    pattern: /(name = "xray-config"\nversion = )"[^"]*"/,
    replacement: `$1"${target}"`,
  },
];

for (const { file, pattern, replacement } of targets) {
  const content = readFileSync(file, "utf8");
  if (!pattern.test(content)) {
    console.error(`未能在 ${file} 中匹配到版本号，文件未改动。`);
    process.exit(1);
  }
  writeFileSync(file, content.replace(pattern, replacement));
  console.log(`已更新 ${file} -> ${target}`);
}
