# Create deployment package for Elastic Beanstalk
Write-Host "Creating deployment package..." -ForegroundColor Green

# Remove existing deployment package if it exists
if (Test-Path "deployment.zip") {
    Remove-Item "deployment.zip" -Force
    Write-Host "Removed existing deployment.zip" -ForegroundColor Yellow
}

# Create deployment package
$files = @(
    "src/",
    "lib/",
    "package.json",
    "yarn.lock",
    "public/",
    "README.md"
)

# Add files to ZIP
Compress-Archive -Path $files -DestinationPath "deployment.zip" -Force

Write-Host "✅ Deployment package created: deployment.zip" -ForegroundColor Green
Write-Host "📦 Package size: $((Get-Item 'deployment.zip').Length / 1MB) MB" -ForegroundColor Cyan

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to AWS Elastic Beanstalk Console" -ForegroundColor White
Write-Host "2. Create a new application" -ForegroundColor White
Write-Host "3. Upload deployment.zip" -ForegroundColor White
Write-Host "4. Set environment variables" -ForegroundColor White 