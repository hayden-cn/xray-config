import { create } from "zustand";
import { api } from "./api";
import { splitSections } from "./json";
import { allChildPaths } from "./layout";
import type { ApplyResult, Profile, Settings, TestResult } from "./types";
import type { ThemePref } from "./theme";

type Sections = Record<string, string>;

const EMPTY_SECTIONS: Sections = Object.fromEntries(allChildPaths().map((p) => [p, ""]));

function computeDirty(sections: Sections, saved: Sections): string[] {
  return allChildPaths().filter((p) => sections[p] !== saved[p]);
}

interface AppState {
  profiles: Profile[];
  currentProfileId: string | null;
  settings: Settings;
  mode: "folder" | "file" | null;
  files: string[];
  sections: Sections;
  savedSections: Sections;
  dirtySections: string[];
  loading: boolean;
  error: string | null;
  warning: string | null;
  result: TestResult | ApplyResult | null;
  resultKind: "test" | "apply" | null;
  init: () => Promise<void>;
  selectProfile: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  setSection: (path: string, text: string) => void;
  markClean: () => void;
  saveProfiles: (ps: Profile[]) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  setTheme: (theme: ThemePref) => void;
  setResult: (kind: "test" | "apply", r: TestResult | ApplyResult) => void;
  clearResult: () => void;
}

export const useAppStore = create<AppState>()((set, get) => ({
  profiles: [],
  currentProfileId: null,
  settings: { defaultMultiFileTemplate: [], theme: "system" },
  mode: null,
  files: [],
  sections: { ...EMPTY_SECTIONS },
  savedSections: { ...EMPTY_SECTIONS },
  dirtySections: [],
  loading: false,
  error: null,
  warning: null,
  result: null,
  resultKind: null,

  init: async () => {
    const [profiles, settings] = await Promise.all([api.listProfiles(), api.loadSettings()]);
    set({ profiles, settings });
    if (profiles.length > 0) {
      await get().selectProfile(profiles[0].id);
    }
  },

  selectProfile: async (id) => {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    set({ currentProfileId: id, loading: true, error: null, warning: null, result: null, resultKind: null });
    try {
      const r = await api.readConfig(profile, get().settings);
      const sections = splitSections(r.content);
      set({
        mode: r.mode,
        files: r.files,
        sections,
        savedSections: sections,
        dirtySections: [],
        warning: r.warning ?? null,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e), warning: null });
    }
  },

  refresh: async () => {
    const { currentProfileId, profiles, settings } = get();
    if (!currentProfileId) return;
    const profile = profiles.find((p) => p.id === currentProfileId);
    if (!profile) return;
    set({ loading: true, error: null, warning: null, result: null, resultKind: null });
    try {
      const r = await api.readConfig(profile, settings);
      const sections = splitSections(r.content);
      set({
        mode: r.mode,
        files: r.files,
        sections,
        savedSections: sections,
        dirtySections: [],
        warning: r.warning ?? null,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: String(e), warning: null });
    }
  },

  setSection: (path, text) => {
    const sections = { ...get().sections, [path]: text };
    set({ sections, dirtySections: computeDirty(sections, get().savedSections) });
  },

  markClean: () => {
    set({ savedSections: { ...get().sections }, dirtySections: [] });
  },

  saveProfiles: async (ps) => {
    await api.saveProfiles(ps);
    set({ profiles: ps });
  },

  saveSettings: async (s) => {
    await api.saveSettings(s);
    set({ settings: s });
  },

  setTheme: (theme) => set((s) => ({ settings: { ...s.settings, theme } })),

  setResult: (kind, r) => set({ result: r, resultKind: kind }),
  clearResult: () => set({ result: null, resultKind: null }),
}));
