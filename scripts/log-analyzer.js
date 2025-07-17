#!/usr/bin/env node

import { performance } from 'perf_hooks';

// Log analysis utilities
class LogAnalyzer {
  constructor() {
    this.performanceData = new Map();
    this.errorData = new Map();
    this.requestData = new Map();
    this.operationData = new Map();
  }

  // Parse JSON log line
  parseLogLine(line) {
    try {
      return JSON.parse(line);
    } catch (error) {
      return null;
    }
  }

  // Analyze log file or stream
  analyzeLogs(logLines) {
    console.log('🔍 Starting log analysis...\n');
    
    let totalLines = 0;
    let parsedLines = 0;
    let errorCount = 0;
    let performanceCount = 0;
    let requestCount = 0;

    for (const line of logLines) {
      totalLines++;
      const logEntry = this.parseLogLine(line);
      
      if (!logEntry) continue;
      parsedLines++;

      // Categorize log entries
      if (logEntry.level === 'ERROR') {
        this.processError(logEntry);
        errorCount++;
      }

      if (logEntry.message?.includes('Performance:')) {
        this.processPerformance(logEntry);
        performanceCount++;
      }

      if (logEntry.message?.includes('Request')) {
        this.processRequest(logEntry);
        requestCount++;
      }

      // Track operations
      if (logEntry.operation) {
        this.processOperation(logEntry);
      }
    }

    console.log(`📊 Log Analysis Summary:`);
    console.log(`   Total lines: ${totalLines}`);
    console.log(`   Parsed lines: ${parsedLines}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Performance entries: ${performanceCount}`);
    console.log(`   Request entries: ${requestCount}\n`);

    this.generateReports();
  }

  // Process error logs
  processError(logEntry) {
    const errorKey = logEntry.error || logEntry.message;
    if (!this.errorData.has(errorKey)) {
      this.errorData.set(errorKey, {
        count: 0,
        occurrences: [],
        modules: new Set()
      });
    }

    const errorInfo = this.errorData.get(errorKey);
    errorInfo.count++;
    errorInfo.occurrences.push({
      timestamp: logEntry.timestamp,
      requestId: logEntry.requestId,
      module: logEntry.module
    });
    errorInfo.modules.add(logEntry.module);
  }

  // Process performance logs
  processPerformance(logEntry) {
    const operation = logEntry.operation || logEntry.message.split(':')[1]?.trim();
    if (!operation) return;

    if (!this.performanceData.has(operation)) {
      this.performanceData.set(operation, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        durations: []
      });
    }

    const perfInfo = this.performanceData.get(operation);
    const duration = parseFloat(logEntry.duration?.replace('ms', '') || '0');
    
    perfInfo.count++;
    perfInfo.totalDuration += duration;
    perfInfo.minDuration = Math.min(perfInfo.minDuration, duration);
    perfInfo.maxDuration = Math.max(perfInfo.maxDuration, duration);
    perfInfo.durations.push(duration);
  }

  // Process request logs
  processRequest(logEntry) {
    const requestId = logEntry.requestId;
    if (!requestId) return;

    if (!this.requestData.has(requestId)) {
      this.requestData.set(requestId, {
        startTime: null,
        endTime: null,
        duration: null,
        statusCode: null,
        success: null,
        operations: []
      });
    }

    const requestInfo = this.requestData.get(requestId);
    
    if (logEntry.message?.includes('started')) {
      requestInfo.startTime = logEntry.timestamp;
    } else if (logEntry.message?.includes('completed')) {
      requestInfo.endTime = logEntry.timestamp;
      requestInfo.duration = logEntry.duration;
      requestInfo.statusCode = logEntry.statusCode;
      requestInfo.success = logEntry.success;
    }
  }

  // Process operation logs
  processOperation(logEntry) {
    const operation = logEntry.operation;
    if (!operation) return;

    if (!this.operationData.has(operation)) {
      this.operationData.set(operation, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        successCount: 0,
        errorCount: 0
      });
    }

    const opInfo = this.operationData.get(operation);
    opInfo.count++;
    
    if (logEntry.duration) {
      const duration = parseFloat(logEntry.duration.replace('ms', ''));
      opInfo.totalDuration += duration;
      opInfo.minDuration = Math.min(opInfo.minDuration, duration);
      opInfo.maxDuration = Math.max(opInfo.maxDuration, duration);
    }

    if (logEntry.success !== undefined) {
      if (logEntry.success) {
        opInfo.successCount++;
      } else {
        opInfo.errorCount++;
      }
    }
  }

  // Generate performance report
  generatePerformanceReport() {
    console.log('🚀 Performance Report:\n');
    
    const sortedOperations = Array.from(this.performanceData.entries())
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration);

    console.log('Top 10 Slowest Operations:');
    console.log('─'.repeat(80));
    
    sortedOperations.slice(0, 10).forEach(([operation, data]) => {
      const avgDuration = data.totalDuration / data.count;
      console.log(`${operation.padEnd(30)} ${avgDuration.toFixed(2)}ms avg (${data.count} calls)`);
      console.log(`  Range: ${data.minDuration.toFixed(2)}ms - ${data.maxDuration.toFixed(2)}ms`);
      console.log(`  Total time: ${(data.totalDuration / 1000).toFixed(2)}s\n`);
    });

    // Calculate percentiles
    console.log('Performance Percentiles:');
    console.log('─'.repeat(80));
    
    sortedOperations.slice(0, 5).forEach(([operation, data]) => {
      const sortedDurations = data.durations.sort((a, b) => a - b);
      const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)];
      const p90 = sortedDurations[Math.floor(sortedDurations.length * 0.9)];
      const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];
      const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)];
      
      console.log(`${operation}:`);
      console.log(`  P50: ${p50?.toFixed(2)}ms, P90: ${p90?.toFixed(2)}ms, P95: ${p95?.toFixed(2)}ms, P99: ${p99?.toFixed(2)}ms`);
    });
  }

  // Generate error report
  generateErrorReport() {
    console.log('\n❌ Error Report:\n');
    
    const sortedErrors = Array.from(this.errorData.entries())
      .sort((a, b) => b[1].count - a[1].count);

    console.log('Top 10 Most Common Errors:');
    console.log('─'.repeat(80));
    
    sortedErrors.slice(0, 10).forEach(([error, data]) => {
      console.log(`${error.substring(0, 60).padEnd(60)} (${data.count} occurrences)`);
      console.log(`  Modules: ${Array.from(data.modules).join(', ')}`);
      console.log(`  Recent: ${data.occurrences.slice(-3).map(o => o.timestamp).join(', ')}\n`);
    });
  }

  // Generate operation report
  generateOperationReport() {
    console.log('\n⚙️ Operation Report:\n');
    
    const sortedOperations = Array.from(this.operationData.entries())
      .sort((a, b) => b[1].count - a[1].count);

    console.log('Operation Statistics:');
    console.log('─'.repeat(80));
    
    sortedOperations.forEach(([operation, data]) => {
      const avgDuration = data.totalDuration / data.count;
      const successRate = data.successCount / (data.successCount + data.errorCount) * 100;
      
      console.log(`${operation.padEnd(30)} ${data.count} calls, ${avgDuration.toFixed(2)}ms avg, ${successRate.toFixed(1)}% success`);
    });
  }

  // Generate request report
  generateRequestReport() {
    console.log('\n📡 Request Report:\n');
    
    const completedRequests = Array.from(this.requestData.values())
      .filter(req => req.duration !== null);

    if (completedRequests.length === 0) {
      console.log('No completed requests found in logs');
      return;
    }

    const durations = completedRequests.map(req => parseFloat(req.duration.replace('ms', '')));
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const successCount = completedRequests.filter(req => req.success).length;
    const successRate = (successCount / completedRequests.length) * 100;

    console.log(`Total Requests: ${completedRequests.length}`);
    console.log(`Average Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`Min Duration: ${minDuration.toFixed(2)}ms`);
    console.log(`Max Duration: ${maxDuration.toFixed(2)}ms`);
    console.log(`Success Rate: ${successRate.toFixed(1)}%`);

    // Status code distribution
    const statusCodes = {};
    completedRequests.forEach(req => {
      statusCodes[req.statusCode] = (statusCodes[req.statusCode] || 0) + 1;
    });

    console.log('\nStatus Code Distribution:');
    Object.entries(statusCodes).forEach(([code, count]) => {
      console.log(`  ${code}: ${count} (${(count / completedRequests.length * 100).toFixed(1)}%)`);
    });
  }

  // Generate bottleneck recommendations
  generateBottleneckRecommendations() {
    console.log('\n💡 Performance Recommendations:\n');
    
    const slowOperations = Array.from(this.performanceData.entries())
      .filter(([_, data]) => data.totalDuration / data.count > 1000) // Operations taking > 1s on average
      .sort((a, b) => b[1].totalDuration - a[1].totalDuration);

    if (slowOperations.length === 0) {
      console.log('✅ No significant performance bottlenecks detected');
      return;
    }

    console.log('Potential Bottlenecks:');
    console.log('─'.repeat(80));
    
    slowOperations.forEach(([operation, data]) => {
      const avgDuration = data.totalDuration / data.count;
      console.log(`🔴 ${operation}: ${avgDuration.toFixed(2)}ms average`);
      
      // Provide specific recommendations
      if (operation.includes('openai')) {
        console.log(`   💡 Consider: Optimizing OpenAI API calls, implementing caching, reducing prompt size`);
      } else if (operation.includes('file')) {
        console.log(`   💡 Consider: Implementing file caching, optimizing file paths, using faster storage`);
      } else if (operation.includes('cache')) {
        console.log(`   💡 Consider: Optimizing cache operations, implementing better cache strategies`);
      } else if (operation.includes('thread')) {
        console.log(`   💡 Consider: Optimizing thread pool size, implementing connection pooling`);
      }
      console.log('');
    });
  }

  // Generate all reports
  generateReports() {
    this.generatePerformanceReport();
    this.generateErrorReport();
    this.generateOperationReport();
    this.generateRequestReport();
    this.generateBottleneckRecommendations();
  }
}

// Main function
async function main() {
  const analyzer = new LogAnalyzer();
  
  // Read from stdin if no file provided
  const lines = [];
  
  process.stdin.setEncoding('utf8');
  
  process.stdin.on('data', (chunk) => {
    const chunkLines = chunk.split('\n');
    lines.push(...chunkLines);
  });
  
  process.stdin.on('end', () => {
    analyzer.analyzeLogs(lines);
  });
  
  // If no stdin, show usage
  if (process.stdin.isTTY) {
    console.log('CloudWatch Log Analyzer');
    console.log('Usage:');
    console.log('  aws logs tail /aws/apprunner/your-service-name --follow | node scripts/log-analyzer.js');
    console.log('  cat your-log-file.log | node scripts/log-analyzer.js');
    console.log('');
    console.log('This tool analyzes structured JSON logs and provides:');
    console.log('  - Performance analysis and bottlenecks');
    console.log('  - Error patterns and frequency');
    console.log('  - Operation statistics');
    console.log('  - Request performance metrics');
    console.log('  - Performance recommendations');
  }
}

main().catch(console.error); 