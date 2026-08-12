use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::time::Duration;

use serde_json::{Map, Value};
use tempfile::TempDir;

use crate::models::{
    ApiStep, ApiUpdateResult, ApplyResult, CommandOutput, Profile, ReadConfigResult, TabContents,
    TemplateEntry, TestResult,
};
use crate::xray;

fn strip_jsonc(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(s.len());
    let mut i = 0;
    let mut in_string = false;
    let mut escaped = false;
    while i < s.len() {
        let c = bytes[i];
        if in_string {
            out.push(c);
            if escaped {
                escaped = false;
            } else if c == b'\\' {
                escaped = true;
            } else if c == b'"' {
                in_string = false;
            }
            i += 1;
            continue;
        }
        if c == b'"' {
            in_string = true;
            out.push(c);
            i += 1;
            continue;
        }
        if c == b'/' && i + 1 < s.len() {
            if bytes[i + 1] == b'/' {
                while i < s.len() && bytes[i] != b'\n' {
                    i += 1;
                }
                if i < s.len() {
                    out.push(bytes[i]);
                    i += 1;
                }
                continue;
            } else if bytes[i + 1] == b'*' {
                i += 2;
                while i + 1 < s.len() && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                    i += 1;
                }
                i += 2;
                continue;
            }
        }
        out.push(c);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn parse_value(text: &str) -> Result<Value, String> {
    let cleaned = strip_jsonc(text);
    serde_json::from_str(&cleaned).map_err(|e| format!("JSON 解析错误: {}", e))
}

fn parse_array_optional(text: &str, name: &str) -> Result<Option<Value>, String> {
    let t = text.trim();
    if t.is_empty() || t == "{}" {
        return Ok(None);
    }
    let v = parse_value(text).map_err(|e| format!("{}页签内容无效: {}", name, e))?;
    match v {
        Value::Array(_) => Ok(Some(v)),
        _ => Err(format!("{}页签内容必须是 JSON 数组", name)),
    }
}

pub fn build_full_object(tabs: &TabContents) -> Result<Value, String> {
    let mut obj: Map<String, Value> = Map::new();
    let mut other_routing: Option<Map<String, Value>> = None;

    let other_trim = tabs.other.trim();
    if !other_trim.is_empty() {
        let v = parse_value(&tabs.other).map_err(|e| format!("「其他」页签内容无效: {}", e))?;
        let map = v
            .as_object()
            .ok_or_else(|| "「其他」页签内容必须是 JSON 对象".to_string())?;
        for (k, val) in map {
            if k == "routing" {
                match val {
                    Value::Object(rm) => {
                        let mut rm = rm.clone();
                        rm.remove("rules");
                        rm.remove("balancers");
                        other_routing = Some(rm);
                    }
                    _ => return Err("「其他」页签中的 routing 必须是 JSON 对象".into()),
                }
            } else if k != "inbounds" && k != "outbounds" {
                obj.insert(k.clone(), val.clone());
            }
        }
    }

    if let Some(v) = parse_array_optional(&tabs.inbounds, "「入站」")? {
        obj.insert("inbounds".into(), v);
    }
    if let Some(v) = parse_array_optional(&tabs.outbounds, "「出站」")? {
        obj.insert("outbounds".into(), v);
    }

    let mut routing = other_routing.unwrap_or_default();
    if let Some(v) = parse_array_optional(&tabs.rules, "「路由规则」")? {
        routing.insert("rules".into(), v);
    }
    if let Some(v) = parse_array_optional(&tabs.balancers, "「负载均衡」")? {
        routing.insert("balancers".into(), v);
    }
    if !routing.is_empty() {
        obj.insert("routing".into(), Value::Object(routing));
    }

    Ok(Value::Object(obj))
}

pub fn validate_template(template: &[TemplateEntry]) -> Result<(), String> {
    for e in template {
        let name = e.file.trim();
        if name.is_empty() {
            return Err("模板中存在空文件名".into());
        }
        if name.contains('/') || name.contains('\\') || name.contains("..") {
            return Err(format!("模板文件名不合法: {}", name));
        }
        if e.keys.is_empty() {
            return Err(format!("模板条目 {} 未指定任何配置键", name));
        }
    }
    Ok(())
}

pub fn split_by_template(
    obj: &Value,
    template: &[TemplateEntry],
) -> Result<Vec<(String, Value)>, String> {
    validate_template(template)?;
    let obj_map = match obj {
        Value::Object(m) => m,
        _ => return Err("内部错误：合并结果不是对象".into()),
    };
    let mut used: HashSet<String> = HashSet::new();
    let mut files: Vec<(String, Value)> = Vec::new();
    for entry in template {
        let mut file_obj: Map<String, Value> = Map::new();
        for key in &entry.keys {
            if key == "*" {
                for (k, v) in obj_map {
                    if !used.contains(k) {
                        file_obj.insert(k.clone(), v.clone());
                    }
                }
            } else if let Some(v) = obj_map.get(key) {
                file_obj.insert(key.clone(), v.clone());
                used.insert(key.clone());
            }
        }
        if !file_obj.is_empty() {
            files.push((entry.file.clone(), Value::Object(file_obj)));
        }
    }
    Ok(files)
}

fn serialize_section(name: &str, value: &Value) -> Result<String, String> {
    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("序列化 {} 失败: {}", name, e))?;
    if name.to_lowercase().ends_with(".jsonc") {
        Ok(format!("// 拆分文件：{}\n{}\n", name, json))
    } else {
        Ok(format!("{}\n", json))
    }
}

fn write_temp_files(files: &[(String, Value)]) -> Result<TempDir, String> {
    let dir = tempfile::tempdir().map_err(|e| format!("无法创建临时目录: {}", e))?;
    if files.is_empty() {
        fs::write(dir.path().join("00-config.json"), "{}\n")
            .map_err(|e| format!("写入临时配置失败: {}", e))?;
        return Ok(dir);
    }
    for (name, value) in files {
        let text = serialize_section(name, value)?;
        fs::write(dir.path().join(name), text)
            .map_err(|e| format!("写入 {} 失败: {}", name, e))?;
    }
    Ok(dir)
}

fn strip_typed_message(v: &mut Value) {
    match v {
        Value::Object(m) => {
            m.remove("_TypedMessage_");
            for val in m.values_mut() {
                strip_typed_message(val);
            }
        }
        Value::Array(a) => {
            for val in a {
                strip_typed_message(val);
            }
        }
        _ => {}
    }
}

fn normalize_dump(text: &str) -> Result<String, String> {
    let mut v: Value =
        serde_json::from_str(text).map_err(|e| format!("dump 输出解析失败: {}", e))?;
    strip_typed_message(&mut v);
    if let Value::Object(m) = &mut v {
        if let Some(fd) = m.remove("fakeDns") {
            m.insert("fakedns".into(), fd);
        }
    }
    serde_json::to_string_pretty(&v).map_err(|e| format!("dump 输出序列化失败: {}", e))
}

fn read_plain(profile: &Profile, default_xray: Option<&str>) -> Result<ReadConfigResult, String> {
    let path = Path::new(&profile.path);
    let meta = fs::metadata(path).map_err(|e| format!("无法访问路径 {}: {}", profile.path, e))?;
    if meta.is_dir() {
        let bin = xray::find_xray(profile.xray_path.as_deref(), default_xray)?;
        let content = xray::dump_folder(&bin, path)?;
        let content = normalize_dump(&content)?;
        let mut files: Vec<String> = Vec::new();
        let entries = fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))?;
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(name) = p.file_name() {
                    files.push(name.to_string_lossy().into_owned());
                }
            }
        }
        files.sort();
        Ok(ReadConfigResult {
            mode: "folder".into(),
            content,
            files,
            warning: None,
        })
    } else {
        let content = fs::read_to_string(path).map_err(|e| format!("读取文件失败: {}", e))?;
        Ok(ReadConfigResult {
            mode: "file".into(),
            content,
            files: vec![profile.path.clone()],
            warning: None,
        })
    }
}

fn extract_tags(arr: Option<&Value>) -> Vec<String> {
    match arr {
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|it| it.get("tag").and_then(|t| t.as_str()).map(String::from))
            .collect(),
        _ => vec![],
    }
}

fn parse_list_tags(text: &str, key: &str) -> Vec<String> {
    let v: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return vec![],
    };
    let items: Vec<&Value> = match &v {
        Value::Array(arr) => arr.iter().collect(),
        Value::Object(m) => match m.get(key).and_then(|x| x.as_array()) {
            Some(arr) => arr.iter().collect(),
            None => vec![],
        },
        _ => vec![],
    };
    items
        .into_iter()
        .filter_map(|it| {
            it.as_str()
                .map(String::from)
                .or_else(|| it.get("tag").and_then(|t| t.as_str()).map(String::from))
        })
        .collect()
}

fn verify_api(profile: &Profile, bin: &Path, content: &str) -> Option<String> {
    let addr = profile
        .api_address
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())?;
    let parsed: Value = serde_json::from_str(content).ok()?;
    let local_in = extract_tags(parsed.get("inbounds"));
    let local_out = extract_tags(parsed.get("outbounds"));
    let mut warnings: Vec<String> = Vec::new();

    let mut check = |kind: &str, key: &str, local: &[String]| {
        match xray::api_list(bin, addr, kind) {
            Ok(out) => {
                if out.code == 0 {
                    let live = parse_list_tags(&out.stdout, key);
                    let missing: Vec<String> =
                        local.iter().filter(|t| !live.contains(t)).cloned().collect();
                    let extra: Vec<String> =
                        live.iter().filter(|t| !local.contains(t)).cloned().collect();
                    if !missing.is_empty() {
                        warnings.push(format!(
                            "运行实例缺少配置中的{}: {}",
                            if kind == "lsi" { "入站" } else { "出站" },
                            missing.join(", ")
                        ));
                    }
                    if !extra.is_empty() {
                        warnings.push(format!(
                            "运行实例存在配置之外的{}: {}",
                            if kind == "lsi" { "入站" } else { "出站" },
                            extra.join(", ")
                        ));
                    }
                } else {
                    warnings.push(format!(
                        "无法获取运行实例{}列表 (exit {}): {}",
                        if kind == "lsi" { "入站" } else { "出站" },
                        out.code,
                        out.stderr.trim()
                    ));
                }
            }
            Err(e) => warnings.push(format!(
                "无法获取运行实例{}列表: {}",
                if kind == "lsi" { "入站" } else { "出站" },
                e
            )),
        }
    };
    check("lsi", "inbounds", &local_in);
    check("lso", "outbounds", &local_out);

    if warnings.is_empty() {
        None
    } else {
        Some(warnings.join("；"))
    }
}

pub fn read_config(profile: &Profile, default_xray: Option<&str>) -> Result<ReadConfigResult, String> {
    let mut r = read_plain(profile, default_xray)?;
    if profile
        .api_address
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_some()
    {
        let bin = xray::find_xray(profile.xray_path.as_deref(), default_xray)?;
        r.warning = verify_api(profile, &bin, &r.content);
    }
    Ok(r)
}

pub fn test_config(
    profile: &Profile,
    default_xray: Option<&str>,
    tabs: &TabContents,
    template: &[TemplateEntry],
) -> Result<TestResult, String> {
    let bin = xray::find_xray(profile.xray_path.as_deref(), default_xray)?;
    let obj = build_full_object(tabs)?;
    let files = split_by_template(&obj, template)?;
    let dir = write_temp_files(&files)?;
    xray::run_test(&bin, dir.path())
}

fn tag_map(arr: Option<&Value>) -> HashMap<String, Value> {
    let mut m = HashMap::new();
    if let Some(Value::Array(items)) = arr {
        for it in items {
            if let Some(t) = it.get("tag").and_then(|t| t.as_str()) {
                m.insert(t.to_string(), it.clone());
            }
        }
    }
    m
}

fn reconcile_lists(old_arr: Option<&Value>, new_arr: Option<&Value>) -> (Vec<Value>, Vec<String>) {
    let old_map = tag_map(old_arr);
    let new_map = tag_map(new_arr);
    let mut add: Vec<Value> = Vec::new();
    let mut remove: Vec<String> = Vec::new();
    for (tag, val) in &new_map {
        match old_map.get(tag) {
            Some(ov) => {
                if ov != val {
                    remove.push(tag.clone());
                    add.push(val.clone());
                }
            }
            None => add.push(val.clone()),
        }
    }
    for tag in old_map.keys() {
        if !new_map.contains_key(tag) {
            remove.push(tag.clone());
        }
    }
    (add, remove)
}

fn write_api_config(entries: &[(&str, Value)]) -> Result<TempDir, String> {
    let mut obj: Map<String, Value> = Map::new();
    for (k, v) in entries {
        obj.insert(k.to_string(), v.clone());
    }
    let dir = tempfile::tempdir().map_err(|e| format!("无法创建临时目录: {}", e))?;
    let json = serde_json::to_string_pretty(&Value::Object(obj))
        .map_err(|e| format!("序列化 API 配置失败: {}", e))?;
    fs::write(dir.path().join("api.json"), format!("{}\n", json))
        .map_err(|e| format!("写入 API 配置失败: {}", e))?;
    Ok(dir)
}

fn api_err_msg(out: &CommandOutput) -> String {
    let detail = out.stderr.trim();
    let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
    if detail.is_empty() {
        format!("退出码 {}", out.code)
    } else {
        detail.to_string()
    }
}

fn run_api_update(bin: &Path, addr: &str, old: &Value, new: &Value) -> Result<ApiUpdateResult, String> {
    let mut steps: Vec<ApiStep> = Vec::new();
    let mut ok_all = true;

    let (add_in, rem_in) = reconcile_lists(old.get("inbounds"), new.get("inbounds"));
    let (add_out, rem_out) = reconcile_lists(old.get("outbounds"), new.get("outbounds"));

    if !rem_out.is_empty() {
        let out = xray::api_remove(bin, addr, "rmo", &rem_out)?;
        let ok = out.code == 0;
        ok_all &= ok;
        steps.push(ApiStep {
            command: format!("rmo {}", rem_out.join(", ")),
            ok,
            message: if ok { "移除成功".into() } else { api_err_msg(&out) },
        });
    }
    if !rem_in.is_empty() {
        let out = xray::api_remove(bin, addr, "rmi", &rem_in)?;
        let ok = out.code == 0;
        ok_all &= ok;
        steps.push(ApiStep {
            command: format!("rmi {}", rem_in.join(", ")),
            ok,
            message: if ok { "移除成功".into() } else { api_err_msg(&out) },
        });
    }
    if !add_out.is_empty() {
        let dir = write_api_config(&[("outbounds", Value::Array(add_out))])?;
        let out = xray::api_add(bin, addr, "ado", &dir.path().join("api.json"))?;
        let ok = out.code == 0;
        ok_all &= ok;
        steps.push(ApiStep {
            command: format!("ado 新增/更新出站"),
            ok,
            message: if ok { "更新成功".into() } else { api_err_msg(&out) },
        });
    }
    if !add_in.is_empty() {
        let dir = write_api_config(&[("inbounds", Value::Array(add_in))])?;
        let out = xray::api_add(bin, addr, "adi", &dir.path().join("api.json"))?;
        let ok = out.code == 0;
        ok_all &= ok;
        steps.push(ApiStep {
            command: format!("adi 新增/更新入站"),
            ok,
            message: if ok { "更新成功".into() } else { api_err_msg(&out) },
        });
    }

    let old_routing = old.get("routing");
    let new_routing = new.get("routing");
    let old_rules = old_routing.and_then(|r| r.get("rules"));
    let new_rules = new_routing.and_then(|r| r.get("rules"));
    if old_rules != new_rules {
        let rules = new_rules.cloned().unwrap_or_else(|| Value::Array(vec![]));
        let dir = write_api_config(&[(
            "routing",
            Value::Object(Map::from_iter([("rules".into(), rules)])),
        )])?;
        let out = xray::api_adrules(bin, addr, &dir.path().join("api.json"))?;
        let ok = out.code == 0;
        ok_all &= ok;
        steps.push(ApiStep {
            command: "adrules 更新路由规则".into(),
            ok,
            message: if ok { "更新成功".into() } else { api_err_msg(&out) },
        });
    }

    let old_balancers = old_routing.and_then(|r| r.get("balancers"));
    let new_balancers = new_routing.and_then(|r| r.get("balancers"));
    if old_balancers != new_balancers {
        steps.push(ApiStep {
            command: "balancers".into(),
            ok: true,
            message: "负载均衡无法通过 API 热更新，需重启 xray 生效".into(),
        });
    }

    Ok(ApiUpdateResult {
        ok: ok_all,
        message: if ok_all {
            "API 热更新完成".into()
        } else {
            "部分 API 更新失败，见下方明细".into()
        },
        steps,
    })
}

pub fn apply_config(
    profile: &Profile,
    default_xray: Option<&str>,
    tabs: &TabContents,
    template: &[TemplateEntry],
) -> Result<ApplyResult, String> {
    let bin = xray::find_xray(profile.xray_path.as_deref(), default_xray)?;
    let obj = build_full_object(tabs)?;
    let files = split_by_template(&obj, template)?;
    let dir = write_temp_files(&files)?;
    let test = xray::run_test(&bin, dir.path())?;
    if !test.ok {
        return Ok(ApplyResult {
            ok: false,
            message: format!("校验未通过，未写入配置。{}", test.message),
            test: Some(test),
            written_files: vec![],
            api_update: None,
            post_command: None,
        });
    }

    let has_api = profile
        .api_address
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_some();
    let old_obj = if has_api {
        read_plain(profile, default_xray)
            .ok()
            .and_then(|r| parse_value(&r.content).ok())
    } else {
        None
    };

    let path = Path::new(&profile.path);
    let meta = fs::metadata(path).map_err(|e| format!("无法访问路径 {}: {}", profile.path, e))?;
    let mut written_files: Vec<String> = Vec::new();

    if meta.is_dir() {
        let entries = fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))?;
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension().map(|e| e.to_string_lossy().to_lowercase()) {
                    if ext == "json" || ext == "jsonc" {
                        fs::remove_file(&p).map_err(|e| format!("删除 {} 失败: {}", p.display(), e))?;
                    }
                }
            }
        }
        for (name, value) in &files {
            let text = serialize_section(name, value)?;
            fs::write(path.join(name), text)
                .map_err(|e| format!("写入 {} 失败: {}", name, e))?;
            written_files.push(name.clone());
        }
    } else {
        let json = serde_json::to_string_pretty(&obj)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        fs::write(path, format!("{}\n", json)).map_err(|e| format!("写入文件失败: {}", e))?;
        written_files.push(profile.path.clone());
    }

    let api_update = if has_api {
        let addr = profile.api_address.as_deref().unwrap_or_default().trim().to_string();
        Some(run_api_update(&bin, &addr, &old_obj.unwrap_or_default(), &obj)?)
    } else {
        None
    };
    let mut message = match &api_update {
        Some(u) if !u.ok => "配置已写入；API 热更新未完全成功，见下方明细".to_string(),
        _ => "配置已写入".to_string(),
    };

    let mut post_command = None;
    if let Some(cmd) = profile
        .post_apply_command
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        let cwd = if meta.is_dir() { Some(path) } else { path.parent() };
        post_command = Some(match xray::run_shell(cmd, cwd, Duration::from_secs(60)) {
            Ok(out) => out,
            Err(e) => CommandOutput { code: -1, stdout: String::new(), stderr: e },
        });
        if post_command.as_ref().map(|o| o.code).unwrap_or(-1) != 0 {
            message.push_str("；应用后命令执行失败");
        }
    }

    Ok(ApplyResult {
        ok: true,
        message,
        test: Some(test),
        written_files,
        api_update,
        post_command,
    })
}
