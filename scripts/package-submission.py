#!/usr/bin/env python3
"""Package working-copy source and submission scripts, excluding local secrets."""
from datetime import datetime, timezone
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]


def allowed(path: Path) -> bool:
    name = path.name.lower()
    if name.startswith(".env") and name != ".env.example":
        return False
    return not (
        name in {"credentials.json", "google-services.json", "googleservice-info.plist"}
        or path.suffix.lower() in {".pem", ".key", ".p8", ".p12", ".jks", ".keystore", ".mobileprovision"}
        or "service-account" in name or "service_account" in name
        or any(part in {"node_modules", ".git", ".next", "runs", "output", "__pycache__"}
               or part.startswith(".venv") for part in path.parts)
    )


def main() -> None:
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
    files = sorted({name for name in tracked if name and allowed(Path(name))})
    output = ROOT / "runs/submission/freshlens-source-code-and-scripts.zip"
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name in files:
            source = ROOT / name
            if source.is_symlink():
                raise ValueError(f"Refusing to package symlink: {name}")
            if source.is_file():
                archive.write(source, f"FreshLens-AI/{name}")
        archive.writestr("FreshLens-AI/submission/manifest.txt",
                         f"Working-copy source bundle | {datetime.now(timezone.utc).isoformat()}\n"
                         + "\n".join(archive.namelist()) + "\n")
    with ZipFile(output) as archive:
        assert archive.testzip() is None, "Archive integrity check failed"
        print(f"Created {output} ({len(archive.namelist())} files, {output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
