import { useEffect, useState } from "react";
import type * as monaco from "monaco-editor";
import { monaco as monacoRef } from "../monaco";

export function useMarkers(uri: string): monaco.editor.IMarker[] {
  const [markers, setMarkers] = useState<monaco.editor.IMarker[]>(() =>
    monacoRef.editor.getModelMarkers({ resource: monacoRef.Uri.parse(uri) }),
  );

  useEffect(() => {
    const resource = monacoRef.Uri.parse(uri);
    const update = () => setMarkers(monacoRef.editor.getModelMarkers({ resource }));
    update();
    const sub = monacoRef.editor.onDidChangeMarkers(update);
    return () => sub.dispose();
  }, [uri]);

  return markers;
}
