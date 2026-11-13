// Assembles the documentation site in _site for GitHub Pages (workflow docs.yml) or a local preview.
// Docs keep their repository paths, so relative links between them work the same as on GitHub;
// docsify renders the Markdown in the browser, so there is no build step and no dependency.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const shell = dirname(fileURLToPath(import.meta.url));
const root = join(shell, '..', '..');
const out = join(root, '_site');

/** "owner/name" of the GitHub repository: links to source files open there. */
function githubRepo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execSync('git config --get remote.origin.url', { cwd: root }).toString().trim();
    return /github\.com[:/](.+?)(?:\.git)?$/.exec(url)?.[1] ?? '';
  } catch {
    return '';
  }
}

/** First "# " heading of a Markdown file, or its name. */
function title(file, fallback) {
  const heading = /^# (.+)$/m.exec(readFileSync(file, 'utf8'));
  return heading ? heading[1].trim() : fallback;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const rootDocs = readdirSync(root).filter((name) => name.endsWith('.md'));
for (const name of rootDocs) cpSync(join(root, name), join(out, name));
cpSync(join(root, 'docs'), join(out, 'docs'), {
  recursive: true,
  filter: (src) => src !== shell && !src.startsWith(shell + sep),
});
cpSync(join(root, 'design', 'sample'), join(out, 'design', 'sample'), { recursive: true });

// The sidebar is generated so that a new brief in docs/tasks appears without editing anything here.
const main = [
  ['README.md', 'О проекте'],
  ['TZ.md', 'Техническое задание'],
  ['ARCHITECTURE.md', 'Архитектура'],
  ['DESIGN_SYSTEM.md', 'Дизайн-система'],
  ['IMPLEMENTATION_PLAN.md', 'План реализации'],
  ['CLAUDE.md', 'Правила для Claude'],
].filter(([name]) => rootDocs.includes(name));
const otherDocs = readdirSync(join(root, 'docs')).filter((name) => name.endsWith('.md'));
const briefs = readdirSync(join(root, 'docs', 'tasks'))
  .filter((name) => /^T-\d+.*\.md$/.test(name))
  .sort((a, b) => Number(/\d+/.exec(a)[0]) - Number(/\d+/.exec(b)[0]));

const sidebar = [
  '- Документы',
  ...main.map(([name, text]) => `  - [${text}](/${name})`),
  ...otherDocs.map((name) => `  - [${title(join(root, 'docs', name), name)}](/docs/${name})`),
  '- Брифы задач',
  '  - [Регламент](/docs/tasks/README.md)',
  ...briefs.map(
    (name) => `  - [${title(join(root, 'docs', 'tasks', name), name)}](/docs/tasks/${name})`,
  ),
  '- Дизайн',
  // A plain page, not a docsify route: data-nosearch keeps the search plugin from indexing it.
  '  - <a href="design/sample/Дарси-онлайн.html" target="_blank" data-nosearch>Прототип интерфейса</a>',
];
writeFileSync(join(out, '_sidebar.md'), sidebar.join('\n') + '\n');

const page = readFileSync(join(shell, 'index.html'), 'utf8').replace('__REPO__', githubRepo());
writeFileSync(join(out, 'index.html'), page);
// Without it GitHub Pages runs Jekyll, which skips files starting with "_" such as _sidebar.md.
writeFileSync(join(out, '.nojekyll'), '');

console.log(`Docs site: ${out} (${rootDocs.length} root docs, ${briefs.length} briefs)`);
