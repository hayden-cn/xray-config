import type { TestResult } from "./types";

function outputLines(result: TestResult) {
  return [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

function isNoiseLine(line: string) {
  return (
    /^Xray\s+/i.test(line) ||
    /^A unified platform/i.test(line) ||
    /^Configuration OK\.?$/i.test(line)
  );
}

export function extractTestWarnings(result: TestResult) {
  if (!result.ok) return [];
  return uniqueLines(outputLines(result).filter((line) => /\bwarning\b|\[warning\]|警告/i.test(line)));
}

export function extractTestFailureReason(result: TestResult) {
  if (result.ok) return "";

  const lines = outputLines(result).filter((line) => !isNoiseLine(line));
  const reasonLines = lines.filter((line) =>
    /\berror\b|\bfailed\b|\bfailure\b|\bfatal\b|\binvalid\b|错误|失败|无效/i.test(line),
  );
  const picked = reasonLines.length > 0 ? reasonLines : lines;
  return picked.slice(-3).join("\n").trim();
}

export function testSummary(result: TestResult) {
  if (result.ok) {
    const warnings = extractTestWarnings(result);
    return {
      status: warnings.length > 0 ? "warning" : "success",
      text: warnings.length > 0 ? warnings.join("\n") : result.message || "配置校验通过",
    } as const;
  }

  const reason = extractTestFailureReason(result);
  return {
    status: "error",
    text: reason || result.message || "配置校验失败",
  } as const;
}
