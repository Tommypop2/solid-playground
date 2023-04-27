const resolveFileFromURL = async (url: string) => {
  try {
    const typesResult = await fetch(url);
    if (typesResult.status != 200) return;
    visited.push(url);
    return await typesResult.text();
  } catch (e) {
    return;
  }
};
// Regex below taken from https://gist.github.com/manekinekko/7e58a17bc62a9be47172 and then slightly modified
const re = /(import|export)(?:[\s.*]([\w*{}\n\r\t, ]+)[\s*]from)?[\s*](?:["'](.*[\w]+)["'])?/gm;
let visited: string[] = [];
let depth = 0;
let maxDepth = 3;
const resolveUrl = (base: string, path: string) => {
  const url = new URL(path, base);
  let newUrl = url.toString() + '.d.ts';
  return newUrl;
};
export type ExternalModule = { name: string; contents: string };
const resolveInternalTypes: (name: string, typesUrl: string) => Promise<ExternalModule[] | undefined> = async (
  name: string,
  typesUrl: string,
) => {
  if (visited.indexOf(typesUrl) != -1) return [];
  if (depth >= maxDepth) return [];
  depth += 1;
  // Get contents of file
  const typesDefContents = await resolveFileFromURL(typesUrl);
  if (!typesDefContents) return [];
  // Get imports/exports
  let matches: string[] = [];
  for (const match of typesDefContents.matchAll(re)) {
    const name = match[3];
    if (!name) continue;
    matches.push(name);
  }
  // Base case
  if (matches.length == 0) return [{ name: name, contents: typesDefContents } as ExternalModule];
  let resolved: ExternalModule[] = [{ name: name, contents: typesDefContents }];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const newUrl = resolveUrl(typesUrl, match);
    const res = await resolveInternalTypes(match.replace('./', 'voby/'), newUrl);
    depth -= 1;
    if (!res) continue;
    resolved.push(...res);
  }
  // console.log(resolved);
  return resolved;
};

export const resolveTypes = async (name: string) => {
  depth = 0;
  const result = await fetch(`https://unpkg.com/${name}/package.json`);
  if (result.status != 200) return;
  const packageJson = await result.json();
  const typesLocation: string | undefined = packageJson['types'];
  if (!typesLocation) return;
  const resolved = await resolveInternalTypes(name, `https://unpkg.com/${name}/${typesLocation.substring(2)}`);
  return resolved;
  // if (!typesLocation) return;
  // let typesStr = '';
  // if (typesLocation.startsWith('./')) {
  //   const resolvedTypes = await resolveFileFromURL(`https://unpkg.com/${importName}/${typesLocation.substring(2)}`);
  //   if (!resolvedTypes) return;
  //   typesStr = resolvedTypes;
  // }
  // return { name: importName, contents: typesStr };
};
