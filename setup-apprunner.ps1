# Setup script for AWS App Runner deployment
Write-Host "🚀 Setting up AWS resources for App Runner deployment..." -ForegroundColor Green

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI is not installed. Please install it first." -ForegroundColor Red
    Write-Host "Download from: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

# Check if AWS credentials are configured
try {
    aws sts get-caller-identity | Out-Null
    Write-Host "✅ AWS credentials are configured" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS credentials are not configured. Please run 'aws configure'" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Required GitHub Secrets:" -ForegroundColor Yellow
Write-Host "Add these secrets to your GitHub repository:" -ForegroundColor White
Write-Host ""
Write-Host "1. AWS_ACCESS_KEY_ID" -ForegroundColor Cyan
Write-Host "2. AWS_SECRET_ACCESS_KEY" -ForegroundColor Cyan
Write-Host "3. OPENAI_API_KEY" -ForegroundColor Cyan
Write-Host "4. BRANDDEV_API_KEY" -ForegroundColor Cyan
Write-Host "5. S3_BUCKET_NAME" -ForegroundColor Cyan
Write-Host "6. S3_REGION" -ForegroundColor Cyan
Write-Host "7. S3_ACCESS_KEY_ID" -ForegroundColor Cyan
Write-Host "8. S3_SECRET_ACCESS_KEY" -ForegroundColor Cyan
Write-Host "9. SUPABASE_URL - optional" -ForegroundColor Cyan
Write-Host "10. SUPABASE_SERVICE_KEY - optional" -ForegroundColor Cyan
Write-Host ""

Write-Host "🔧 Setting up AWS resources..." -ForegroundColor Yellow

# Create ECR repository
Write-Host "Creating ECR repository..." -ForegroundColor White
aws ecr create-repository --repository-name sbemailgenerator --region us-east-1 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ECR repository created" -ForegroundColor Green
} else {
    Write-Host "ℹ️ ECR repository already exists" -ForegroundColor Yellow
}

# Create App Runner auto-scaling configuration
Write-Host "Creating App Runner auto-scaling configuration..." -ForegroundColor White
$scalingConfig = aws apprunner create-auto-scaling-configuration --auto-scaling-configuration-name sbemailgenerator-scaling --max-concurrency 50 --max-size 10 --region us-east-1 2>$null
if ($LASTEXITCODE -eq 0) {
    $scalingArn = ($scalingConfig | ConvertFrom-Json).AutoScalingConfiguration.AutoScalingConfigurationArn
    Write-Host "✅ Auto-scaling configuration created: $scalingArn" -ForegroundColor Green
    Write-Host "Add this as GitHub secret: AUTO_SCALING_CONFIG_ARN" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️ Auto-scaling configuration already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Add the GitHub secrets listed above" -ForegroundColor White
Write-Host "2. Push your code to the main branch" -ForegroundColor White
Write-Host "3. The GitHub Action will automatically deploy to App Runner" -ForegroundColor White
Write-Host ""
Write-Host "Note: After the first deployment, you will need to add APP_RUNNER_SERVICE_ARN as a GitHub secret" -ForegroundColor Cyan 