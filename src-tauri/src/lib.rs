pub mod knife;
pub mod models;
pub mod pipeline;
pub mod storage;
pub mod xray;

use models::{
    ApplyResult, KnifeParseResult, KnifeSubscription, Profile, ReadConfigResult, Settings,
    TabContents, TestResult, X25519Result,
};
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
fn generate_uuid(profile: Profile, settings: Settings) -> Result<String, String> {
    let bin = xray::find_xray(profile.xray_path.as_deref(), settings.default_xray_path.as_deref())?;
    xray::generate_uuid(&bin)
}

#[tauri::command]
fn generate_x25519(profile: Profile, settings: Settings) -> Result<X25519Result, String> {
    let bin = xray::find_xray(profile.xray_path.as_deref(), settings.default_xray_path.as_deref())?;
    xray::generate_x25519(&bin)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
fn knife_resolve(settings: Settings) -> Result<Option<String>, String> {
    match knife::find_knife(settings.default_knife_path.as_deref()) {
        Ok(p) => Ok(Some(p.to_string_lossy().into_owned())),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn knife_list_subscriptions(settings: Settings) -> Result<Vec<KnifeSubscription>, String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::list_subscriptions(&bin)
}

#[tauri::command]
fn knife_test_subscription(settings: Settings, sub_id: i64) -> Result<Vec<String>, String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::test_subscription(&bin, sub_id)
}

#[tauri::command]
fn knife_parse_link(settings: Settings, link: String) -> Result<KnifeParseResult, String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::parse_link(&bin, &link)
}

#[tauri::command]
fn knife_add_subscription(settings: Settings, url: String, remark: String) -> Result<(), String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::add_subscription(&bin, &url, &remark)
}

#[tauri::command]
fn knife_remove_subscription(settings: Settings, id: i64) -> Result<(), String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::remove_subscription(&bin, id)
}

#[tauri::command]
fn knife_update_subscription(
    settings: Settings,
    id: i64,
    url: Option<String>,
    remark: Option<String>,
) -> Result<(), String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::update_subscription(&bin, id, url.as_deref(), remark.as_deref())
}

#[tauri::command]
fn knife_fetch_subscription(settings: Settings, id: i64) -> Result<(), String> {
    let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
    knife::fetch_subscription(&bin, id)
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
            generate_uuid,
            generate_x25519,
            read_text_file,
            knife_resolve,
            knife_list_subscriptions,
            knife_test_subscription,
            knife_parse_link,
            knife_add_subscription,
            knife_remove_subscription,
            knife_update_subscription,
            knife_fetch_subscription,
            read_config,
            test_config,
            apply_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
