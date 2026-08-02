$ErrorActionPreference = "Stop"

Write-Host "BRANCH"
git branch --show-current

Write-Host "STATUS"
git status --short

Write-Host "DIFF"
git diff --stat

Write-Host "FILES"
git diff --name-only
