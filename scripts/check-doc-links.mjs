import fs from 'node:fs';
import path from 'node:path';

const roots = ['README.md', 'CONTRIBUTING.md', 'docs'];
const files = [];
const collect = (entry) => {
  if (!fs.existsSync(entry)) return;
  if (fs.statSync(entry).isDirectory()) {
    for (const child of fs.readdirSync(entry)) collect(path.join(entry, child));
  } else if (entry.endsWith('.md')) files.push(entry);
};
roots.forEach(collect);

const headings = (file) => new Set(fs.readFileSync(file, 'utf8').split('\n')
  .filter((line) => /^#{1,6}\s+/.test(line))
  .map((line) => line.replace(/^#{1,6}\s+/, '').toLowerCase()
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')));

const errors = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#|data:)/i.test(target)) continue;
    if (/^(?:\.\.\/)+issues\//.test(target)) continue;
    const [rawPath, fragment] = target.split('#');
    const resolved = path.resolve(path.dirname(file), rawPath || path.basename(file));
    if (!fs.existsSync(resolved)) {
      errors.push(`${file}: missing target ${target}`);
    } else if (fragment && resolved.endsWith('.md') && !headings(resolved).has(fragment.toLowerCase())) {
      errors.push(`${file}: missing fragment ${target}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} Markdown files: all local links resolve.`);
}
