# Comprehensive Logging Guide for CloudWatch

This guide explains how to use the new structured logging system to monitor performance and identify bottlenecks in your SB Email Generator app on AWS AppRunner.

## 🎯 Overview

The new logging system provides:
- **Structured JSON logs** with timestamps for easy CloudWatch analysis
- **Performance tracking** for all operations with detailed timing
- **Request correlation** with unique request IDs
- **Error tracking** with context and stack traces
- **Memory usage monitoring** and resource utilization
- **Automatic bottleneck detection** and recommendations

## 📊 Log Structure

All logs are structured JSON with the following format:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "module": "EmailController",
  "message": "Email generation completed successfully",
  "uptime": 1234567,
  "memory": {
    "rss": 123456789,
    "heapUsed": 98765432,
    "heapTotal": 123456789,
    "external": 1234567
  },
  "requestId": "1705315845123-abc123-def456",
  "duration": "15.67ms",
  "operation": "email_generation",
  "jobId": "1705315845123-xyz789-uvw012",
  "emailCount": 1,
  "totalTokens": 12345
}
```

## 🔍 Log Levels

- **ERROR**: Critical errors that need immediate attention
- **WARN**: Warning conditions that may indicate issues
- **INFO**: General information about application flow
- **DEBUG**: Detailed debugging information
- **TRACE**: Very detailed tracing information

Set log level via environment variable: `LOG_LEVEL=INFO`

## 📈 Performance Monitoring

### Key Performance Metrics Tracked

1. **Request Performance**
   - Total request duration
   - Individual operation timing
   - Success/failure rates
   - Status code distribution

2. **Operation Performance**
   - OpenAI API calls (message creation, run creation, polling)
   - File operations (block loading, caching)
   - Thread pool operations
   - Cache operations
   - Memory usage

3. **Resource Utilization**
   - Thread pool utilization
   - Cache hit/miss rates
   - Memory consumption
   - Concurrent request handling

## 🛠️ Using the Logging Tools

### 1. Real-time Log Monitoring

```bash
# Monitor CloudWatch logs in real-time
aws logs tail /aws/apprunner/sb-email-generator --follow

# Filter for specific log levels
aws logs tail /aws/apprunner/sb-email-generator --follow | grep '"level":"ERROR"'

# Filter for specific operations
aws logs tail /aws/apprunner/sb-email-generator --follow | grep '"operation":"openai_run_poll"'
```

### 2. Log Analysis

```bash
# Analyze logs for performance bottlenecks
aws logs tail /aws/apprunner/sb-email-generator --since 1h | yarn logs:analyze

# Analyze specific log file
cat apprunner-logs.json | yarn logs:analyze

# Analyze logs with custom filters
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"level":"ERROR"' | yarn logs:analyze
```

### 3. Performance Testing

```bash
# Test production performance
yarn perf:test

# Test local performance
yarn perf:local

# Test with custom API URL
API_URL=https://your-custom-domain.com yarn perf:test
```

## 🔍 Identifying Bottlenecks

### 1. Slow OpenAI Operations

Look for logs with:
- `"operation":"openai_run_poll"` with high duration
- `"operation":"openai_message_creation"` with high duration
- `"operation":"openai_run_creation"` with high duration

**Common causes:**
- Network latency to OpenAI API
- Large prompt sizes
- Rate limiting
- OpenAI service issues

**Solutions:**
- Implement prompt optimization
- Add retry logic with exponential backoff
- Use OpenAI API caching
- Monitor OpenAI API status

### 2. File System Bottlenecks

Look for logs with:
- `"operation":"file read"` with high duration
- `"operation":"Path resolution"` with high duration
- `"operation":"File discovery"` with high duration

**Common causes:**
- Slow disk I/O
- Large number of files
- Inefficient file paths
- Cold storage access

**Solutions:**
- Implement file caching
- Optimize file structure
- Use faster storage
- Pre-warm frequently accessed files

### 3. Memory Issues

Look for logs with:
- High memory usage in `memory` field
- Memory usage increasing over time
- Frequent garbage collection

**Common causes:**
- Memory leaks in caches
- Large response sizes
- Inefficient data structures
- Thread pool issues

**Solutions:**
- Implement cache TTL
- Optimize data structures
- Monitor memory usage
- Implement memory limits

### 4. Thread Pool Issues

Look for logs with:
- `"operation":"thread_pool_timeout"`
- High thread pool utilization
- Thread creation delays

**Common causes:**
- Too many concurrent requests
- Slow thread creation
- Thread pool exhaustion
- OpenAI API delays

**Solutions:**
- Adjust thread pool size
- Implement request queuing
- Optimize thread creation
- Monitor thread pool stats

## 📊 CloudWatch Insights Queries

### 1. Performance Analysis

```sql
-- Find slowest operations
fields @timestamp, @message, duration, operation
| filter @message like /Performance:/
| sort duration desc
| limit 20
```

### 2. Error Analysis

```sql
-- Find most common errors
fields @timestamp, @message, error, module
| filter level = "ERROR"
| stats count() by error
| sort count desc
| limit 10
```

### 3. Request Performance

```sql
-- Analyze request durations
fields @timestamp, @message, duration, statusCode, success
| filter @message like /Request completed/
| stats avg(duration), min(duration), max(duration), count() by statusCode
```

### 4. Memory Usage

```sql
-- Monitor memory usage
fields @timestamp, memory.heapUsed, memory.heapTotal, memory.rss
| filter @message like /Memory usage/
| sort @timestamp desc
| limit 100
```

### 5. Thread Pool Utilization

```sql
-- Monitor thread pool performance
fields @timestamp, @message, availableThreads, activeThreads, utilization
| filter @message like /Thread pool statistics/
| sort @timestamp desc
| limit 50
```

## 🚨 Alerting and Monitoring

### 1. CloudWatch Alarms

Set up alarms for:
- Error rate > 5%
- Average response time > 30 seconds
- Memory usage > 80%
- Thread pool utilization > 90%

### 2. Performance Thresholds

Monitor these thresholds:
- **Response Time**: > 15 seconds (email generation)
- **Error Rate**: > 5% of requests
- **Memory Usage**: > 3GB
- **Thread Pool**: > 80% utilization

### 3. Custom Metrics

Track custom metrics:
- OpenAI API response times
- Cache hit rates
- File operation performance
- Request success rates

## 🔧 Troubleshooting Common Issues

### 1. High Response Times

**Check these logs:**
```bash
# Find slow operations
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"duration"' | sort -k2 -nr | head -10

# Check OpenAI API performance
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"operation":"openai' | yarn logs:analyze
```

### 2. Memory Leaks

**Check these logs:**
```bash
# Monitor memory usage over time
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"memory"' | yarn logs:analyze

# Check cache operations
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"operation":"cache' | yarn logs:analyze
```

### 3. Thread Pool Issues

**Check these logs:**
```bash
# Monitor thread pool performance
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"operation":"thread' | yarn logs:analyze

# Check for timeouts
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"thread_pool_timeout"'
```

### 4. File System Issues

**Check these logs:**
```bash
# Monitor file operations
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"operation":"file' | yarn logs:analyze

# Check block cache performance
aws logs tail /aws/apprunner/sb-email-generator --since 1h | grep '"operation":"cache' | yarn logs:analyze
```

## 📈 Performance Optimization Workflow

### 1. Baseline Measurement
```bash
# Run performance test
yarn perf:test

# Analyze current logs
aws logs tail /aws/apprunner/sb-email-generator --since 1h | yarn logs:analyze
```

### 2. Identify Bottlenecks
- Look for operations with high average duration
- Check for operations with high error rates
- Monitor resource utilization patterns

### 3. Implement Optimizations
- Apply performance fixes
- Update configuration
- Optimize code paths

### 4. Measure Improvements
```bash
# Re-run performance test
yarn perf:test

# Compare with baseline
aws logs tail /aws/apprunner/sb-email-generator --since 1h | yarn logs:analyze
```

### 5. Monitor Long-term
- Set up CloudWatch alarms
- Regular performance reviews
- Continuous optimization

## 🎯 Best Practices

### 1. Log Management
- Use appropriate log levels
- Include relevant context in logs
- Monitor log volume and costs
- Implement log rotation

### 2. Performance Monitoring
- Set up automated monitoring
- Define performance SLOs
- Regular performance reviews
- Proactive optimization

### 3. Error Handling
- Monitor error patterns
- Implement proper error recovery
- Track error rates over time
- Set up error alerts

### 4. Resource Management
- Monitor memory usage
- Track thread pool utilization
- Optimize cache strategies
- Implement resource limits

## 📚 Additional Resources

- [CloudWatch Logs User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/)
- [CloudWatch Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [AWS AppRunner Monitoring](https://docs.aws.amazon.com/apprunner/latest/dg/monitoring.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

This logging system will help you identify and resolve performance bottlenecks quickly, ensuring your email generator runs efficiently on AWS AppRunner. 