import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
const candidates = ['package.json','package-lock.json','bun.lock','pnpm-lock.yaml','src-tauri/Cargo.lock'];
const hashes = Object.fromEntries(candidates.filter(existsSync).map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
mkdirSync('security-evidence', { recursive: true });
writeFileSync('security-evidence/build-identity.json', JSON.stringify({
  commit: execFileSync('git', ['rev-parse','HEAD'], { encoding:'utf8' }).trim(),
  repository: process.env.GITHUB_REPOSITORY ?? null,
  run: process.env.GITHUB_RUN_ID ?? null,
  attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  workflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
  node: process.version, lockfiles: hashes,
}, null, 2) + String.fromCharCode(10));
