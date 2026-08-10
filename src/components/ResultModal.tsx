import { Button, Modal, Typography } from "antd";
import { useAppStore } from "../store";
import ResultPanel from "./ResultPanel";
import ScrollArea from "./ScrollArea";
import type { TestResult } from "../types";

interface ResultModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ResultModal({ open, onClose }: ResultModalProps) {
  const { result, resultKind } = useAppStore();

  return (
    <Modal
      open={open}
      title={resultKind === "test" ? "测试结果" : "应用结果"}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      destroyOnHidden
      width={640}
    >
      <ScrollArea maxHeight="50vh">
        {resultKind === "test" && result ? (
          <TestOutput result={result as TestResult} />
        ) : (
          <ResultPanel />
        )}
      </ScrollArea>
    </Modal>
  );
}

function TestOutput({ result }: { result: TestResult }) {
  return (
    <div style={{ fontFamily: "Consolas, Menlo, monospace", fontSize: 12 }}>
      {result.stdout && (
        <>
          <Typography.Text type="secondary">stdout</Typography.Text>
          <pre className="result-pre">{result.stdout}</pre>
        </>
      )}
      {result.stderr && (
        <>
          <Typography.Text type="secondary">stderr</Typography.Text>
          <pre className="result-pre">{result.stderr}</pre>
        </>
      )}
      {!result.stdout && !result.stderr && (
        <Typography.Text type="secondary">{result.message || "（无输出）"}</Typography.Text>
      )}
    </div>
  );
}
