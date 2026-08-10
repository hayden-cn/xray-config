import { Button } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useAppStore } from "../store";
import type { ApplyResult, TestResult } from "../types";

interface ResultChipProps {
  onClick: () => void;
}

export default function ResultChip({ onClick }: ResultChipProps) {
  const { result, resultKind } = useAppStore();
  if (!result) return null;

  const common = {
    type: "text" as const,
    onClick,
    title: "点击查看详情",
  };

  if (resultKind === "test") {
    const r = result as TestResult;
    return r.ok ? (
      <Button {...common} className="result-chip result-chip-ok" icon={<CheckCircleOutlined />}>
        测试通过
      </Button>
    ) : (
      <Button {...common} className="result-chip result-chip-err" icon={<CloseCircleOutlined />}>
        测试失败
      </Button>
    );
  }

  const r = result as ApplyResult;
  if (r.ok) {
    const partial = r.apiUpdate && !r.apiUpdate.ok;
    return (
      <Button
        {...common}
        className={partial ? "result-chip result-chip-warn" : "result-chip result-chip-ok"}
        icon={partial ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
      >
        {partial ? "已应用（API 部分失败）" : "应用成功"}
      </Button>
    );
  }
  return (
    <Button {...common} className="result-chip result-chip-err" icon={<CloseCircleOutlined />}>
      应用失败
    </Button>
  );
}
