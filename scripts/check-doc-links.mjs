import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

function markdownFiles(root) {
  const files = readdirSync(root)
    .filter((name) => /^README.*\.md$/i.test(name) || name === "CONTRIBUTING.md")
    .map((name) => join(root, name));

  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
    }
  }

  visit(join(root, "docs"));
  return files.sort();
}

function contentLines(file) {
  let fence;
  return readFileSync(file, "utf8").split(/\r?\n/).map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return "";
    }
    return fence ? "" : line;
  });
}

function headingSlugs(file) {
  const used = new Map();
  const slugs = new Set();
  for (const line of contentLines(file)) {
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const plain = heading[1]
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/[*_~`]/g, "");
    const slug = plain.toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, "")
      .trim().replace(/\s+/g, "-");
    const duplicate = used.get(slug) ?? 0;
    slugs.add(duplicate ? `${slug}-${duplicate}` : slug);
    used.set(slug, duplicate + 1);
  }
  return slugs;
}

function destinations(line) {
  const links = [];
  line = line.replace(/(`+)(.*?)\1/g, (match) => " ".repeat(match.length));
  const definition = line.match(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/);
  if (definition) links.push(definition[1]);

  for (let index = 0; index < line.length - 1; index++) {
    if (line[index] !== "]" || line[index + 1] !== "(") continue;
    let depth = 1;
    let end = index + 2;
    for (; end < line.length; end++) {
      if (line[end] === "\\") { end++; continue; }
      if (line[end] === "(") depth++;
      if (line[end] === ")" && --depth === 0) break;
    }
    if (depth !== 0) continue;
    const inside = line.slice(index + 2, end).trim();
    const target = inside.startsWith("<")
      ? inside.match(/^<([^>]+)>/)?.[1]
      : inside.match(/^\S+/)?.[0];
    if (target) links.push(target);
    index = end;
  }
  return links;
}

export function checkDocs(root) {
  const files = markdownFiles(root);
  const errors = [];
  const slugCache = new Map();
  let checkedLinks = 0;

  for (const source of files) {
    contentLines(source).forEach((line, index) => {
      for (const raw of destinations(line)) {
        if (/^(?:[a-z][a-z\d+.-]*:|\/|\?)/i.test(raw)) continue;
        const [rawPath, rawFragment = ""] = raw.split("#", 2);
        let pathname, fragment;
        try {
          pathname = decodeURIComponent(rawPath.replace(/\\([()])/g, "$1"));
          fragment = decodeURIComponent(rawFragment);
        } catch {
          errors.push(`${relative(root, source)}:${index + 1}: invalid URL encoding in ${raw}`);
          continue;
        }
        const target = pathname ? resolve(dirname(source), pathname) : source;
        const display = relative(root, source).split(sep).join("/");
        checkedLinks++;
        if (isAbsolute(pathname) || relative(root, target).startsWith(`..${sep}`) || relative(root, target) === "..") {
          errors.push(`${display}:${index + 1}: local link leaves the repository: ${raw}`);
        } else if (!existsSync(target)) {
          errors.push(`${display}:${index + 1}: missing local target: ${raw}`);
        } else if (fragment) {
          const headingFile = statSync(target).isDirectory() ? join(target, "README.md") : target;
          if (extname(headingFile).toLowerCase() !== ".md" || !existsSync(headingFile)) continue;
          if (!slugCache.has(headingFile)) slugCache.set(headingFile, headingSlugs(headingFile));
          if (!slugCache.get(headingFile).has(fragment.toLowerCase())) {
            errors.push(`${display}:${index + 1}: missing heading #${fragment} in ${relative(root, headingFile).split(sep).join("/")}`);
          }
        }
      }
    });
  }
  return { files: files.length, checkedLinks, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2]
    ? resolve(process.argv[2])
    : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = checkDocs(root);
  if (result.errors.length) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
  } else {
    console.log(`Checked ${result.checkedLinks} local links in ${result.files} Markdown files.`);
  }
}
