import { invoke } from "@tauri-apps/api/core";
import type {
  ApplyResult,
  Profile,
  ReadConfigResult,
  Settings,
  TabContents,
  TestResult,
  X25519Result,
} from "./types";

export const api = {
  listProfiles: () => invoke<Profile[]>("list_profiles"),
  saveProfiles: (profiles: Profile[]) => invoke<void>("save_profiles", { profiles }),
  loadSettings: () => invoke<Settings>("load_settings"),
  saveSettings: (settings: Settings) => invoke<void>("save_settings", { settings }),
  resolveXray: (profile: Profile, settings: Settings) =>
    invoke<string | null>("resolve_xray", { profile, settings }),
  generateUuid: (profile: Profile, settings: Settings) =>
    invoke<string>("generate_uuid", { profile, settings }),
  generateX25519: (profile: Profile, settings: Settings) =>
    invoke<X25519Result>("generate_x25519", { profile, settings }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  readConfig: (profile: Profile, settings: Settings) =>
    invoke<ReadConfigResult>("read_config", { profile, settings }),
  testConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<TestResult>("test_config", { profile, settings, tabs }),
  applyConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<ApplyResult>("apply_config", { profile, settings, tabs }),
};
