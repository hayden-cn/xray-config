use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(default)]
    pub api_address: Option<String>,
    #[serde(default)]
    pub xray_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateEntry {
    pub file: String,
    #[serde(default)]
    pub keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub default_xray_path: Option<String>,
    #[serde(default)]
    pub default_multi_file_template: Vec<TemplateEntry>,
    #[serde(default)]
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabContents {
    pub inbounds: String,
    pub outbounds: String,
    pub rules: String,
    pub balancers: String,
    pub other: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadConfigResult {
    pub mode: String,
    pub content: String,
    pub files: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warning: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResult {
    pub ok: bool,
    pub code: i32,
    pub message: String,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub ok: bool,
    pub message: String,
    pub test: Option<TestResult>,
    pub written_files: Vec<String>,
    pub api_update: Option<ApiUpdateResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiUpdateResult {
    pub ok: bool,
    pub message: String,
    pub steps: Vec<ApiStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiStep {
    pub command: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct X25519Result {
    pub private_key: String,
    pub public_key: String,
}

pub fn default_template() -> Vec<TemplateEntry> {
    vec![
        TemplateEntry { file: "00_log.jsonc".into(), keys: vec!["log".into()] },
        TemplateEntry { file: "01_api.jsonc".into(), keys: vec!["api".into()] },
        TemplateEntry { file: "02_dns.jsonc".into(), keys: vec!["dns".into()] },
        TemplateEntry { file: "03_routing.jsonc".into(), keys: vec!["routing".into()] },
        TemplateEntry { file: "04_policy.jsonc".into(), keys: vec!["policy".into()] },
        TemplateEntry { file: "05_inbounds.jsonc".into(), keys: vec!["inbounds".into()] },
        TemplateEntry { file: "06_outbounds.jsonc".into(), keys: vec!["outbounds".into()] },
        TemplateEntry { file: "07_stats.jsonc".into(), keys: vec!["stats".into()] },
        TemplateEntry { file: "08_fakedns.jsonc".into(), keys: vec!["fakedns".into()] },
        TemplateEntry { file: "09_metrics.jsonc".into(), keys: vec!["metrics".into()] },
        TemplateEntry {
            file: "10_observatory.jsonc".into(),
            keys: vec!["observatory".into(), "burstObservatory".into()],
        },
        TemplateEntry { file: "11_geodata.jsonc".into(), keys: vec!["geodata".into()] },
        TemplateEntry { file: "12_env.jsonc".into(), keys: vec!["env".into()] },
        TemplateEntry { file: "98_other.jsonc".into(), keys: vec!["*".into()] },
        TemplateEntry { file: "99_version.jsonc".into(), keys: vec!["version".into()] },
    ]
}

pub fn legacy_template() -> Vec<TemplateEntry> {
    vec![
        TemplateEntry { file: "01-inbounds.json".into(), keys: vec!["inbounds".into()] },
        TemplateEntry { file: "02-outbounds.json".into(), keys: vec!["outbounds".into()] },
        TemplateEntry { file: "03-routing.json".into(), keys: vec!["routing".into()] },
        TemplateEntry { file: "04-log.json".into(), keys: vec!["log".into()] },
        TemplateEntry { file: "05-dns.json".into(), keys: vec!["dns".into()] },
        TemplateEntry { file: "06-fakedns.json".into(), keys: vec!["fakedns".into()] },
        TemplateEntry { file: "07-policy.json".into(), keys: vec!["policy".into()] },
        TemplateEntry { file: "08-api.json".into(), keys: vec!["api".into()] },
        TemplateEntry { file: "09-metrics.json".into(), keys: vec!["metrics".into()] },
        TemplateEntry { file: "10-stats.json".into(), keys: vec!["stats".into()] },
        TemplateEntry {
            file: "11-observatory.json".into(),
            keys: vec!["observatory".into(), "burstObservatory".into()],
        },
        TemplateEntry { file: "12-misc.json".into(), keys: vec!["*".into()] },
    ]
}
