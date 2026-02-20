#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Simple logging without colors for CI compatibility
function log(message) {
  console.error(message);
}

async function loadPerformanceResults(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

function calculateChange(oldValue, newValue) {
  const change = newValue - oldValue;
  const percentChange = ((change / oldValue) * 100).toFixed(2);
  return {
    absolute: change,
    percent: parseFloat(percentChange),
    improved: change < 0,
  };
}

function formatChange(change) {
  const sign = change.absolute >= 0 ? '+' : '';
  return `${sign}${change.absolute.toFixed(2)}ms (${sign}${change.percent}%)`;
}

function formatMilliseconds(ms) {
  return `${ms.toFixed(2)}ms`;
}

function generateMarkdownTable(comparison) {
  const lines = [];

  lines.push('# Performance Comparison Report\n');

  const baseline = comparison.baseline;
  const current = comparison.current;

  // Summary first
  const baselineAvg = comparison.baseline.averageOperationTime;
  const currentAvg = comparison.current.averageOperationTime;
  const avgChange = comparison.metrics.keyboardNavigation.change;

  if (avgChange.improved) {
    lines.push(`## ✅ Performance improved by ${Math.abs(avgChange.percent).toFixed(1)}%\n`);
  } else if (avgChange.percent > 5) {
    lines.push(`## ⚠️ Performance regressed by ${avgChange.percent.toFixed(1)}%\n`);
  } else {
    lines.push(`## ➡️ Performance remained stable (${avgChange.percent.toFixed(1)}% change)\n`);
  }

  // Main performance comparison
  lines.push('### Average Operation Time');
  lines.push('```');
  lines.push(`Baseline: ${formatMilliseconds(baselineAvg)}`);
  lines.push(`Current:  ${formatMilliseconds(currentAvg)}`);
  lines.push(
    `Change:   ${
      avgChange.improved ? '🟢' : avgChange.percent > 5 ? '🔴' : '🟡'
    } ${avgChange.absolute.toFixed(2)}ms (${avgChange.percent > 0 ? '+' : ''}${avgChange.percent.toFixed(1)}%)`,
  );
  lines.push('```\n');

  // Test details
  lines.push('### Test Configuration');
  lines.push(
    `- **Size**: ${baseline.size} (${baseline.totalFiles} files, ${baseline.totalLines} lines)`,
  );
  lines.push(`- **Iterations**: ${baseline.iterations} → ${current.iterations}\n`);

  // Commit information in a more compact format
  lines.push('### Commits Compared');
  lines.push('| | Baseline | Current |');
  lines.push('|---|----------|---------|');
  lines.push(
    `| **Commit** | \`${baseline.commitHash.substring(0, 8)}\` | \`${current.commitHash.substring(0, 8)}\` |`,
  );
  lines.push(`| **Branch** | ${baseline.branch} | ${current.branch} |`);
  if (baseline.isDirty || current.isDirty) {
    lines.push(
      `| **Dirty** | ${baseline.isDirty ? '⚠️ Yes' : '✅ No'} | ${current.isDirty ? '⚠️ Yes' : '✅ No'} |`,
    );
  }
  if (baseline.memo || current.memo) {
    lines.push(`| **Memo** | ${baseline.memo || '-'} | ${current.memo || '-'} |`);
  }

  return lines.join('\n');
}

function generateComparison(baselineResults, comparedResults) {
  const baselineAvg = baselineResults.summary.keyboardNavigation.averageOperationTime;
  const comparedAvg = comparedResults.summary.keyboardNavigation.averageOperationTime;
  const difference = comparedAvg - baselineAvg;
  const changePercent = (difference / baselineAvg) * 100;

  const comparison = {
    baseline: {
      file: baselineResults.file,
      commitHash: baselineResults.metadata.gitInfo?.commitHash || 'unknown',
      branch: baselineResults.metadata.gitInfo?.branch || 'unknown',
      commitMessage: baselineResults.metadata.gitInfo?.commitMessage || 'unknown',
      isDirty: baselineResults.metadata.gitInfo?.isDirty || false,
      timestamp: baselineResults.metadata.timestamp,
      memo: baselineResults.metadata.memo,
      size: baselineResults.size,
      totalFiles: baselineResults.stats.files,
      totalLines: baselineResults.stats.totalLines,
      iterations: baselineResults.config.iterations,
      averageOperationTime: baselineAvg,
    },
    current: {
      file: comparedResults.file,
      commitHash: comparedResults.metadata.gitInfo?.commitHash || 'unknown',
      branch: comparedResults.metadata.gitInfo?.branch || 'unknown',
      commitMessage: comparedResults.metadata.gitInfo?.commitMessage || 'unknown',
      isDirty: comparedResults.metadata.gitInfo?.isDirty || false,
      timestamp: comparedResults.metadata.timestamp,
      memo: comparedResults.metadata.memo,
      size: comparedResults.size,
      totalFiles: comparedResults.stats.files,
      totalLines: comparedResults.stats.totalLines,
      iterations: comparedResults.config.iterations,
      averageOperationTime: comparedAvg,
    },
    difference,
    changePercent,
    metrics: {
      keyboardNavigation: {
        baseline: baselineResults.summary.keyboardNavigation,
        compared: comparedResults.summary.keyboardNavigation,
        change: calculateChange(
          baselineResults.summary.keyboardNavigation.averageOperationTime,
          comparedResults.summary.keyboardNavigation.averageOperationTime,
        ),
        operationBreakdown: {},
      },
    },
  };

  // Compare operation breakdown
  const baselineOps = baselineResults.summary.keyboardNavigation.operationBreakdown;
  const comparedOps = comparedResults.summary.keyboardNavigation.operationBreakdown;

  for (const [operation, baselineData] of Object.entries(baselineOps)) {
    const comparedData = comparedOps[operation];
    if (comparedData) {
      comparison.metrics.keyboardNavigation.operationBreakdown[operation] = {
        baseline: baselineData,
        compared: comparedData,
        avgChange: calculateChange(baselineData.averageTime, comparedData.averageTime),
        maxChange: calculateChange(baselineData.averageMaxTime, comparedData.averageMaxTime),
      };
    }
  }

  return comparison;
}

async function findLatestResults(resultsDir, size) {
  const files = await fs.readdir(resultsDir);
  const perfFiles = files
    .filter((f) => f.startsWith(`perf-${size}-`) && f.endsWith('.json'))
    .sort()
    .reverse();

  if (perfFiles.length < 2) {
    throw new Error(`Need at least 2 performance results for size '${size}' to compare`);
  }

  return {
    baseline: path.join(resultsDir, perfFiles[1]),
    compared: path.join(resultsDir, perfFiles[0]),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const resultsDir = path.join(__dirname, '..', 'performance-results');

  // Get size from flag
  const sizeIndex = args.indexOf('--size');
  const size = sizeIndex !== -1 && args[sizeIndex + 1] ? args[sizeIndex + 1] : 'medium';

  // Filter out flags and their values from positional arguments
  const positionalArgs = args.filter((arg, index) => {
    // Skip flags
    if (arg.startsWith('--')) return false;
    // Skip flag values
    if (index > 0 && args[index - 1] === '--size') return false;
    return true;
  });

  let baselineFile, comparedFile;

  // Parse arguments
  if (positionalArgs.length === 0) {
    // No args: find latest two results for specified size
    const latest = await findLatestResults(resultsDir, size);
    baselineFile = latest.baseline;
    comparedFile = latest.compared;
  } else if (positionalArgs.length === 2) {
    // Two args: two specific files
    baselineFile = path.resolve(positionalArgs[0]);
    comparedFile = path.resolve(positionalArgs[1]);
  } else {
    console.error(
      'Usage: pnpm perf:compare [--size <size>] or pnpm perf:compare <baseline-file> <compared-file>',
    );
    console.error('Options:');
    console.error(
      '  --size <size>  Size to compare (small, medium, large, xlarge). Default: medium',
    );
    console.error('  --json         Output as JSON');
    console.error('  --save         Save markdown output to file');
    process.exit(1);
  }

  // Output format
  const outputFormat = args.includes('--json') ? 'json' : 'markdown';

  if (outputFormat !== 'json') {
    log('Performance Comparison Tool');
    log('===========================\n');
    log('Loading performance results...');
  }

  // Load results
  const baselineResults = await loadPerformanceResults(baselineFile);
  const comparedResults = await loadPerformanceResults(comparedFile);

  // Add file references
  baselineResults.file = path.basename(baselineFile);
  comparedResults.file = path.basename(comparedFile);

  // Validate same size
  if (baselineResults.size !== comparedResults.size && outputFormat !== 'json') {
    log(`Warning: Comparing different sizes (${baselineResults.size} vs ${comparedResults.size})`);
  }

  // Generate comparison
  const comparison = generateComparison(baselineResults, comparedResults);

  if (outputFormat === 'json') {
    console.log(JSON.stringify(comparison, null, 2));
  } else {
    const markdown = generateMarkdownTable(comparison);
    console.log('\n' + markdown);

    // Save to file if requested
    if (args.includes('--save')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(resultsDir, `comparison-${timestamp}.md`);
      await fs.writeFile(outputFile, markdown);
      log(`\nComparison saved to: ${outputFile}`);
    }
  }
}

main().catch((error) => {
  log(`Error: ${error.message}`);
  process.exit(1);
});
