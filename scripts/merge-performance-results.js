#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

async function loadPerformanceResults(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load ${filePath}: ${error.message}`);
  }
}

function calculateSummary(results) {
  const summary = {
    keyboardNavigation: {
      averageOperationTime: 0,
      operationBreakdown: {},
    },
  };

  const validResults = results.filter((result) => !result.error);

  if (validResults.length === 0) {
    return summary;
  }

  const allOperationTimes = validResults.map(
    (result) => result.keyboardNavigation.averageOperationTime,
  );
  summary.keyboardNavigation.averageOperationTime =
    allOperationTimes.reduce((total, value) => total + value, 0) / allOperationTimes.length;

  const operationTypes = {};
  validResults.forEach((result) => {
    result.keyboardNavigation.operations.forEach((operation) => {
      if (!operationTypes[operation.type]) {
        operationTypes[operation.type] = {
          count: 0,
          totalAverage: 0,
          totalMax: 0,
        };
      }

      operationTypes[operation.type].count++;
      operationTypes[operation.type].totalAverage += operation.average;
      operationTypes[operation.type].totalMax += operation.max;
    });
  });

  Object.entries(operationTypes).forEach(([type, data]) => {
    summary.keyboardNavigation.operationBreakdown[type] = {
      averageTime: data.totalAverage / data.count,
      averageMaxTime: data.totalMax / data.count,
    };
  });

  return summary;
}

function validateCompatibleResults(results, filePaths) {
  const [first, ...rest] = results;

  for (let index = 0; index < rest.length; index++) {
    const current = rest[index];
    const filePath = filePaths[index + 1];

    if (current.size !== first.size) {
      throw new Error(
        `Cannot merge different sizes: ${filePaths[0]} (${first.size}) vs ${filePath} (${current.size})`,
      );
    }

    if (current.metadata?.gitInfo?.commitHash !== first.metadata?.gitInfo?.commitHash) {
      throw new Error(`Cannot merge different commits: ${filePaths[0]} vs ${filePath}`);
    }
  }
}

function mergeResults(results, sourceFiles) {
  const [first] = results;
  const measuredResults = [];
  const warmupResults = [];
  const memos = new Set();

  results.forEach((result, resultIndex) => {
    const sourceFile = path.basename(sourceFiles[resultIndex]);

    if (result.metadata?.memo) {
      memos.add(result.metadata.memo);
    }

    result.results.forEach((entry, entryIndex) => {
      measuredResults.push({
        ...entry,
        iteration: measuredResults.length + 1,
        sourceFile,
        sourceIteration: entry.iteration ?? entryIndex + 1,
      });
    });

    for (const entry of result.warmupResults ?? []) {
      warmupResults.push({
        ...entry,
        sourceFile,
      });
    }
  });

  return {
    size: first.size,
    stats: first.stats,
    config: {
      iterations: measuredResults.length,
      warmupIterations: warmupResults.length,
      mergedRuns: results.length,
    },
    results: measuredResults,
    warmupResults,
    summary: calculateSummary(measuredResults),
    metadata: {
      timestamp: new Date().toISOString(),
      duration: results.reduce((total, result) => total + (result.metadata?.duration ?? 0), 0),
      gitInfo: first.metadata?.gitInfo ?? null,
      memo: Array.from(memos).join('; ') || undefined,
      benchmark: {
        ...(first.metadata?.benchmark ?? {}),
        mergedFrom: sourceFiles.map((file) => path.basename(file)),
      },
      environment: first.metadata?.environment ?? null,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');

  if (outputIndex === -1 || !args[outputIndex + 1]) {
    console.error('Usage: node scripts/merge-performance-results.js --output <file> <results...>');
    process.exit(1);
  }

  const outputPath = path.resolve(args[outputIndex + 1]);
  const inputFiles = args.filter((arg, index) => {
    if (arg === '--output') return false;
    if (index > 0 && args[index - 1] === '--output') return false;
    return true;
  });

  if (inputFiles.length < 2) {
    console.error('Provide at least two result files to merge.');
    process.exit(1);
  }

  const resolvedInputFiles = inputFiles.map((file) => path.resolve(file));
  const results = await Promise.all(resolvedInputFiles.map(loadPerformanceResults));
  validateCompatibleResults(results, resolvedInputFiles);

  const merged = mergeResults(results, resolvedInputFiles);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(merged, null, 2));

  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
