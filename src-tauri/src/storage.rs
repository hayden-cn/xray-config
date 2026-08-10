use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::models::{Profile, Settings};

pub struct Storage {
    dir: PathBuf,
}

impl Storage {
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|e| format!("无法获取应用配置目录: {}", e))?;
        fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用配置目录: {}", e))?;
        Ok(Self { dir })
    }

    fn profiles_path(&self) -> PathBuf {
        self.dir.join("profiles.json")
    }

    fn settings_path(&self) -> PathBuf {
        self.dir.join("settings.json")
    }

    pub fn load_profiles(&self) -> Vec<Profile> {
        match fs::read_to_string(self.profiles_path()) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
            Err(_) => Vec::new(),
        }
    }

    pub fn save_profiles(&self, profiles: &[Profile]) -> Result<(), String> {
        let json = serde_json::to_string_pretty(profiles)
            .map_err(|e| format!("序列化 profiles 失败: {}", e))?;
        fs::write(self.profiles_path(), json).map_err(|e| format!("保存 profiles 失败: {}", e))
    }

    pub fn load_settings(&self) -> Settings {
        let mut s: Settings = match fs::read_to_string(self.settings_path()) {
            Ok(text) => serde_json::from_str(&text).unwrap_or_default(),
            Err(_) => Settings::default(),
        };
        if s.default_multi_file_template.is_empty() {
            s.default_multi_file_template = crate::models::default_template();
        } else if s.default_multi_file_template == crate::models::legacy_template() {
            s.default_multi_file_template = crate::models::default_template();
        }
        s
    }

    pub fn save_settings(&self, settings: &Settings) -> Result<(), String> {
        let json = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("序列化 settings 失败: {}", e))?;
        fs::write(self.settings_path(), json).map_err(|e| format!("保存 settings 失败: {}", e))
    }
}
