pub mod admin;
pub mod knife;
pub mod models;
pub mod pipeline;
pub mod storage;
pub mod xray;

use models::{
    ApplyResult, KnifeConfig, KnifeHttpResult, KnifeParseResult, KnifeSubscription, Profile,
    ReadConfigResult, Settings, TabContents, TestResult, X25519Result,
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
async fn generate_uuid(profile: Profile, settings: Settings) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = xray::find_xray(profile.xray_path.as_deref(), settings.default_xray_path.as_deref())?;
        xray::generate_uuid(&bin)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn generate_x25519(profile: Profile, settings: Settings) -> Result<X25519Result, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = xray::find_xray(profile.xray_path.as_deref(), settings.default_xray_path.as_deref())?;
        xray::generate_x25519(&bin)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))
}

#[tauri::command]
fn is_admin() -> bool {
    admin::is_elevated()
}

#[tauri::command]
fn restart_as_admin(app: AppHandle) -> Result<(), String> {
    admin::restart_as_admin()?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn knife_resolve(settings: Settings) -> Result<Option<String>, String> {
    match knife::find_knife(settings.default_knife_path.as_deref()) {
        Ok(p) => Ok(Some(p.to_string_lossy().into_owned())),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
async fn knife_list_subscriptions(settings: Settings) -> Result<Vec<KnifeSubscription>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::list_subscriptions(&bin)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_test_subscription(settings: Settings, sub_id: i64) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::test_subscription(&bin, sub_id)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_list_configs(settings: Settings) -> Result<Vec<KnifeConfig>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::list_configs(&bin)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_test_all(settings: Settings) -> Result<Vec<KnifeHttpResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::test_all(&bin)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_parse_link(settings: Settings, link: String) -> Result<KnifeParseResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::parse_link(&bin, &link)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_parse_links(settings: Settings, links: Vec<String>) -> Result<Vec<KnifeParseResult>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        Ok(knife::parse_links(&bin, &links))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_add_subscription(settings: Settings, url: String, remark: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::add_subscription(&bin, &url, &remark)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_remove_subscription(settings: Settings, id: i64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::remove_subscription(&bin, id)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_update_subscription(
    settings: Settings,
    id: i64,
    url: Option<String>,
    remark: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::update_subscription(&bin, id, url.as_deref(), remark.as_deref())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn knife_fetch_subscription(settings: Settings, id: i64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let bin = knife::find_knife(settings.default_knife_path.as_deref())?;
        knife::fetch_subscription(&bin, id)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn read_config(profile: Profile, settings: Settings) -> Result<ReadConfigResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pipeline::read_config(&profile, settings.default_xray_path.as_deref())
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn test_config(profile: Profile, settings: Settings, tabs: TabContents) -> Result<TestResult, String> {
    let template = effective_template(&settings);
    tauri::async_runtime::spawn_blocking(move || {
        pipeline::test_config(&profile, settings.default_xray_path.as_deref(), &tabs, &template)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
}

#[tauri::command]
async fn apply_config(profile: Profile, settings: Settings, tabs: TabContents) -> Result<ApplyResult, String> {
    let template = effective_template(&settings);
    tauri::async_runtime::spawn_blocking(move || {
        pipeline::apply_config(&profile, settings.default_xray_path.as_deref(), &tabs, &template)
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))?
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
            is_admin,
            restart_as_admin,
            knife_resolve,
            knife_list_subscriptions,
            knife_test_subscription,
            knife_list_configs,
            knife_test_all,
            knife_parse_link,
            knife_parse_links,
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
