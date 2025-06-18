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

Write-Host "`n🔐 Creating IAM role for App Runner..." -ForegroundColor Yellow

# Check if the role already exists
try {
    $existingRole = aws iam get-role --role-name AppRunnerECRAccessRole --output json 2>$null
    if ($LASTEXITCODE -eq 0) {
        $roleArn = ($existingRole | ConvertFrom-Json).Role.Arn
        Write-Host "✅ IAM role already exists: $roleArn" -ForegroundColor Green
        
        # Check if the required policy is attached
        $attachedPolicies = aws iam list-attached-role-policies --role-name AppRunnerECRAccessRole --output json
        $hasPolicy = ($attachedPolicies | ConvertFrom-Json).AttachedPolicies | Where-Object { $_.PolicyArn -eq "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess" }
        
        if ($hasPolicy) {
            Write-Host "✅ ECR access policy is already attached" -ForegroundColor Green
        } else {
            Write-Host "Attaching ECR access policy..." -ForegroundColor White
            aws iam attach-role-policy --role-name AppRunnerECRAccessRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
            Write-Host "✅ ECR access policy attached" -ForegroundColor Green
        }
    } else {
        throw "Role not found"
    }
} catch {
    Write-Host "Creating new IAM role..." -ForegroundColor White
    
    # Create trust policy for App Runner
    @'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
'@ | Set-Content -Path "trust-policy.json" -Encoding ASCII

    # Create the IAM role
    try {
        aws iam create-role --role-name AppRunnerECRAccessRole --assume-role-policy-document file://trust-policy.json
        Write-Host "✅ IAM role created successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create IAM role" -ForegroundColor Red
        exit 1
    }

    # Attach the required policies
    Write-Host "Attaching ECR access policy..." -ForegroundColor White
    try {
        aws iam attach-role-policy --role-name AppRunnerECRAccessRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
        Write-Host "✅ ECR access policy attached" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to attach ECR access policy" -ForegroundColor Red
        exit 1
    }

    # Get the role ARN
    $roleArn = aws iam get-role --role-name AppRunnerECRAccessRole --query 'Role.Arn' --output text
    Write-Host "✅ IAM Role ARN: $roleArn" -ForegroundColor Green

    # Clean up temporary file
    Remove-Item "trust-policy.json" -ErrorAction SilentlyContinue
}

Write-Host "`nRequired GitHub Secrets:" -ForegroundColor Cyan
Write-Host "Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):" -ForegroundColor Yellow
Write-Host ""
Write-Host "AWS_ACCESS_KEY_ID" -ForegroundColor White
Write-Host "AWS_SECRET_ACCESS_KEY" -ForegroundColor White
Write-Host "APP_RUNNER_SERVICE_ARN" -ForegroundColor White
Write-Host "APP_RUNNER_ACCESS_ROLE_ARN" -ForegroundColor White

Write-Host "`nIAM Role ARN to add as secret:" -ForegroundColor Cyan
Write-Host $roleArn -ForegroundColor Green

Write-Host "`nInstructions:" -ForegroundColor Cyan
Write-Host "1. Go to your GitHub repository" -ForegroundColor White
Write-Host "2. Navigate to Settings > Secrets and variables > Actions" -ForegroundColor White
Write-Host "3. Add the following secrets:" -ForegroundColor White
Write-Host "   - AWS_ACCESS_KEY_ID: Your AWS access key" -ForegroundColor White
Write-Host "   - AWS_SECRET_ACCESS_KEY: Your AWS secret key" -ForegroundColor White
Write-Host "   - APP_RUNNER_SERVICE_ARN: Leave empty for first deployment" -ForegroundColor White
Write-Host "   - APP_RUNNER_ACCESS_ROLE_ARN: $roleArn" -ForegroundColor White
Write-Host "4. Push your code to the main branch to trigger deployment" -ForegroundColor White

Write-Host "`nSetup complete! Ready for deployment." -ForegroundColor Green 