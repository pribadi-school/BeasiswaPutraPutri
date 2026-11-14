/**
 * Build aplikasi lalu terbitkan hasilnya ke branch `deploy` di GitHub.
 * Di server (cPanel), ~/repositories/beasiswa adalah clone branch itu:
 *   cd ~/repositories/beasiswa && git pull && bash deploy.sh
 *
 * Biasanya dijalankan otomatis oleh GitHub Actions setiap push ke main
 * (.github/workflows/deploy.yml). Manual: npm run deploy
 *
 * Branch `deploy` sengaja berhistori lurus (tidak pernah force-push), karena
 * server memakai `git pull` biasa. Isinya tanpa rahasia apa pun.
 */
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRANCH = 'deploy';
const SERVER_CMD = 'cd ~/repositories/beasiswa && git pull && bash deploy.sh';

const git = (args: string[], cwd = '.') => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function fail(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (git(['status', '--porcelain'])) fail('Masih ada perubahan yang belum di-commit. Commit (dan push) dulu agar server sama dengan GitHub.');

const sha = git(['rev-parse', '--short', 'HEAD']);
const subject = git(['log', '-1', '--format=%s']);

execSync('npm run build', { stdio: 'inherit' });
execSync('npm run package', { stdio: 'inherit' }); // → folder deploy/

const hasRemote = git(['ls-remote', '--heads', 'origin', BRANCH]) !== '';
if (hasRemote) git(['fetch', 'origin', BRANCH]);

const dir = mkdtempSync(join(tmpdir(), 'beasiswa-deploy-'));
try {
  git(hasRemote ? ['worktree', 'add', '-B', BRANCH, dir, `origin/${BRANCH}`] : ['worktree', 'add', '--orphan', '-b', BRANCH, dir]);
  // Ganti seluruh isi dengan build baru (file .git milik worktree tetap).
  for (const f of readdirSync(dir)) if (f !== '.git') rmSync(join(dir, f), { recursive: true, force: true });
  cpSync('deploy', dir, { recursive: true });

  git(['add', '-A'], dir);
  if (!git(['status', '--porcelain'], dir)) {
    console.log(`\nTidak ada perubahan — branch ${BRANCH} sudah berisi build ini.\n`);
  } else {
    git(['commit', '-m', `Build ${sha}: ${subject}`], dir);
    execFileSync('git', ['push', 'origin', BRANCH], { cwd: dir, stdio: 'inherit' });
    console.log(`\n✓ Build ${sha} dikirim ke branch ${BRANCH}.`);
    console.log('  Lalu di cPanel → Terminal:');
    console.log(`  ${SERVER_CMD}\n`);
  }
} finally {
  git(['worktree', 'remove', '--force', dir]);
}
