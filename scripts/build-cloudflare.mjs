import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.cloudflare-public');
const workerOutput = path.join(root, '.cloudflare-worker-public');
const files = [
  'index.html', 'app.js', 'styles.css', 'manifest.webmanifest', 'service-worker.js',
  'aluno.html', 'student-fast.js', 'autorizar.html', 'authorize-fast.js',
  'public.css', 'public-theme.js'
];

function copyPublicFiles(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(root, file), path.join(target, file));
  fs.cpSync(path.join(root, 'assets'), path.join(target, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(target, 'aluno'), { recursive: true });
  fs.copyFileSync(path.join(root, 'aluno.html'), path.join(target, 'aluno', 'index.html'));
  fs.mkdirSync(path.join(target, 'autorizar'), { recursive: true });
  fs.copyFileSync(path.join(root, 'autorizar.html'), path.join(target, 'autorizar', 'index.html'));
}

copyPublicFiles(output);
copyPublicFiles(workerOutput);
fs.copyFileSync(path.join(root, 'worker', 'index.js'), path.join(output, '_worker.js'));
console.log(`Cloudflare assets ready: ${files.length} files`);
