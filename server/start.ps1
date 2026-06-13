# Khởi động PHP để kiểm tra / chạy phần kết nối database của dự án DATN.
# Tự dò bản PHP mới nhất trong Laragon và bật sẵn pdo_mysql
# (vì php CLI của Laragon mặc định không nạp php.ini nên thiếu driver MySQL).
#
# Cách dùng: bấm đúp start.bat   (hoặc chạy trực tiếp file này)

$ErrorActionPreference = 'Stop'

$port = if ($env:API_PORT) { $env:API_PORT } else { 8000 }
$phpRoot = 'C:\laragon\bin\php'

if (-not (Test-Path $phpRoot)) {
    Write-Error "Khong tim thay PHP cua Laragon tai $phpRoot. Hay sua lai duong dan trong start.ps1."
    exit 1
}

# Lấy bản PHP mới nhất (sắp xếp tên giảm dần)
$phpDir = Get-ChildItem $phpRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1
$php = Join-Path $phpDir.FullName 'php.exe'
$ext = Join-Path $phpDir.FullName 'ext'

Write-Host ""
Write-Host "  DATN - kiem tra ket noi database" -ForegroundColor Cyan
Write-Host "  PHP : $($phpDir.Name)"
Write-Host "  Mo  : http://localhost:$port" -ForegroundColor Green
Write-Host "  (Ctrl+C de dung)" -ForegroundColor DarkGray
Write-Host ""

& $php `
    -d extension_dir="$ext" `
    -d extension=pdo_mysql `
    -d extension=mysqli `
    -S "localhost:$port" `
    -t "$PSScriptRoot"
