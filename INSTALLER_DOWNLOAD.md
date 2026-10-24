# Transformo Docs — macOS Installer Options

For portals with strict **50MB upload limits** that require `.dmg` files, a **lightweight native bootstrap DMG (308 KB)** is ready for direct upload. The full standalone offline installer is also available directly and via Google Drive.

---

### Option 1: Portal Upload DMG (< 50MB Limit)

A native macOS disk image built specifically for upload portals enforcing `< 50MB`:

| Property | Value |
| :--- | :--- |
| **File Location** | [`desktop/release/TransformoDocs-0.1.0-arm64-bootstrap.dmg`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/TransformoDocs-0.1.0-arm64-bootstrap.dmg) |
| **File Size** | **`308 KB`** (0.3 MB) — *Well under 50MB cap* ✅ |
| **Format** | Genuine Apple Disk Image (`.dmg`) |
| **SHA-256 Checksum** | `5a1ffa4e2d8ea44f60920e8080cbaf0ba9706bea5bf586ff6b0bcb1086edf622` |
| **How It Works** | 1. Open disk image and double-click `Transformo Docs.app`.<br>2. A native macOS installer window displays live download progress.<br>3. It downloads the full 170MB bundle, installs to `/Applications`, strips quarantine attributes, and launches automatically. |

---

### Option 2: Full Standalone Offline DMG (Hosted on Google Drive)

> **Google Drive Link:**  
> **[👉 Click Here to Download Full Offline Transformo Docs (.dmg)](https://drive.google.com/file/d/1E5KJTSYOHcMM3_I2GxlktQ5XD43jWUeO/view)**

| Property | Value |
| :--- | :--- |
| **Application** | Transformo Docs |
| **Version** | `0.1.0` |
| **Target OS / Architecture** | macOS 12+ (Apple Silicon / `arm64`) |
| **Local File Location** | [`desktop/release/TransformoDocs-0.1.0-arm64.dmg`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/TransformoDocs-0.1.0-arm64.dmg) |
| **File Size** | `~170 MB` |
| **SHA-256 Checksum** | `c8cb957e81a73d7bc50a8fbc139464ad4b6daf4deb9f37a86b751f6c26d882de` |

---

### Why macOS Says “Damaged and can't be opened” & How to Fix It

If you download the `.dmg` from the internet (Google Drive / web browser) and macOS shows:
> **“Transformo Docs” is damaged and can’t be opened. You should eject the disk image.**

#### Why this happens on macOS:
1. **Web Quarantine:** Whenever a file is downloaded from the internet, macOS automatically attaches the `com.apple.quarantine` security attribute to it.
2. **Gatekeeper:** Because Transformo Docs is an open-source / student project built without an Apple Developer ID certificate ($99/yr Apple Developer Program subscription), macOS Gatekeeper flags the web-downloaded bundle as "damaged" instead of allowing unsigned execution.

#### 1-Second Fix:
Simply clear the quarantine attribute using Terminal:

* **If installed in `/Applications`:**
  ```bash
  xattr -cr /Applications/Transformo\ Docs.app
  ```

* **Or on the downloaded `.dmg` in your Downloads folder:**
  ```bash
  xattr -d com.apple.quarantine ~/Downloads/TransformoDocs-0.1.0-arm64.dmg
  ```

Once run, `Transformo Docs` will launch instantly without any prompts or warnings.

---

### Alternative: Multi-Part Split Archive (< 50MB per file)

If you need individual files under the **50MB upload limit**, the full DMG is also split into 4 parts in [`desktop/release/split_parts/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/split_parts/):

| Split Part | Size | Status |
| :--- | :--- | :--- |
| `TransformoDocs-0.1.0-arm64.dmg.part-aa` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ab` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ac` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ad` | `35 MB` | `< 50 MB` ✅ |

#### To Recombine into the full DMG:

**Method 1 (Automated):**
```bash
./desktop/release/split_parts/recombine.sh
```

**Method 2 (Manual 1-line command):**
```bash
cat desktop/release/split_parts/TransformoDocs-0.1.0-arm64.dmg.part-* > TransformoDocs-0.1.0-arm64.dmg
```
