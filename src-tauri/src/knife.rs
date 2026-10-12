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

/// 解析 `subs show --verbose` 表格。列序：ID REMARK URL ENABLED CONFIGS LAST FETCHED。
/// 备注可能含空格、时间列含空格，故从右向左以 true/false 锚定 ENABLED 列再切分。
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

        // ENABLED 是唯一的 true/false 单元格，取最右一个以防备注/URL 中恰好出现该词
        let Some(ien) = parts.iter().rposition(|p| *p == "true" || *p == "false") else {
            continue;
        };
        let enabled = parts[ien] == "true";
        let configs_idx = ien + 1;
        let configs = parts
            .get(configs_idx)
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        // ENABLED 之前右起第一个含 "://" 的 token 为 URL 列起点
        // （备注为空时 REMARK 列也显示 URL，须从右取而非从左，否则会把备注当成 URL）
        let url_start = parts[1..ien].iter().rposition(|p| p.contains("://"));
        let (remark, url) = match url_start {
            Some(pos) => {
                let i = pos + 1;
                (parts[1..i].join(" "), parts[i..ien].join(" "))
            }
            None => (parts[1..ien].join(" "), String::new()),
        };

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

#[cfg(test)]
mod tests {
    use super::parse_subs_table;

    #[test]
    fn parses_verbose_table_with_spaces_in_remark_and_time() {
        let stdout = "\
✅ 14:05:15 Successfully added subscription: https://test.example.com/sub?a=1
ID   REMARK        URL                              ENABLED   CONFIGS   LAST FETCHED
--   ------        ---                              -------   -------   ------------
1    N/A           https://a.example.com/sub.txt    true      350       2026-10-12 05:50
5    my remark 备注 test  https://b.example.com/sub  false     0         Never
8    https://c.example.com/sub  https://c.example.com/sub  true  12      2026-10-12 05:53
";
        let subs = parse_subs_table(stdout).unwrap();
        assert_eq!(subs.len(), 3);
        assert_eq!(subs[0].remark, "N/A");
        assert_eq!(subs[0].url, "https://a.example.com/sub.txt");
        assert!(subs[0].enabled);
        assert_eq!(subs[0].configs, 350);
        assert_eq!(subs[1].remark, "my remark 备注 test");
        assert_eq!(subs[1].url, "https://b.example.com/sub");
        assert!(!subs[1].enabled);
        assert_eq!(subs[1].configs, 0);
        // 备注为空时 REMARK 列回显 URL，两者都应保留
        assert_eq!(subs[2].remark, "https://c.example.com/sub");
        assert_eq!(subs[2].url, "https://c.example.com/sub");
        assert_eq!(subs[2].configs, 12);
    }
}
