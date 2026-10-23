# Transformo Docs — macOS Installer Options

For portals with strict **50MB upload limits** that require `.dmg` files, a **lightweight native bootstrap DMG (308 KB)** is ready for direct upload. The full standalone offline installer is also hosted on Google Drive.

---

### Option 1: Portal Upload DMG (< 50MB Limit)

A native macOS disk image built specifically for upload portals enforcing `< 50MB`:

| Property | Value |
| :--- | :--- |
| **File Location** | [`desktop/release/TransformoDocs-0.1.0-arm64-bootstrap.dmg`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/TransformoDocs-0.1.0-arm64-bootstrap.dmg) |
| **File Size** | **`308 KB`** (0.3 MB) — *Well under 50MB cap* ✅ |
| **Format** | Genuine Apple Disk Image (`.dmg`) |
| **SHA-256 Checksum** | `06d54891d3d3c1f4ac8f1877f27ba9ebac7f2d3dea2157e01d6980c508224e6f` |
| **How It Works** | 1. User drags `Transformo Docs.app` into `/Applications`.<br>2. On first launch, a native macOS setup dialog appears with a real-time progress bar.<br>3. It downloads the 171MB bundle, installs to `/Applications`, and launches automatically. |

---

### Option 2: Full Standalone Offline DMG (Hosted on Google Drive)

> **Google Drive Link:**  
> **[👉 Click Here to Download Full Offline Transformo Docs (.dmg)](https://drive.google.com/file/d/1E5KJTSYOHcMM3_I2GxlktQ5XD43jWUeO/view)**

| Property | Value |
| :--- | :--- |
| **Application** | Transformo Docs |
| **Version** | `0.1.0` |
| **Target OS / Architecture** | macOS 12+ (Apple Silicon / `arm64`) |
| **File Name** | `TransformoDocs-0.1.0-arm64.dmg` |
| **File Size** | `~171 MB` |
| **SHA-256 Checksum** | `fa8e51b7a7e7d9d4d14a64b929ce1e488ce0c1dcabe31f4a6afaa34416458bdf` |

---

### Quick Installation Steps

1. **Download:** Click the link above to download `TransformoDocs-0.1.0-arm64.dmg`.
2. **Mount & Install:** Double-click the `.dmg` file and drag **Transformo Docs** into your **Applications** folder.
3. **First Launch (macOS Gatekeeper):**
   * If macOS prompts that the developer cannot be verified, **Right-click (Control-click)** `Transformo Docs.app` in `/Applications` and select **Open**.
   * Click **Open** on the confirmation dialog.
4. **Self-Contained Backend:** The Python/FastAPI backend starts automatically on launch — no manual terminal or Python setup required.

---

### Verify Integrity (Optional)

You can verify the file integrity in the macOS Terminal:

```bash
shasum -a 256 TransformoDocs-0.1.0-arm64.dmg
```

Expected output:
```text
fa8e51b7a7e7d9d4d14a64b929ce1e488ce0c1dcabe31f4a6afaa34416458bdf  TransformoDocs-0.1.0-arm64.dmg
```

---

### Alternative: Multi-Part Split Archive (< 50MB per file)

If you prefer or need files under the **50MB upload limit**, the DMG is split into 4 parts inside [`desktop/release/split_parts/`](file:///Users/shreyashgolhani/Desktop/transformo-docs-project/desktop/release/split_parts/):

| Split Part | Size | Status |
| :--- | :--- | :--- |
| `TransformoDocs-0.1.0-arm64.dmg.part-aa` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ab` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ac` | `45 MB` | `< 50 MB` ✅ |
| `TransformoDocs-0.1.0-arm64.dmg.part-ad` | `36 MB` | `< 50 MB` ✅ |

#### To Recombine into the full DMG:

**Method 1 (Automated):** Run the included script:
```bash
./desktop/release/split_parts/recombine.sh
```

**Method 2 (Manual 1-line command):**
```bash
cat desktop/release/split_parts/TransformoDocs-0.1.0-arm64.dmg.part-* > TransformoDocs-0.1.0-arm64.dmg
```

