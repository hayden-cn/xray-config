import { invoke } from "@tauri-apps/api/core";
import type {
  ApplyResult,
  KnifeConfig,
  KnifeHttpResult,
  KnifeParseResult,
  KnifeSubscription,
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
  isAdmin: () => invoke<boolean>("is_admin"),
  restartAsAdmin: () => invoke<void>("restart_as_admin"),
  knifeResolve: (settings: Settings) =>
    invoke<string | null>("knife_resolve", { settings }),
  knifeListSubscriptions: (settings: Settings) =>
    invoke<KnifeSubscription[]>("knife_list_subscriptions", { settings }),
  knifeTestSubscription: (settings: Settings, subId: number) =>
    invoke<KnifeHttpResult[]>("knife_test_subscription", { settings, subId }),
  knifeListConfigs: (settings: Settings, subId?: number | null) =>
    invoke<KnifeConfig[]>("knife_list_configs", { settings, subId }),
  knifeTestAll: (settings: Settings) =>
    invoke<KnifeHttpResult[]>("knife_test_all", { settings }),
  knifeParseLink: (settings: Settings, link: string) =>
    invoke<KnifeParseResult>("knife_parse_link", { settings, link }),
  knifeParseLinks: (settings: Settings, links: string[]) =>
    invoke<KnifeParseResult[]>("knife_parse_links", { settings, links }),
  knifeAddSubscription: (settings: Settings, url: string, remark: string) =>
    invoke<void>("knife_add_subscription", { settings, url, remark }),
  knifeRemoveSubscription: (settings: Settings, id: number) =>
    invoke<void>("knife_remove_subscription", { settings, id }),
  knifeUpdateSubscription: (
    settings: Settings,
    id: number,
    url?: string | null,
    remark?: string | null,
  ) => invoke<void>("knife_update_subscription", { settings, id, url, remark }),
  knifeFetchSubscription: (settings: Settings, id: number) =>
    invoke<void>("knife_fetch_subscription", { settings, id }),
  knifeFetchAllSubscriptions: (settings: Settings) =>
    invoke<void>("knife_fetch_all_subscriptions", { settings }),
  readConfig: (profile: Profile, settings: Settings) =>
    invoke<ReadConfigResult>("read_config", { profile, settings }),
  testConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<TestResult>("test_config", { profile, settings, tabs }),
  applyConfig: (profile: Profile, settings: Settings, tabs: TabContents) =>
    invoke<ApplyResult>("apply_config", { profile, settings, tabs }),
};
