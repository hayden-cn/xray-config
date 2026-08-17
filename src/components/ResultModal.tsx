import { Button, Modal } from "antd";
import { useAppStore } from "../store";
import ResultPanel, { TestDetail } from "./ResultPanel";
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
          <TestDetail title="测试结果" result={result as TestResult} />
        ) : (
          <ResultPanel />
        )}
      </ScrollArea>
    </Modal>
  );
}
