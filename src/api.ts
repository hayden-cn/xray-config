import { invoke } from "@tauri-apps/api/core";
import type {
  ApplyResult,
  Profile,
  ReadConfigResult,
  Settings,
  TabContents,
  TestResult,
} from "./types";

export const api = {
  listProfiles: () => invoke<Profile[]>("list_profiles"),
  saveProfiles: (profiles: Profile[]) => invoke<void>("save_profiles", { profiles }),
  loadSettings: () => invoke<Settings>("load_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  resolveXray: (profile: Profile, settings: Settings) =>
    invoke<string | null>("resolve_xray", { profile, settings }),
  readConfig: (profile: Profile, settings: Settings) =>
    invoke<ReadConfigResult>("read_config", { profile, settings }),
  testConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<TestResult>("test_config", { profile, settings, tabs }),
  applyConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<ApplyResult>("apply_config", { profile, settings, tabs }),
};
