#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let toggle = MenuItem::with_id(app, "toggle", "暂停 / 继续巡游", true, None::<&str>)?;
            let say = MenuItem::with_id(app, "say", "让它说句话", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &say, &quit])?;

            let _tray = TrayIconBuilder::with_id("pet-tray")
                .tooltip("Desktop Pet")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    match id {
                        "toggle" => {
                            let _ = app.emit("pet-command", "toggle-walking");
                        }
                        "say" => {
                            let _ = app.emit("pet-command", "say-hi");
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
