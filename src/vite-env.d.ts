/// <reference types="vite/client" />

declare module "monaco-editor/language/json/monaco.contribution" {
  export const jsonDefaults: {
    setDiagnosticsOptions(options: Record<string, unknown>): void;
  };
}
