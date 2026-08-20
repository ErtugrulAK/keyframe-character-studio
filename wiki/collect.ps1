# collect.ps1 — İş PC'sinden ev PC'sine bilgi toplama script'i
# Çalıştır: powershell -ExecutionPolicy Bypass -File collect.ps1

$ErrorActionPreference = "Stop"
$dest = "$env:USERPROFILE\Desktop\kcs-collection"
New-Item -ItemType Directory -Force -Path "$dest\raw\articles" | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\raw\papers" | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\raw\transcripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$dest\raw\assets" | Out-Null

Write-Host "=== KCS Bilgi Toplama ===" -ForegroundColor Cyan
Write-Host "Hedef: $dest`n"

# --- 1. KCS reposunu bul ---
$kcsPaths = @(
    "$env:USERPROFILE\Desktop\keyframe-character-studio",
    "$env:USERPROFILE\Documents\keyframe-character-studio",
    "$env:USERPROFILE\Masaüstü\keyframe-character-studio"
)
$kcsFound = $null
foreach ($p in $kcsPaths) {
    if (Test-Path $p) { $kcsFound = $p; Write-Host "KCS repo: $p" -ForegroundColor Green; break }
}
if (-not $kcsFound) { Write-Host "KCS repo bulunamadı!" -ForegroundColor Yellow }

# --- 2. Notlar ---
$notePaths = @(
    "$env:USERPROFILE\Desktop\*.md",
    "$env:USERPROFILE\Desktop\*.txt",
    "$env:USERPROFILE\Documents\*.md",
    "$env:USERPROFILE\Documents\*.txt"
)
foreach ($pattern in $notePaths) {
    $files = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    foreach ($f in $files) {
        Copy-Item $f.FullName "$dest\raw\articles\" -Force
        Write-Host "  + $($f.Name)" -ForegroundColor Gray
    }
}

# --- 3. Obsidian vault ---
$obsidianVaults = "$env:USERPROFILE\Documents\Obsidian"
if (Test-Path $obsidianVaults) {
    Write-Host "Obsidian vault'ları bulundu:" -ForegroundColor Green
    Get-ChildItem $obsidianVaults -Directory | ForEach-Object { Write-Host "  - $($_.Name)" }
}

# --- 4. Chrome bookmarks ---
$chromeBookmarks = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Bookmarks"
if (Test-Path $chromeBookmarks) {
    Copy-Item $chromeBookmarks "$dest\raw\assets\chrome-bookmarks.json" -Force
    Write-Host "  + Chrome bookmarks" -ForegroundColor Gray
}

# --- 5. Git config ---
$gitConfig = git config --list 2>$null
if ($gitConfig) {
    $gitConfig | Out-File "$dest\raw\transcripts\git-config.txt" -Encoding UTF8
    Write-Host "  + Git config" -ForegroundColor Gray
}

# --- 6. README ---
$readme = @"
# KCS Wiki Seed — İş Bilgisayarı

**Toplanma tarihi:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')
**Kullanıcı:** $env:USERNAME
**Bilgisayar:** $env:COMPUTERNAME
**KCS repo yolu:** $($kcsFound ?? 'bulunamadı')

## İçindekiler

| Klasör | Açıklama |
|--------|----------|
| raw/articles/ | Notlar, metin dosyaları |
| raw/papers/ | PDF'ler, dokümanlar |
| raw/transcripts/ | Git config, sistem bilgisi |
| raw/assets/ | Bookmark'lar, ekran görüntüleri |

## Notlar
- .env dosyaları KASITLI OLARAK dahil edilmedi (güvenlik)
- Obsidian vault'ları otomatik kopyalanmadı — manuel ekle
- Bu klasörü ev PC'sindeki KCS reposuna `wiki/raw/` altına taşı
"@
$readme | Out-File "$dest\README.md" -Encoding UTF8

# --- 7. Özet ---
Write-Host "`n=== Tamamlandı ===" -ForegroundColor Cyan
Write-Host "Toplanan dosyalar: $dest" -ForegroundColor Green
Write-Host "Bu klasörü USB'ye at veya mail'le kendine gönder."
Write-Host "Ev PC'sinde: keyframe-character-studio/wiki/raw/ altına kopyala."
