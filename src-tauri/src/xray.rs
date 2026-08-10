use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crate::models::{CommandOutput, TestResult};

pub fn find_xray(profile_xray: Option<&str>, default_xray: Option<&str>) -> Result<PathBuf, String> {
    if let Some(p) = profile_xray.map(str::trim).filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Ok(pb);
        }
        return Err(format!("profile 中指定的 xray 路径不存在: {}", p));
    }
    if let Some(p) = default_xray.map(str::trim).filter(|s| !s.is_empty()) {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Ok(pb);
        }
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
    Err("未找到 xray 可执行文件（已在 profile、默认设置、应用启动目录与系统 PATH 中查找）".into())
}

fn candidate_names() -> Vec<String> {
    if cfg!(windows) {
        vec!["xray.exe".into(), "xray.cmd".into(), "xray.bat".into()]
    } else {
        vec!["xray".into()]
    }
}

pub fn run_with_timeout(
    bin: &Path,
    args: &[String],
    timeout: Duration,
) -> Result<CommandOutput, String> {
    let mut child = Command::new(bin)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 xray 失败: {}", e))?;

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();

    let out_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let err_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));

    let out_target = out_buf.clone();
    let out_reader = thread::spawn(move || {
        if let Some(mut r) = stdout_pipe {
            let mut s = String::new();
            let _ = r.read_to_string(&mut s);
            if let Ok(mut guard) = out_target.lock() {
                *guard = s;
            }
        }
    });
    let err_target = err_buf.clone();
    let err_reader = thread::spawn(move || {
        if let Some(mut r) = stderr_pipe {
            let mut s = String::new();
            let _ = r.read_to_string(&mut s);
            if let Ok(mut guard) = err_target.lock() {
                *guard = s;
            }
        }
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(s)) => break s,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("xray 命令执行超时".into());
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(format!("等待 xray 进程失败: {}", e)),
        }
    };

    let _ = out_reader.join();
    let _ = err_reader.join();

    Ok(CommandOutput {
        code: status.code().unwrap_or(-1),
        stdout: out_buf.lock().map(|g| g.clone()).unwrap_or_default(),
        stderr: err_buf.lock().map(|g| g.clone()).unwrap_or_default(),
    })
}

pub fn run_test(bin: &Path, confdir: &Path) -> Result<TestResult, String> {
    let args = vec![
        "run".into(),
        format!("-confdir={}", confdir.display()),
        "-test".into(),
    ];
    let out = run_with_timeout(bin, &args, Duration::from_secs(20))?;
    let ok = out.code == 0;
    let message = if ok {
        "配置校验通过".into()
    } else {
        format!("配置校验失败 (exit {})", out.code)
    };
    Ok(TestResult {
        ok,
        code: out.code,
        message,
        stdout: out.stdout,
        stderr: out.stderr,
    })
}

pub fn dump_folder(bin: &Path, dir: &Path) -> Result<String, String> {
    let args = vec![
        "run".into(),
        format!("-confdir={}", dir.display()),
        "-dump".into(),
    ];
    let out = run_with_timeout(bin, &args, Duration::from_secs(20))?;
    if out.code != 0 {
        let detail = out.stderr.trim();
        let detail = if detail.is_empty() { out.stdout.trim() } else { detail };
        return Err(format!("xray dump 失败 (exit {}):\n{}", out.code, detail));
    }
    if out.stdout.trim().is_empty() {
        return Err("xray dump 输出为空".into());
    }
    Ok(out.stdout)
}

pub fn api_list(bin: &Path, server: &str, kind: &str) -> Result<CommandOutput, String> {
    let args = vec![
        "api".into(),
        kind.into(),
        format!("--server={}", server),
        "-t".into(),
        "10".into(),
    ];
    run_with_timeout(bin, &args, Duration::from_secs(15))
}

pub fn api_add(bin: &Path, server: &str, kind: &str, config_file: &Path) -> Result<CommandOutput, String> {
    let args = vec![
        "api".into(),
        kind.into(),
        format!("--server={}", server),
        "-t".into(),
        "30".into(),
        config_file.display().to_string(),
    ];
    run_with_timeout(bin, &args, Duration::from_secs(60))
}

pub fn api_remove(bin: &Path, server: &str, kind: &str, tags: &[String]) -> Result<CommandOutput, String> {
    let mut args = vec![
        "api".into(),
        kind.into(),
        format!("--server={}", server),
        "-t".into(),
        "30".into(),
    ];
    args.extend(tags.iter().cloned());
    run_with_timeout(bin, &args, Duration::from_secs(60))
}

pub fn api_adrules(bin: &Path, server: &str, config_file: &Path) -> Result<CommandOutput, String> {
    let args = vec![
        "api".into(),
        "adrules".into(),
        format!("--server={}", server),
        "-t".into(),
        "30".into(),
        config_file.display().to_string(),
    ];
    run_with_timeout(bin, &args, Duration::from_secs(60))
}
