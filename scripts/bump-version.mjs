import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("用法：pnpm bump <版本号>，版本号需为 x.y.z 格式，例如：pnpm bump 0.3.1");
  process.exit(1);
}

const files = [
  {
    file: "package.json",
    pattern: /"version": "[^"]*"/,
    replacement: `"version": "${version}"`,
  },
  {
    file: "src-tauri/tauri.conf.json",
    pattern: /"version": "[^"]*"/,
    replacement: `"version": "${version}"`,
  },
  {
    file: "src-tauri/Cargo.toml",
    pattern: /^version = "[^"]*"/m,
    replacement: `version = "${version}"`,
  },
  {
    file: "src-tauri/Cargo.lock",
    pattern: /(name = "xray-config"\nversion = )"[^"]*"/,
    replacement: `$1"${version}"`,
  },
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitOk(args) {
  try {
    git(args);
    return true;
  } catch {
    return false;
  }
}

const tag = `v${version}`;
if (!gitOk(["rev-parse", "--git-dir"])) {
  console.error("当前目录不是 git 仓库，无法提交。");
  process.exit(1);
}
if (gitOk(["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) {
  console.error(`标签 ${tag} 已存在，中止。`);
  process.exit(1);
}

for (const { file, pattern, replacement } of files) {
  const content = readFileSync(file, "utf8");
  if (!pattern.test(content)) {
    console.error(`未能在 ${file} 中匹配到版本号，文件未改动。`);
    process.exit(1);
  }
  writeFileSync(file, content.replace(pattern, replacement));
  console.log(`已更新 ${file} -> ${version}`);
}

const paths = files.map((f) => f.file);
if (gitOk(["diff", "--quiet", "--", ...paths])) {
  console.log("版本号未变化，跳过提交与打标签。");
  process.exit(0);
}

git(["add", "--", ...paths]);
try {
  git(["commit", "-m", `ci(release): 发布 ${version}`]);
} catch (e) {
  console.error(`提交失败，请检查 git 输出：\n${e.stdout ?? ""}${e.stderr ?? ""}`);
  process.exit(1);
}
git(["tag", tag]);
console.log(`已提交「ci(release): 发布 ${version}」并打标签 ${tag}。`);
console.log(`推送主分支和标签后将触发 Release 工作流：git push && git push origin ${tag}`);
