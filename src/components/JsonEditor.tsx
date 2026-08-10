import Editor from "@monaco-editor/react";
import { useTheme } from "../theme";

interface JsonEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  height?: number;
}

/** 嵌入表单的 JSON 片段 Monaco 编辑器（无 schema 校验），value/onChange 由 antd Form.Item 注入 */
export default function JsonEditor({ value, onChange, placeholder, height = 150 }: JsonEditorProps) {
  const resolved = useTheme();
  const empty = !value || !value.trim();

  return (
    <div className="json-editor" style={{ position: "relative", height }}>
      <Editor
        language="json"
        theme={resolved === "dark" ? "vs-dark" : "vs"}
        height={height}
        value={value ?? ""}
        onChange={(v) => onChange?.(v ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: "on",
          renderLineHighlight: "gutter",
          folding: true,
          glyphMargin: false,
          lineNumbersMinChars: 0,
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 6,
            horizontalScrollbarSize: 6,
            verticalSliderSize: 6,
            horizontalSliderSize: 6,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
        }}
      />
      {empty && placeholder && (
        <div className="json-editor-placeholder" style={{ top: 8, left: 50 }}>
          {placeholder}
        </div>
      )}
    </div>
  );
}
