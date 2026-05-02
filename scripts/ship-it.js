#!/usr/bin/env node
/**
 * ship-it.js — ValuBull cross-platform release trigger
 *
 * Usage:  node scripts/ship-it.js
 *
 * Prompts for a semver version, creates a git tag, and pushes it.
 * One tag push simultaneously triggers:
 *   iOS    → TestFlight     (.github/workflows/ios-deploy.yml)
 *   Android → Play Store   (.github/workflows/android-deploy.yml)
 *   Web    → Vercel         (automatic on any push to main)
 */

const { execSync } = require('child_process');
const readline     = require('readline');

const REPO = 'https://github.com/evantheron115-commits/StockWise/actions';

function run(cmd) {
  process.stdout.write(`  $ ${cmd}\n`);
  execSync(cmd, { stdio: 'inherit' });
}

function semverValid(v) {
  return /^\d+\.\d+\.\d+$/.test(v);
}

function tagExists(tag) {
  try {
    execSync(`git rev-parse --verify ${tag}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function uncommittedChanges() {
  const out = execSync('git status --porcelain', { encoding: 'utf8' });
  return out.trim().length > 0;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║  ValuBull  ·  Ship It                ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Guard: uncommitted changes
  if (uncommittedChanges()) {
    console.error('✗  You have uncommitted changes. Commit or stash them first.\n');
    process.exit(1);
  }

  // Prompt for version
  const raw     = await ask('Version number (e.g. 1.2.0): ');
  const version = raw.trim();

  if (!semverValid(version)) {
    console.error(`\n✗  "${version}" is not valid semver. Use X.Y.Z (e.g. 1.2.0)\n`);
    process.exit(1);
  }

  const tag = `v${version}`;

  if (tagExists(tag)) {
    console.error(`\n✗  Tag ${tag} already exists. Choose a higher version.\n`);
    process.exit(1);
  }

  // Summary
  console.log(`\nAbout to release:\n`);
  console.log(`  Tag    : ${tag}`);
  console.log(`  iOS    : archive → sign → TestFlight`);
  console.log(`  Android: AAB → sign → Play Store Internal Testing`);
  console.log(`  Web    : Vercel production (already on main)\n`);

  const confirm = await ask(`Type "${version}" to confirm, or anything else to abort: `);
  rl.close();

  if (confirm.trim() !== version) {
    console.log('\nAborted — nothing was pushed.\n');
    process.exit(0);
  }

  console.log('\n── Tagging ───────────────────────────────');
  run(`git tag ${tag}`);

  console.log('\n── Pushing tag ───────────────────────────');
  run(`git push origin ${tag}`);

  console.log(`\n✓  ${tag} is live. Pipelines now running:\n`);
  console.log(`   ${REPO}\n`);
}

main().catch((err) => {
  console.error(`\n✗  ${err.message}\n`);
  process.exit(1);
});
