//! The desktop shell guesses a file's type from its first kilobyte before it
//! looks at the extension. A script that happens to contain "%PDF" there is
//! served as a PDF and the screen that needs it never loads. This test reads
//! every file of the web build (../dist, so build first) and checks the shell
//! would serve it with the type its extension says.
use std::path::{Path, PathBuf};
use tauri_utils::mime_type::MimeType;

fn files(dir: &Path, out: &mut Vec<PathBuf>) {
    for entry in std::fs::read_dir(dir).expect("read dist; run `npm run build` first") {
        let path = entry.unwrap().path();
        if path.is_dir() {
            files(&path, out);
        } else {
            out.push(path);
        }
    }
}

#[test]
fn every_web_file_is_served_with_its_own_type() {
    let dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("../dist");
    let mut all = Vec::new();
    files(&dist, &mut all);
    assert!(all.len() > 20, "dist looks empty");

    let mut wrong = Vec::new();
    for path in &all {
        // Only types the web view enforces: scripts, styles, pages and data.
        let expected = match path.extension().and_then(|e| e.to_str()).unwrap_or("") {
            "js" | "mjs" => "text/javascript",
            "css" => "text/css",
            "html" => "text/html",
            "json" => "application/json",
            _ => continue,
        };
        let uri = path.to_string_lossy();
        let served = MimeType::parse(&std::fs::read(path).unwrap(), &uri);
        if served != expected {
            wrong.push(format!("{} would be served as {served}, not {expected}", path.strip_prefix(&dist).unwrap().display()));
        }
    }
    assert!(wrong.is_empty(), "\n{}", wrong.join("\n"));
}
