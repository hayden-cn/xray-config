use std::path::Path;

use xray_config_lib::models::{Profile, TabContents};
use xray_config_lib::pipeline;
use xray_config_lib::xray::find_xray;

fn sample_tabs() -> TabContents {
    TabContents {
        inbounds: r#"[ { "tag": "socks-in", "port": 1080, "protocol": "socks", "settings": { "auth": "noauth", "udp": true } } ]"#.into(),
        outbounds: r#"[ { "tag": "direct", "protocol": "freedom" } ]"#.into(),
        rules: r#"[ { "type": "field", "domain": ["geosite:cn"], "outboundTag": "direct" } ]"#.into(),
        balancers: String::new(),
        other: r#"{ "log": { "loglevel": "warning" } }"#.into(),
    }
}

fn profile(dir: &Path) -> Profile {
    let bin = find_xray(None, None).expect("未找到 xray，请确保其在 PATH 中");
    Profile {
        id: "t".into(),
        name: "t".into(),
        path: dir.to_string_lossy().into_owned(),
        api_address: None,
        xray_path: Some(bin.to_string_lossy().into_owned()),
        post_apply_command: None,
    }
}

#[test]
fn test_config_passes() {
    let dir = tempfile::tempdir().unwrap();
    let p = profile(dir.path());
    let t = pipeline::test_config(&p, None, &sample_tabs(), &xray_config_lib::models::default_template())
        .expect("test_config 应能运行");
    assert!(t.ok, "校验未通过 code={} stderr={}", t.code, t.stderr);
}

#[test]
fn apply_then_read_roundtrips() {
    let dir = tempfile::tempdir().unwrap();
    let p = profile(dir.path());
    let r = pipeline::apply_config(&p, None, &sample_tabs(), &xray_config_lib::models::default_template())
        .expect("apply_config 应能运行");
    assert!(r.ok, "应用失败: {}", r.message);
    for f in ["05_inbounds.jsonc", "06_outbounds.jsonc", "03_routing.jsonc", "00_log.jsonc"] {
        assert!(r.written_files.iter().any(|w| w == f), "缺少写入文件 {}", f);
    }

    let read = pipeline::read_config(&p, None).expect("read_config 应能运行");
    assert_eq!(read.mode, "folder");
    for needle in ["socks-in", "freedom", "geosite:cn", "loglevel"] {
        assert!(read.content.contains(needle), "dump 输出缺少 {}", needle);
    }
    assert!(read.files.iter().any(|f| f.ends_with(".jsonc")));
}

#[test]
fn invalid_json_tab_fails_test() {
    let dir = tempfile::tempdir().unwrap();
    let p = profile(dir.path());
    let mut tabs = sample_tabs();
    tabs.outbounds = "[{ broken".into();
    let err = pipeline::test_config(&p, None, &tabs, &xray_config_lib::models::default_template())
        .err()
        .expect("非法 JSON 应返回错误");
    assert!(err.contains("出站") || err.contains("JSON"), "错误信息: {}", err);
}

#[cfg(windows)]
#[test]
fn apply_runs_post_apply_command() {
    let dir = tempfile::tempdir().unwrap();
    let mut p = profile(dir.path());
    let marker = dir.path().join("post.txt");
    p.post_apply_command = Some(format!("cmd /C echo done > \"{}\"", marker.display()));
    let r = pipeline::apply_config(
        &p,
        None,
        &sample_tabs(),
        &xray_config_lib::models::default_template(),
    )
    .expect("apply_config 应能运行");
    assert!(r.ok, "应用失败: {}", r.message);
    let out = r.post_command.expect("应执行应用后命令");
    assert_eq!(out.code, 0, "命令失败: {}", out.stderr);
    assert!(marker.exists(), "命令应在 profile 目录执行并写入文件");
}
