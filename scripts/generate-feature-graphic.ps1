Add-Type -AssemblyName System.Drawing
$width = 1024
$height = 500
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Deep warm dark coffee background
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($width, $height)),
    [System.Drawing.Color]::FromArgb(23, 20, 17),
    [System.Drawing.Color]::FromArgb(44, 32, 22)
)
$g.FillRectangle($brush, 0, 0, $width, $height)

# Subtle ambient circular glow in center-left
$glowBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(200, 100)),
    (New-Object System.Drawing.Point(500, 400)),
    [System.Drawing.Color]::FromArgb(50, 212, 163, 115),
    [System.Drawing.Color]::FromArgb(0, 23, 20, 17)
)
$g.FillEllipse($glowBrush, 80, 50, 400, 400)

# Draw Logo
$logoPath = Join-Path $PSScriptRoot "..\frontend\assets\logo.png"
if (Test-Path $logoPath) {
    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $g.DrawImage($logo, 90, 120, 260, 260)
    $logo.Dispose()
}

# Fonts & Brushes
$titleFont = New-Object System.Drawing.Font("Segoe UI", 46, [System.Drawing.FontStyle]::Bold)
$taglineFont = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Italic)
$descFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Regular)
$badgeFont = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

$goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(212, 163, 115))
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 240, 235))
$mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(180, 165, 150))
$badgeBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(55, 42, 33))
$badgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 120, 80), 1)

$g.DrawString("Ngopi", $titleFont, $goldBrush, 390, 110)
$g.DrawString('"ngobrol paling intim"', $taglineFont, $whiteBrush, 395, 185)
$g.DrawString("Aplikasi percakapan privat bernuansa Warkop Nusantara", $descFont, $mutedBrush, 395, 235)

# Feature Badges
$badges = @("E2E Encrypted", "Jukebox Warkop", "Gapleh & Catur", "Kepatuhan UU PDP")
$bx = 395
foreach ($b in $badges) {
    $size = $g.MeasureString($b, $badgeFont)
    $rect = New-Object System.Drawing.RectangleF($bx, 290, ($size.Width + 18), ($size.Height + 10))
    $g.FillRectangle($badgeBgBrush, $rect)
    $g.DrawRectangle($badgePen, $rect.X, $rect.Y, $rect.Width, $rect.Height)
    $g.DrawString($b, $badgeFont, $goldBrush, ($bx + 9), 295)
    $bx += [int]($size.Width + 24)
}

$outputDir = Join-Path $PSScriptRoot "..\docs\google-play\store-assets"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}
$outputPath = Join-Path $outputDir "feature-graphic-1024x500.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$bmp.Dispose()
Write-Output "Successfully generated: $outputPath"
