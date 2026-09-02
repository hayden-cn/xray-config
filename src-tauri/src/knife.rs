use std::path::{Path, PathBuf};
use std::time::Duration;

use crate::models::{KnifeParseResult, KnifeSubscription};
use crate::xray::run_with_timeout;

pub fn find_knife(default_knife: Option<&str>) -> Result<PathBuf, String> {
    if let Some(p) = default_knife.map(str::trim).filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Ok(pb);
        }
        return Err(format!("设置中指定的 xray-knife 路径不存在: {}", p));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for cand in candidate_names() {
                let p = dir.join(cand);
                if p.is_file() {
                    return Ok(p);
                }
            }
        }
    }
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(';') {
            if dir.trim().is_empty() {
                continue;
            }
            for cand in candidate_names() {
                let p = Path::new(dir).join(cand);
                if p.is_file() {
                    return Ok(p);
                }
            }
        }
    }
    Err("未找到 xray-knife 可执行文件（已在默认设置、应用启动目录与系统 PATH 中查找）".into())
}

fn candidate_names() -> Vec<String> {
    if cfg!(windows) {
        vec!["xray-knife.exe".into(), "xray-knife.cmd".into(), "xray-knife.bat".into()]
    } else {
        vec!["xray-knife".into()]
    }
}

pub fn list_subscriptions(bin: &Path) -> Result<Vec<KnifeSubscription>, String> {
    let args = vec!["subs".into(), "show".into(), "--verbose".into()];
    let out = run_with_timeout(bin, &args, Duration::from_secs(15))?;
    if out.code != 0 {
        let detail = out.stderr.trim();
        let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
        return Err(format!("xray-knife subs show 失败 (exit {}):\n{}", out.code, detail));
    }
    parse_subs_table(&out.stdout)
}

fn parse_subs_table(stdout: &str) -> Result<Vec<KnifeSubscription>, String> {
    let mut subs = Vec::new();
    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("ID") || trimmed.starts_with("--") {
            continue;
        }
        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }
        let Ok(id) = parts[0].parse::<i64>() else { continue };

        let enabled_idx = parts.iter().position(|p| *p == "true" || *p == "false");
        let Some(ien) = enabled_idx else { continue };

        let remark = parts[1..ien].join(" ");

        let enabled = parts[ien] == "true";

        let configs = parts
            .get(ien + 1)
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        let url = parts[ien + 2..].join(" ");

        subs.push(KnifeSubscription { id, remark, url, enabled, configs });
    }
    Ok(subs)
}

pub fn test_subscription(bin: &Path, sub_id: i64) -> Result<Vec<String>, String> {
    let dir = tempfile::tempdir().map_err(|e| format!("创建临时目录失败: {}", e))?;
    let out_path = dir.path().join("valid_links.txt");

    let args = vec![
        "http".into(),
        "--from-db".into(),
        "--sub-id".into(),
        sub_id.to_string(),
        "-x".into(),
        "txt".into(),
        "-o".into(),
        out_path.to_string_lossy().into_owned(),
    ];
    let out = run_with_timeout(bin, &args, Duration::from_secs(600))?;
    if out.code != 0 {
        let detail = out.stderr.trim();
        let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
        return Err(format!("xray-knife http 测试失败 (exit {}):\n{}", out.code, detail));
    }

    let content = std::fs::read_to_string(&out_path).unwrap_or_default();
    let links: Vec<String> = content
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && l.contains("://"))
        .collect();
    Ok(links)
}

pub fn parse_link(bin: &Path, link: &str) -> Result<KnifeParseResult, String> {
    let args = vec!["parse".into(), "-c".into(), link.to_string(), "-j".into()];
    let out = run_with_timeout(bin, &args, Duration::from_secs(30))?;
    if out.code != 0 {
        let detail = out.stderr.trim();
        let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
        return Ok(KnifeParseResult { ok: false, error: Some(detail.to_string()), outbound: None });
    }
    match serde_json::from_str::<serde_json::Value>(&out.stdout) {
        Ok(json) => {
            let ob = json.get("outbounds").and_then(|o| o.as_array()).and_then(|a| a.first());
            match ob {
                Some(v) => Ok(KnifeParseResult { ok: true, error: None, outbound: Some(v.clone()) }),
                None => Ok(KnifeParseResult {
                    ok: false,
                    error: Some("解析结果中没有 outbounds".into()),
                    outbound: None,
                }),
            }
        }
        Err(e) => Ok(KnifeParseResult {
            ok: false,
            error: Some(format!("解析 xray-knife 输出失败: {}", e)),
            outbound: None,
        }),
    }
}

pub fn add_subscription(bin: &Path, url: &str, remark: &str) -> Result<(), String> {
    let mut args = vec!["subs".into(), "add".into(), "--url".into(), url.to_string()];
    if !remark.trim().is_empty() {
        args.push("--remark".into());
        args.push(remark.trim().to_string());
    }
    run_ok(bin, &args)
}

pub fn remove_subscription(bin: &Path, id: i64) -> Result<(), String> {
    let args = vec![
        "subs".into(),
        "rm".into(),
        id.to_string(),
        "--yes".into(),
    ];
    run_ok(bin, &args)
}

pub fn update_subscription(
    bin: &Path,
    id: i64,
    url: Option<&str>,
    remark: Option<&str>,
) -> Result<(), String> {
    let mut args = vec!["subs".into(), "update".into(), "--id".into(), id.to_string()];
    if let Some(u) = url.filter(|s| !s.trim().is_empty()) {
        args.push("--url".into());
        args.push(u.trim().to_string());
    }
    if let Some(r) = remark {
        args.push("--remark".into());
        args.push(r.to_string());
    }
    run_ok(bin, &args)
}

pub fn fetch_subscription(bin: &Path, id: i64) -> Result<(), String> {
    let args = vec!["subs".into(), "fetch".into(), "--id".into(), id.to_string()];
    run_ok(bin, &args)
}

fn run_ok(bin: &Path, args: &[String]) -> Result<(), String> {
    let out = run_with_timeout(bin, args, Duration::from_secs(60))?;
    if out.code != 0 {
        let detail = out.stderr.trim();
        let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
        return Err(format!("xray-knife 命令失败 (exit {}):\n{}", out.code, detail));
    }
    Ok(())
}
