import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sectionUri } from "../schema";
import { useTheme } from "../theme";

interface SectionEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export default function SectionEditor({ path, value, onChange }: SectionEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(240);
  const resolved = useTheme();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setHeight(Math.max(240, el.clientHeight));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="editor-wrap" ref={wrapRef}>
      <Editor
        path={sectionUri(path)}
        language="json"
        theme={resolved === "dark" ? "vs-dark" : "vs"}
        height={height}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: "off",
          renderLineHighlight: "gutter",
          folding: true,
          glyphMargin: false,
          lineNumbersMinChars: 3,
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
    </div>
  );
}
