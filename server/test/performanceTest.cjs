const fs = require('fs').promises;
const path = require('path');
const { performance } = require('perf_hooks');

/**
 * Performance Test Suite for CSV Import Optimization
 * 
 * This script demonstrates the significant performance improvements
 * achieved through various optimization techniques.
 */

// Generate test CSV data
function generateTestCSV(rows = 1000) {
  const headers = [
    'Call Time', 'Caller ID', 'Destination', 'Trunk', 
    'Trunk Number', 'DID', 'Status', 'Ringing', 
    'Talking', 'Total Duration', 'Call Type', 
    'Sentiment', 'Summary', 'Transcription'
  ];
  
  const statuses = ['Answered', 'Unanswered', 'Busy', 'Failed', 'Redirected'];
  const destinations = ['PR Welcome message (801)', 'Telemarketing incoming calls (805)', 'UGT Ring Group (809)'];
  const sentiments = ['Positive', 'Neutral', 'Negative', ''];
  
  let csv = headers.join(',') + '\n';
  
  for (let i = 0; i < rows; i++) {
    const date = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const row = [
      date.toISOString().replace('T', ' ').replace('.000Z', ''),
      Math.floor(Math.random() * 9000000000) + 1000000000,
      destinations[Math.floor(Math.random() * destinations.length)],
      '42468538 In Call Trunk (Per Minute)',
      '10004',
      Math.floor(Math.random() * 9000000000) + 1000000000,
      statuses[Math.floor(Math.random() * statuses.length)],
      `0:00:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      `0:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      `0:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      'Inbound',
      sentiments[Math.floor(Math.random() * sentiments.length)],
      i % 10 === 0 ? 'Customer inquiry about product features' : '',
      i % 20 === 0 ? 'Full transcription of the call would go here...' : ''
    ];
    
    csv += row.join(',') + '\n';
  }
  
  return csv;
}

// Simulate original (non-optimized) processing
async function simulateOriginalProcessing(csvContent) {
  const startTime = performance.now();
  
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const records = [];
  
  // Sequential processing (no parallelization)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(',');
    const record = {};
    
    headers.forEach((header, index) => {
      record[header.trim()] = values[index]?.trim() || '';
    });
    
    // Simulate individual insert delay (network latency)
    await new Promise(resolve => setTimeout(resolve, 5)); // 5ms per record
    records.push(record);
  }
  
  const endTime = performance.now();
  return {
    time: endTime - startTime,
    records: records.length,
    throughput: records.length / ((endTime - startTime) / 1000)
  };
}

// Test optimized processing
async function testOptimizedProcessing(csvContent) {
  const OptimizedCSVProcessor = require('../services/optimizedCsvProcessor.cjs');
  
  // Mock service for testing
  const mockService = {
    insertInboundCall: async (record) => {
      // Simulate MongoDB insert delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      return { success: true, action: 'created' };
    }
  };
  
  const configs = [
    { name: 'Small Batch', batchSize: 100, workerPoolSize: 2, maxConcurrentBatches: 5 },
    { name: 'Medium Batch', batchSize: 500, workerPoolSize: 4, maxConcurrentBatches: 10 },
    { name: 'Large Batch', batchSize: 1000, workerPoolSize: 4, maxConcurrentBatches: 10 },
    { name: 'Ultra Parallel', batchSize: 2000, workerPoolSize: 8, maxConcurrentBatches: 20 }
  ];
  
  const results = [];
  
  for (const config of configs) {
    const processor = new OptimizedCSVProcessor({
      ...config,
      enableProfiling: false
    });
    
    const startTime = performance.now();
    const result = await processor.processCSV(csvContent, mockService);
    const endTime = performance.now();
    
    results.push({
      name: config.name,
      config,
      time: endTime - startTime,
      throughput: result.metrics.throughput,
      parseTime: result.metrics.parseTime,
      insertTime: result.metrics.insertTime
    });
  }
  
  return results;
}

// Main test runner
async function runPerformanceTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     CSV IMPORT PERFORMANCE OPTIMIZATION TEST SUITE         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const testSizes = [100, 500, 1000, 5000];
  
  for (const size of testSizes) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`  Testing with ${size} records`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    const csvContent = generateTestCSV(size);
    console.log(`Generated ${(csvContent.length / 1024).toFixed(2)} KB of CSV data\n`);
    
    // Test original (non-optimized) approach
    console.log('📊 Testing ORIGINAL (non-optimized) processing...');
    const originalResult = await simulateOriginalProcessing(csvContent);
    console.log(`   Time: ${originalResult.time.toFixed(2)}ms`);
    console.log(`   Throughput: ${originalResult.throughput.toFixed(2)} rows/second\n`);
    
    // Test optimized approaches
    console.log('🚀 Testing OPTIMIZED processing with different configurations...');
    const optimizedResults = await testOptimizedProcessing(csvContent);
    
    // Display results
    console.log('\n┌─────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Configuration       │ Total Time   │ Parse Time   │ Insert Time  │ Throughput   │');
    console.log('├─────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');
    
    optimizedResults.forEach(result => {
      console.log(
        `│ ${result.name.padEnd(19)} │ ${String(result.time.toFixed(0) + 'ms').padEnd(12)} │ ` +
        `${String(result.parseTime.toFixed(0) + 'ms').padEnd(12)} │ ` +
        `${String(result.insertTime.toFixed(0) + 'ms').padEnd(12)} │ ` +
        `${String(result.throughput.toFixed(0) + '/s').padEnd(12)} │`
      );
    });
    
    console.log('└─────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┘');
    
    // Calculate improvements
    const bestOptimized = optimizedResults.reduce((best, current) => 
      current.time < best.time ? current : best
    );
    
    const improvement = ((originalResult.time - bestOptimized.time) / originalResult.time * 100).toFixed(1);
    const speedup = (originalResult.time / bestOptimized.time).toFixed(2);
    
    console.log('\n📈 PERFORMANCE IMPROVEMENT SUMMARY:');
    console.log(`   Best Configuration: ${bestOptimized.name}`);
    console.log(`   Performance Gain: ${improvement}% faster`);
    console.log(`   Speed Multiplier: ${speedup}x`);
    console.log(`   Original: ${originalResult.time.toFixed(0)}ms → Optimized: ${bestOptimized.time.toFixed(0)}ms`);
    console.log(`   Throughput: ${originalResult.throughput.toFixed(0)}/s → ${bestOptimized.throughput.toFixed(0)}/s`);
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUITE COMPLETE                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Memory usage report
  const memUsage = process.memoryUsage();
  console.log('💾 Memory Usage:');
  console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('\n✅ All performance tests completed successfully!\n');
}

// Run tests if executed directly
if (require.main === module) {
  runPerformanceTests().catch(console.error);
}

module.exports = { runPerformanceTests, generateTestCSV };