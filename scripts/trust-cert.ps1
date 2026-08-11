<#
.SYNOPSIS
    Free local certificate generation & SmartScreen trust installer for Windows.
.DESCRIPTION
    Creates a local Developer Code Signing certificate and installs it into
    the CurrentUser Trusted Root Certification Authorities store.
    This removes the Windows Defender SmartScreen "Unknown Publisher" warning for
    locally built .exe binaries without requiring a paid EV certificate.
#>

param(
    [string]$PublisherName = "DocuCraft Local Developer"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " DocuCraft — Free Local Certificate & SmartScreen Installer" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Create a self-signed code signing certificate in CurrentUser store
Write-Host "[1/3] Creating self-signed Code Signing certificate..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=$PublisherName" -CertStoreLocation "Cert:\CurrentUser\My"

Write-Host " -> Certificate Created: $($cert.Thumbprint)" -ForegroundColor Green
Write-Host ""

# 2. Export public key and add to Trusted Root Certification Authorities
Write-Host "[2/3] Adding certificate to Trusted Root Certification Authorities..." -ForegroundColor Yellow
$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
$rootStore.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
$rootStore.Add($cert)
$rootStore.Close()

Write-Host " -> Successfully added to Trusted Root Authorities!" -ForegroundColor Green
Write-Host ""

# 3. Instruction for signing binaries
Write-Host "[3/3] Ready to sign .exe binaries!" -ForegroundColor Yellow
Write-Host "To sign your executable, run:" -ForegroundColor White
Write-Host "  Set-AuthenticodeSignature -Certificate (Get-Item Cert:\CurrentUser\My\$($cert.Thumbprint)) -FilePath .\path\to\your_app.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Setup Completed! Unknown Publisher warning will be resolved." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
