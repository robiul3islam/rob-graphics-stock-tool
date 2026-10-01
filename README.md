# R⭕B❕ Graphics Stock Tool

## Run
```
cp .env.example .env     # Windows: copy .env.example .env
# add GEMINI_API_KEY (free: aistudio.google.com/apikey)
npm install
npm run dev              # web http://localhost:5173 · api :3001
npm test
```
Requires Node 20+. External tools are only needed for the features that use them:

| Tool | Used for |
|------|----------|
| ffmpeg (+ffprobe) | video frames |
| Ghostscript | EPS and AI previews |
| poppler | AI fallback renderer + font/image info for AI files |
| exiftool | embedding IPTC/XMP into JPGs |

## Install the tools
**Windows** (PowerShell; reopen the terminal afterwards so PATH refreshes)
```
winget install Gyan.FFmpeg
winget install ArtifexSoftware.GhostScript
winget install OliverBetz.ExifTool
scoop install poppler        # or: choco install poppler
```
Ghostscript's console binary is `gswin64c` — the tool finds it automatically. If a tool is not on PATH, set `GS_PATH`, `PDFTOPPM_PATH` or `EXIFTOOL_PATH` in `.env`.

**macOS**
```
brew install ffmpeg ghostscript poppler exiftool
```
**Linux (Debian/Ubuntu)**
```
sudo apt install ffmpeg ghostscript poppler-utils libimage-exiftool-perl
```
Check: `gs --version`, `pdftoppm -v`, `exiftool -ver`.

## Vector previews
- **SVG** is rendered with sharp. **EPS** is rendered with Ghostscript (`-dEPSCrop`, 150 dpi). **AI** files are PDF-compatible and are rendered with Ghostscript (poppler `pdftoppm` as fallback).
- An AI file saved without PDF content shows: *Save with 'Create PDF Compatible File' enabled.*
- Previews use a transparent background (`pngalpha`) so the checkerboard toggle shows real transparency.
- Colour mode, live-text and raster detection read the file's own data and are best-effort.

## Embedding metadata
After generating, click **Embed IPTC/XMP into JPGs**. exiftool writes XMP-dc Title/Description/Subject and IPTC ObjectName (64-char limit)/Headline/Caption/Keywords (UTF-8). You get a ZIP of the embedded JPGs; non-JPG files are listed in `_skipped.txt`.
