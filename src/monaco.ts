import * as monaco from "monaco-editor";
import { loader } from "@monaco-editor/react";
import editorWorker from "monaco-editor/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/language/json/json.worker?worker";

(globalThis as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker(_: unknown, label: string): Worker {
    if (label === "json") return new jsonWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

export { monaco };
