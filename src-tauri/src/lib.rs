use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static BACKEND_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

fn is_backend_alive() -> bool {
    if let Ok(addr) = "127.0.0.1:3351".parse() {
        TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
    } else {
        false
    }
}

fn find_project_root() -> Option<PathBuf> {
    // 1. Current working directory
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("src").join("server").join("index.ts").exists() {
            return Some(cwd);
        }
    }

    // 2. Traversal relative to current exe location
    if let Ok(exe_path) = std::env::current_exe() {
        let mut dir = exe_path.parent();
        for _ in 0..5 {
            if let Some(d) = dir {
                if d.join("src").join("server").join("index.ts").exists() {
                    return Some(d.to_path_buf());
                }
                dir = d.parent();
            } else {
                break;
            }
        }
    }

    None
}

fn find_bun_binary() -> String {
    // Check if bun is directly accessible in PATH
    if Command::new("bun").arg("--version").output().is_ok() {
        return "bun".to_string();
    }

    // Check default Windows bun installation path (%USERPROFILE%\.bun\bin\bun.exe)
    if let Ok(userprofile) = std::env::var("USERPROFILE") {
        let candidate = PathBuf::from(userprofile).join(".bun").join("bin").join("bun.exe");
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    "bun".to_string()
}

fn try_spawn_backend() {
    if is_backend_alive() {
        return;
    }

    let Some(project_root) = find_project_root() else {
        return;
    };
    let bun_bin = find_bun_binary();

    #[cfg(target_os = "windows")]
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut cmd = Command::new(bun_bin);
    cmd.arg("src/server/index.ts")
        .current_dir(project_root)
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Ok(child) = cmd.spawn() {
        if let Ok(mut guard) = BACKEND_PROCESS.lock() {
            *guard = Some(child);
        }
        // Wait up to 2.5 seconds for the server to bind port 3351
        for _ in 0..10 {
            std::thread::sleep(Duration::from_millis(250));
            if is_backend_alive() {
                break;
            }
        }
    }
}

fn kill_backend_child() {
    if let Ok(mut guard) = BACKEND_PROCESS.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
        }
    }
}

#[tauri::command]
fn get_app_version() -> String {
    "1.1.0".to_string()
}

#[tauri::command]
fn check_backend_status() -> bool {
    is_backend_alive()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            try_spawn_backend();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_app_version, check_backend_status])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                kill_backend_child();
            }
        });
}


