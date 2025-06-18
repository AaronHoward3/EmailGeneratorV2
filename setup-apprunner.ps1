# Setup script for AWS App Runner deployment
# This script creates the necessary AWS resources and provides instructions for GitHub secrets

Write-Host "🚀 Setting up AWS App Runner deployment..." -ForegroundColor Green

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

Write-Host "`n📦 Creating ECR repository..." -ForegroundColor Yellow
try {
    aws ecr create-repository --repository-name sbemailgenerator --region us-east-1
    Write-Host "✅ ECR repository created successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ECR repository might already exist (this is OK)" -ForegroundColor Yellow
}

Write-Host "`n⚙️  Creating App Runner auto-scaling configuration..." -ForegroundColor Yellow
$scalingConfigArn = ""
try {
    $scalingConfig = aws apprunner create-auto-scaling-configuration `
        --auto-scaling-configuration-name sb-email-generator-scaling `
        --max-concurrency 50 `
        --max-size 10 `
        --min-size 1 `
        --region us-east-1 `
        --output json
    
    $scalingConfigArn = ($scalingConfig | ConvertFrom-Json).AutoScalingConfiguration.AutoScalingConfigurationArn
    Write-Host "✅ Auto-scaling configuration created: $scalingConfigArn" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Auto-scaling configuration might already exist" -ForegroundColor Yellow
    # Try to get existing configuration
    try {
        $scalingConfig = aws apprunner describe-auto-scaling-configuration `
            --auto-scaling-configuration-name sb-email-generator-scaling `
            --region us-east-1 `
            --output json
        $scalingConfigArn = ($scalingConfig | ConvertFrom-Json).AutoScalingConfiguration.AutoScalingConfigurationArn
        Write-Host "✅ Found existing auto-scaling configuration: $scalingConfigArn" -ForegroundColor Green
    } catch {
        Write-Host "❌ Could not find auto-scaling configuration" -ForegroundColor Red
        $scalingConfigArn = ""
    }
}

Write-Host "`n🔑 Required GitHub Secrets:" -ForegroundColor Cyan
Write-Host "Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):" -ForegroundColor Yellow
Write-Host ""
Write-Host "AWS_ACCESS_KEY_ID" -ForegroundColor White
Write-Host "AWS_SECRET_ACCESS_KEY" -ForegroundColor White
Write-Host "APP_RUNNER_SERVICE_ARN" -ForegroundColor White
Write-Host "AUTO_SCALING_CONFIG_ARN" -ForegroundColor White

if ($scalingConfigArn) {
    Write-Host "`n📋 Auto-scaling configuration ARN to add as secret:" -ForegroundColor Cyan
    Write-Host $scalingConfigArn -ForegroundColor Green
}

Write-Host "`n📝 Instructions:" -ForegroundColor Cyan
Write-Host "1. Go to your GitHub repository" -ForegroundColor White
Write-Host "2. Navigate to Settings > Secrets and variables > Actions" -ForegroundColor White
Write-Host "3. Add the following secrets:" -ForegroundColor White
Write-Host "   - AWS_ACCESS_KEY_ID: Your AWS access key" -ForegroundColor White
Write-Host "   - AWS_SECRET_ACCESS_KEY: Your AWS secret key" -ForegroundColor White
Write-Host "   - APP_RUNNER_SERVICE_ARN: Leave empty for first deployment" -ForegroundColor White
Write-Host "   - AUTO_SCALING_CONFIG_ARN: $scalingConfigArn" -ForegroundColor White
Write-Host "4. Push your code to the main branch to trigger deployment" -ForegroundColor White

Write-Host "`n✅ Setup complete! Ready for deployment." -ForegroundColor Green 