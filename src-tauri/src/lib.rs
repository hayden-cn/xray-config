pub mod models;
pub mod pipeline;
pub mod storage;
pub mod xray;

use models::{ApplyResult, Profile, ReadConfigResult, Settings, TabContents, TestResult};
use tauri::AppHandle;

#[tauri::command]
fn list_profiles(app: AppHandle) -> Result<Vec<Profile>, String> {
    let s = storage::Storage::new(&app)?;
    Ok(s.load_profiles())
}

#[tauri::command]
fn save_profiles(app: AppHandle, profiles: Vec<Profile>) -> Result<(), String> {
    let s = storage::Storage::new(&app)?;
    s.save_profiles(&profiles)
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Settings, String> {
    let s = storage::Storage::new(&app)?;
    Ok(s.load_settings())
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let s = storage::Storage::new(&app)?;
    s.save_settings(&settings)
}

#[tauri::command]
fn resolve_xray(profile: Profile, settings: Settings) -> Result<Option<String>, String> {
    match xray::find_xray(
        profile.xray_path.as_deref(),
        settings.default_xray_path.as_deref(),
    ) {
        Ok(p) => Ok(Some(p.to_string_lossy().into_owned())),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn read_config(profile: Profile, settings: Settings) -> Result<ReadConfigResult, String> {
    pipeline::read_config(&profile, settings.default_xray_path.as_deref())
}

#[tauri::command]
fn test_config(profile: Profile, settings: Settings, tabs: TabContents) -> Result<TestResult, String> {
    let template = effective_template(&settings);
    pipeline::test_config(&profile, settings.default_xray_path.as_deref(), &tabs, &template)
}

#[tauri::command]
fn apply_config(profile: Profile, settings: Settings, tabs: TabContents) -> Result<ApplyResult, String> {
    let template = effective_template(&settings);
    pipeline::apply_config(&profile, settings.default_xray_path.as_deref(), &tabs, &template)
}

fn effective_template(settings: &Settings) -> Vec<models::TemplateEntry> {
    if settings.default_multi_file_template.is_empty() {
        models::default_template()
    } else {
        settings.default_multi_file_template.clone()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_profiles,
            save_profiles,
            load_settings,
            save_settings,
            resolve_xray,
            read_config,
            test_config,
            apply_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
