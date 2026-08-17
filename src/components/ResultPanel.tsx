import { Alert, Collapse, Typography } from "antd";
import { useAppStore } from "../store";
import { testSummary } from "../resultSummary";
import type { ApplyResult, TestResult } from "../types";

export function TestDetail({ title, result }: { title: string; result: TestResult }) {
  const hasOutput = result.stdout.trim() !== "" || result.stderr.trim() !== "";
  const summary = testSummary(result);
  return (
    <Alert
      type={summary.status}
      showIcon
      message={title}
      description={
        <>
          <div style={{ whiteSpace: "pre-wrap" }}>{summary.text}</div>
          {hasOutput && (
            <Collapse
              size="small"
              style={{ marginTop: 8 }}
              items={[
                {
                  key: "out",
                  label: "原始输出",
                  children: (
                    <pre className="result-pre">
                      {result.stdout || "(无 stdout)"}
                      {"\n--- stderr ---\n"}
                      {result.stderr || "(无 stderr)"}
                    </pre>
                  ),
                },
              ]}
            />
          )}
        </>
      }
    />
  );
}

export default function ResultPanel() {
  const { result, resultKind } = useAppStore();
  if (!result) return null;

  if (resultKind === "test") {
    const r = result as TestResult;
    return <TestDetail title="测试结果" result={r} />;
  }

  const r = result as ApplyResult;
  const apiBlocks =
    r.apiUpdate && r.apiUpdate.steps.length > 0 ? (
      <Collapse
        size="small"
        style={{ marginTop: 8 }}
        items={[
          {
            key: "api",
            label: `API 热更新（${r.apiUpdate.ok ? "成功" : "失败"}）`,
            children: (
              <ul>
                {r.apiUpdate.steps.map((s, i) => (
                  <li key={i}>
                    {s.ok ? "✓" : "✗"} {s.command}
                    {s.message ? ` — ${s.message}` : ""}
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    ) : null;

  const postCommandBlock = r.postCommand ? (
    <Collapse
      size="small"
      style={{ marginTop: 8 }}
      items={[
        {
          key: "post",
          label: `应用后命令（${r.postCommand.code === 0 ? "成功" : "失败"}）`,
          children: (
            <>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                退出码 {r.postCommand.code}
              </Typography.Paragraph>
              <pre className="result-pre">
                {r.postCommand.stdout || "(无 stdout)"}
                {"\n--- stderr ---\n"}
                {r.postCommand.stderr || "(无 stderr)"}
              </pre>
            </>
          ),
        },
      ]}
    />
  ) : null;

  return (
    <Alert
      type={r.ok ? "success" : "error"}
      showIcon
      message="应用结果"
      description={
        <>
          <div>{r.message}</div>
          {r.writtenFiles.length > 0 && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              已写入：{r.writtenFiles.join(", ")}
            </Typography.Paragraph>
          )}
          {r.test && !r.test.ok && <TestDetail title="配置校验失败" result={r.test} />}
          {apiBlocks}
          {postCommandBlock}
        </>
      }
    />
  );
}
