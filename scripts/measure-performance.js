#!/usr/bin/env node

import { chromium } from 'playwright';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

// Performance test configuration
const config = {
  sizes: {
    small: { files: 5, linesPerFile: 100 },
    medium: { files: 20, linesPerFile: 500 },
    large: { files: 50, linesPerFile: 1000 },
    xlarge: { files: 100, linesPerFile: 2000 },
  },
  port: 3456,
  defaultIterations: 2,
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

async function getGitInfo() {
  try {
    const { stdout: hash } = await execAsync('git rev-parse HEAD');
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD');
    const { stdout: message } = await execAsync('git log -1 --pretty=%B');
    const { stdout: author } = await execAsync('git log -1 --pretty=%an');
    const { stdout: date } = await execAsync('git log -1 --pretty=%aI');

    // Check if working directory is dirty
    const { stdout: status } = await execAsync('git status --porcelain');
    const isDirty = status.trim().length > 0;

    return {
      commitHash: hash.trim(),
      branch: branch.trim(),
      commitMessage: message.trim(),
      author: author.trim(),
      date: date.trim(),
      isDirty,
    };
  } catch (error) {
    log('Warning: Could not retrieve git information', colors.yellow);
    return null;
  }
}

async function startDifitServer(size, options = {}) {
  log('Starting difit server...', colors.blue);

  let actualPort = config.port;
  let diffInput;

  // Use provided difit path or default
  const difitBinaryPath =
    options.difitPath || path.join(__dirname, '..', 'dist', 'cli', 'index.js');

  const difitProcess = spawn(
    'node',
    [difitBinaryPath, '--port', config.port.toString(), '--no-open'],
    {
      env: { ...process.env, NODE_ENV: 'production' },
    },
  );

  if (options.diffFile) {
    diffInput = createReadStream(path.resolve(options.diffFile));
    diffInput.on('error', (error) => {
      log(`  Diff input error: ${error.message}`, colors.red);
    });
    diffInput.pipe(difitProcess.stdin);
  } else {
    const generateArgs = [path.join(__dirname, 'generate-large-diff.js'), '--size', size];

    if (options.diffSeed) {
      generateArgs.push('--seed', options.diffSeed);
    }

    diffInput = spawn('node', generateArgs);
    diffInput.stdout.pipe(difitProcess.stdin);
    diffInput.stderr.on('data', (data) => {
      log(`  Diff generator error: ${data.toString().trim()}`, colors.red);
    });
  }

  // Promise to wait for server start
  const serverStarted = new Promise((resolve) => {
    difitProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      log(`  Server output: ${output}`, colors.cyan);

      // Extract actual port from output
      const portMatch = output.match(/http:\/\/localhost:(\d+)/);
      if (portMatch) {
        actualPort = parseInt(portMatch[1]);
        resolve(actualPort);
      }
    });

    difitProcess.stderr.on('data', (data) => {
      log(`  Server error: ${data.toString().trim()}`, colors.red);
    });
  });

  // Wait for server to start and get actual port
  const port = await Promise.race([
    serverStarted,
    new Promise((resolve) => setTimeout(() => resolve(actualPort), 5000)),
  ]);

  return { process: difitProcess, port, diffInput };
}

async function measureKeyboardNavigation(page) {
  const metrics = {
    operations: [],
    totalDuration: 0,
    averageOperationTime: 0,
  };

  log('  Testing keyboard navigation performance...', colors.cyan);

  // Wait for initial content to be ready
  try {
    await page.waitForSelector('tr', { timeout: 15000 });
    await page.waitForTimeout(2000); // Give time for React to render all rows
  } catch (error) {
    throw new Error('Could not find table rows - page did not load properly');
  }

  // Measure individual navigation operations
  const navigationTests = [
    { key: 'j', count: 20, description: 'Next line (j)' },
    { key: 'k', count: 10, description: 'Previous line (k)' },
    { key: 'n', count: 5, description: 'Next chunk (n)' },
    { key: 'p', count: 3, description: 'Previous chunk (p)' },
    { key: ']', count: 3, description: 'Next file (])' },
    { key: '[', count: 2, description: 'Previous file ([)' },
  ];

  for (const test of navigationTests) {
    const operations = [];

    for (let i = 0; i < test.count; i++) {
      // Mark start time in the page context
      await page.evaluate(() => {
        window.__navStart = performance.now();
      });

      // Perform navigation
      await page.keyboard.press(test.key);

      // Wait for navigation to complete and measure
      const duration = await page.evaluate(() => {
        return new Promise((resolve) => {
          const measureComplete = () => {
            const duration = performance.now() - window.__navStart;
            resolve(duration);
          };

          // Wait for React to finish rendering
          // Use setTimeout to allow React's concurrent features to complete
          setTimeout(() => {
            // Then wait for the next animation frame
            requestAnimationFrame(measureComplete);
          }, 0);
        });
      });

      operations.push(duration);
      await page.waitForTimeout(50); // Small delay between operations
    }

    const avgDuration = operations.reduce((a, b) => a + b, 0) / operations.length;
    const maxDuration = Math.max(...operations);
    const minDuration = Math.min(...operations);

    metrics.operations.push({
      type: test.description,
      count: test.count,
      durations: operations,
      average: avgDuration,
      max: maxDuration,
      min: minDuration,
    });

    log(
      `    ${test.description}: avg ${avgDuration.toFixed(2)}ms, max ${maxDuration.toFixed(2)}ms`,
      colors.green,
    );
  }

  metrics.totalDuration = metrics.operations.reduce(
    (total, op) => total + op.durations.reduce((a, b) => a + b, 0),
    0,
  );

  metrics.averageOperationTime =
    metrics.totalDuration / metrics.operations.reduce((total, op) => total + op.count, 0);

  return metrics;
}

async function measurePerformance(size, options = {}) {
  const { files, linesPerFile } = config.sizes[size];
  const totalLines = files * linesPerFile;
  const results = [];
  const warmupResults = [];

  log(`\nRunning performance test (${size})...`, colors.yellow);
  log(
    `Files: ${files}, Lines per file: ${linesPerFile}, Total lines: ${totalLines}`,
    colors.yellow,
  );

  const browser = await chromium.launch({
    headless: options.headless !== false,
    devtools: options.devtools === true,
  });

  const iterations = options.iterations || config.defaultIterations;
  const warmupIterations = options.warmupIterations || 0;
  const totalIterations = warmupIterations + iterations;

  if (warmupIterations > 0) {
    log(`Warm-up iterations discarded: ${warmupIterations}`, colors.yellow);
  }

  for (let i = 0; i < totalIterations; i++) {
    const isWarmup = i < warmupIterations;
    log(`\nIteration ${i + 1}/${totalIterations}${isWarmup ? ' (warm-up)' : ''}`, colors.blue);

    const {
      process: difitProcess,
      port: actualPort,
      diffInput,
    } = await startDifitServer(size, options);
    const iterationMetrics = {
      iteration: isWarmup ? i + 1 : i + 1 - warmupIterations,
      phase: isWarmup ? 'warmup' : 'measured',
      timestamp: new Date().toISOString(),
    };

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Enable performance monitoring
      await context.addInitScript(() => {
        window.__perfMarks = [];
        window.__perfMeasures = [];

        const originalMark = performance.mark.bind(performance);
        const originalMeasure = performance.measure.bind(performance);

        performance.mark = function (name) {
          window.__perfMarks.push({ name, time: performance.now() });
          return originalMark(name);
        };

        performance.measure = function (name, startMark, endMark) {
          const measure = originalMeasure(name, startMark, endMark);
          window.__perfMeasures.push({
            name,
            duration: measure.duration,
            startTime: measure.startTime,
          });
          return measure;
        };
      });

      // Navigate to difit
      const loadStartTime = Date.now();
      await page.goto(`http://localhost:${actualPort}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for initial render - wait for the main container
      await page.waitForSelector('.bg-github-bg-primary', { timeout: 30000 });

      // Run keyboard navigation measurement
      iterationMetrics.keyboardNavigation = await measureKeyboardNavigation(page);

      // Collect performance marks and measures
      const perfData = await page.evaluate(() => ({
        marks: window.__perfMarks || [],
        measures: window.__perfMeasures || [],
      }));

      iterationMetrics.performanceData = perfData;

      await context.close();
      if (isWarmup) {
        warmupResults.push(iterationMetrics);
      } else {
        results.push(iterationMetrics);
      }
    } catch (error) {
      log(`  Error: ${error.message}`, colors.red);
      iterationMetrics.error = error.message;
      if (isWarmup) {
        warmupResults.push(iterationMetrics);
      } else {
        results.push(iterationMetrics);
      }
    } finally {
      // Kill the process
      difitProcess.kill('SIGTERM');
      if (diffInput?.kill) {
        diffInput.kill('SIGTERM');
      } else if (diffInput?.destroy) {
        diffInput.destroy();
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  await browser.close();

  return {
    size,
    stats: { files, linesPerFile, totalLines },
    config: {
      iterations: iterations,
      warmupIterations,
    },
    results,
    warmupResults,
    summary: calculateSummary(results),
  };
}

function calculateSummary(results) {
  const summary = {
    keyboardNavigation: {
      averageOperationTime: 0,
      operationBreakdown: {},
    },
  };

  // Filter out results with errors
  const validResults = results.filter((r) => !r.error);

  if (validResults.length === 0) {
    return summary;
  }

  // Calculate keyboard navigation summary
  if (validResults[0].keyboardNavigation) {
    const allOperationTimes = validResults.map((r) => r.keyboardNavigation.averageOperationTime);
    summary.keyboardNavigation.averageOperationTime =
      allOperationTimes.reduce((a, b) => a + b, 0) / allOperationTimes.length;

    // Group by operation type
    const operationTypes = {};
    validResults.forEach((result) => {
      result.keyboardNavigation.operations.forEach((op) => {
        if (!operationTypes[op.type]) {
          operationTypes[op.type] = {
            count: 0,
            totalAverage: 0,
            totalMax: 0,
          };
        }
        operationTypes[op.type].count++;
        operationTypes[op.type].totalAverage += op.average;
        operationTypes[op.type].totalMax += op.max;
      });
    });

    // Calculate averages
    Object.entries(operationTypes).forEach(([type, data]) => {
      summary.keyboardNavigation.operationBreakdown[type] = {
        averageTime: data.totalAverage / data.count,
        averageMaxTime: data.totalMax / data.count,
      };
    });
  }

  return summary;
}

async function main() {
  const args = process.argv.slice(2);

  // Get size from --size flag
  const sizeIndex = args.indexOf('--size');
  const size = sizeIndex !== -1 && args[sizeIndex + 1] ? args[sizeIndex + 1] : 'medium';

  // Check for any positional arguments (which are no longer supported)
  const positionalArgs = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    // Skip flag values
    if (
      index > 0 &&
      [
        '--size',
        '--memo',
        '--iterations',
        '--warmup-iterations',
        '--difit-path',
        '--diff-file',
        '--seed',
        '--output',
      ].includes(args[index - 1])
    )
      return false;
    return true;
  });

  if (positionalArgs.length > 0) {
    log(`Error: Size must be specified with --size flag, not as positional argument`, colors.red);
    log(`Use: pnpm perf --size ${positionalArgs[0]}`, colors.yellow);
    process.exit(1);
  }

  const memo = args.includes('--memo') ? args[args.indexOf('--memo') + 1] : undefined;

  // Get difit path from --difit-path flag or use default
  const difitPathIndex = args.indexOf('--difit-path');
  const difitPath =
    difitPathIndex !== -1 && args[difitPathIndex + 1] ? args[difitPathIndex + 1] : undefined;
  const diffFileIndex = args.indexOf('--diff-file');
  const diffFile =
    diffFileIndex !== -1 && args[diffFileIndex + 1] ? args[diffFileIndex + 1] : undefined;
  const diffSeedIndex = args.indexOf('--seed');
  const diffSeed =
    diffSeedIndex !== -1 && args[diffSeedIndex + 1] ? args[diffSeedIndex + 1] : undefined;
  const outputIndex = args.indexOf('--output');
  const outputPath =
    outputIndex !== -1 && args[outputIndex + 1] ? args[outputIndex + 1] : undefined;

  const options = {
    headless: !args.includes('--headed'),
    devtools: args.includes('--devtools'),
    iterations: args.includes('--iterations')
      ? parseInt(args[args.indexOf('--iterations') + 1])
      : undefined,
    warmupIterations: args.includes('--warmup-iterations')
      ? parseInt(args[args.indexOf('--warmup-iterations') + 1])
      : undefined,
    difitPath,
    diffFile,
    diffSeed,
  };

  if (!config.sizes[size]) {
    log(`Invalid size: ${size}`, colors.red);
    log(`Available sizes: ${Object.keys(config.sizes).join(', ')}`);
    log(`\nUsage: pnpm perf [options]`);
    log(`Options:`);
    log(`  --size <size>        Size of diff to test (default: medium)`);
    log(`  --headed             Run tests in headed mode (show browser)`);
    log(`  --iterations <n>     Number of iterations (default: ${config.defaultIterations})`);
    log(`  --warmup-iterations <n>  Warm-up iterations to discard (default: 0)`);
    log(`  --memo <text>        Add a memo to the results`);
    log(`  --devtools           Open browser devtools`);
    log(`  --difit-path <path>  Path to difit CLI (default: dist/cli/index.js)`);
    log(`  --diff-file <path>   Use an existing diff file instead of generating one`);
    log(`  --seed <value>       Seed for deterministic diff generation`);
    log(`  --output <path>      Write results to a specific file`);
    process.exit(1);
  }

  log(`${colors.bright}Difit Performance Test${colors.reset}`);
  log('======================\n');

  // Get git information
  const gitInfo = await getGitInfo();

  const startTime = Date.now();
  const results = await measurePerformance(size, options);
  const totalTime = Date.now() - startTime;

  // Add metadata
  results.metadata = {
    timestamp: new Date().toISOString(),
    duration: totalTime,
    gitInfo,
    memo,
    benchmark: {
      name: 'keyboard-navigation',
      diffFile,
      diffSeed: diffSeed || null,
    },
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  log(`\n${colors.bright}Summary${colors.reset}`);
  log('=======');
  log(`Size: ${results.size}`);
  log(`Total files: ${results.stats.files}`);
  log(`Total lines: ${results.stats.totalLines}`);
  log(
    `Valid iterations: ${results.results.filter((r) => !r.error).length}/${results.config.iterations}`,
  );
  if (results.config.warmupIterations > 0) {
    log(`Discarded warm-up iterations: ${results.config.warmupIterations}`);
  }

  if (results.summary.keyboardNavigation.averageOperationTime > 0) {
    log(`\nKeyboard Navigation Benchmark:`);
    log(
      `  Average operation time: ${results.summary.keyboardNavigation.averageOperationTime.toFixed(2)}ms`,
    );
    log(`\n  Operation breakdown:`);
    Object.entries(results.summary.keyboardNavigation.operationBreakdown).forEach(
      ([type, data]) => {
        log(`    ${type}:`);
        log(`      Average: ${data.averageTime.toFixed(2)}ms`);
        log(`      Max average: ${data.averageMaxTime.toFixed(2)}ms`);
      },
    );
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = outputPath
    ? path.resolve(outputPath)
    : path.join(__dirname, '..', 'performance-results', `perf-${size}-${timestamp}.json`);

  await fs.mkdir(path.dirname(resultsFile), { recursive: true });
  await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
  log(`\nResults saved to: ${resultsFile}`, colors.green);

  if (gitInfo) {
    log(
      `\nCommit: ${gitInfo.commitHash.substring(0, 8)} - ${gitInfo.commitMessage.split('\n')[0]}`,
    );
    if (gitInfo.isDirty) {
      log(`Working directory: DIRTY (uncommitted changes)`, colors.yellow);
    }
  }

  if (memo) {
    log(`Memo: ${memo}`);
  }
}

main().catch((error) => {
  log(`Error: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
