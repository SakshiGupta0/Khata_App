#!/usr/bin/env python3
"""Run inside apps/<app> after `npx cap add android`. Applies icons, splash, signing, versioning."""
import os, re, shutil, sys, pathlib
app = sys.argv[1]; run = os.environ.get("GITHUB_RUN_NUMBER", "1")
root = pathlib.Path(__file__).resolve().parents[1]
res_src = root / "android-res" / app
android = pathlib.Path("android"); res = android / "app/src/main/res"

# icons
for d in res_src.glob("mipmap-*"):
    dst = res / d.name; dst.mkdir(parents=True, exist_ok=True)
    for f in d.iterdir(): shutil.copy(f, dst / f.name)
shutil.copy(res_src / "values/ic_launcher_background.xml", res / "values/ic_launcher_background.xml")
# adaptive icon xml (foreground png + background colour)
any_dir = res / "mipmap-anydpi-v26"; any_dir.mkdir(exist_ok=True)
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n'
for n in ("ic_launcher.xml", "ic_launcher_round.xml"): (any_dir / n).write_text(xml)
# remove template's vector foreground drawables that would shadow ours
for p in res.glob("drawable-v24/ic_launcher_foreground.xml"): p.unlink()
for p in res.glob("drawable/ic_launcher_background.xml"): p.unlink()
# splash: replace every splash.png the template ships
for p in res.rglob("splash.png"): shutil.copy(res_src / "drawable/splash.png", p)

# signing + version
g = android / "app/build.gradle"; s = g.read_text()
s = re.sub(r"versionCode \d+", f"versionCode {run}", s)
s = re.sub(r'versionName "[^"]*"', f'versionName "1.0.{run}"', s)
signing = '''    signingConfigs {
        release {
            storeFile file(System.getenv("KS_FILE") ?: "release.keystore")
            storePassword System.getenv("KS_PASS")
            keyAlias System.getenv("KS_ALIAS") ?: "key"
            keyPassword System.getenv("KS_PASS")
        }
    }
'''
assert "buildTypes {" in s
s = s.replace("    buildTypes {", signing + "    buildTypes {", 1)
s = re.sub(r"(buildTypes \{\s*release \{)", r"\1\n            signingConfig signingConfigs.release", s, count=1)
g.write_text(s)
print("patched", app, "versionCode", run)
