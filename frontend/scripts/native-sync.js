#!/usr/bin/env node
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const IOS_DIR = path.join(ROOT, 'ios', 'App', 'App');

const GUARDED_FILES = [
  { dest: path.join(IOS_DIR, 'PrivacyInfo.xcprivacy') },
  { dest: path.join(IOS_DIR, 'App.entitlements') },
];

// Snapshot guarded files before sync
const snapshots = {};
for (const { dest } of GUARDED_FILES) {
  if (fs.existsSync(dest)) {
    snapshots[dest] = fs.readFileSync(dest);
    console.log(`  ✓ Snapshotted: ${path.basename(dest)}`);
  }
}

// Run cap sync
console.log('→ Running cap sync ios...');
try {
  execSync('npx cap sync ios', { stdio: 'inherit', cwd: ROOT });
} catch (err) {
  console.error('  ✗ cap sync ios failed');
  process.exit(1);
}

// Restore any missing guarded files
for (const { dest } of GUARDED_FILES) {
  if (!fs.existsSync(dest)) {
    const snapshot = snapshots[dest];
    if (snapshot) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, snapshot);
      console.log(`  ✓ Restored: ${path.basename(dest)}`);
    } else {
      console.error(`  ✗ ${path.basename(dest)} missing and no snapshot. Aborting.`);
      process.exit(1);
    }
  } else {
    console.log(`  ✓ Present: ${path.basename(dest)}`);
  }
}

console.log('✅ native-sync complete.');
