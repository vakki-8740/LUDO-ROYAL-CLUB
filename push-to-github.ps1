<#
.SYNOPSIS
  One-shot push of the local LUDO ROYAL CLUB project to GitHub repo vakki-8740/LUDO-ROYAL-CLUB
.NOTES
  Run on the machine that HAS git + your GitHub account.
  Requires a GitHub classic PAT (Personal Access Token) with scope: `repo`.
  Get one at https://github.com/settings/tokens  (Generate new token -> classic)
  The token is entered as a SECURE prompt (never saved to disk).
#>
$ErrorActionPreference = 'Stop'
$prj = "C:\Users\VASEEM\Videos\WACH TIME\WORK PLEASE\LUDO ROYAL CLUB"
Set-Location $prj
Write-Host "Working dir: $prj"

# --- (Safety) remove a stray case-variant duplicate folder created earlier ---
$videos = 'C:\Users\VASEEM\Videos'
if (Test-Path $videos) {
    $names = (Get-ChildItem $videos -Directory -ErrorAction SilentlyContinue).Name
    if (($names -contains 'WACH TIME') -and ($names -contains 'WachTime')) {
        Write-Host "Removing stray duplicate folder: $videos\WachTime"
        Remove-Item "$videos\WachTime" -Recurse -Force
    }
}

# --- git identity ---
git config user.name  "Vakif"
git config user.email "vaseem@vakifcreations.com"

# --- init + ensure branch is 'main' ---
if (-not (Test-Path .git)) { git init }
git symbolic-ref HEAD refs/heads/main

# --- stage ONLY these folders (never -A), commit ---
git add FRONTEND BACKEND .gitignore
if ((git status --porcelain).Trim()) {
    git commit -m "feat: formatted page content (privacy/terms/gst/about/rules); wallet/profile polish; separate Add Money page; home image cache-buster; SW cache bump; pages-content.js"
} else {
    Write-Host "Nothing new to commit (already committed)."
}

# --- remote (re-set cleanly) ---
$token = Read-Host -AsSecureString "GitHub PAT (classic token, scope: repo)"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($token))
git remote remove origin 2>$null
git remote add    origin "https://$plain@github.com/vakki-8740/LUDO-ROYAL-CLUB.git"

# --- push ---
git push -u origin main
Write-Host "`nDONE. Verify: https://github.com/vakki-8740/LUDO-ROYAL-CLUB" -ForegroundColor Green
