let visited: string[] = [];
const resolveFileFromURL = async (url: string) => {
  if (visited.indexOf(url) != -1) return;
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
const dynamicImport = /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s].*([@\w_-]+)["'\s].*\)/gm;
const resolveUrl = (base: string, path: string) => {
  const url = new URL(path, base);
  let newUrl = url.toString();
  return newUrl;
};
export type ExternalModule = { name: string; contents: string };
const resolveInternalTypes: (
  moduleName: string,
  name: string,
  typesUrl: string,
) => Promise<ExternalModule[] | undefined> = async (moduleName: string, name: string, typesUrl: string) => {
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
  for (const match of typesDefContents.matchAll(dynamicImport)) {
    const modName = match[0].replace('import(', '').slice(1, -2);
    matches.push(modName);
  }
  // Base case
  if (matches.length == 0) return [{ name: name, contents: typesDefContents } as ExternalModule];
  let resolved: ExternalModule[] = [{ name: name, contents: typesDefContents }];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const newUrl = resolveUrl(typesUrl, match);
    const urlPath = newUrl.split('/');
    const filePath = urlPath.slice(urlPath.indexOf('dist') + 1).join('/');
    console.log(filePath);
    const res = await resolveInternalTypes(
      moduleName,
      `${moduleName}/${filePath}`,
      newUrl,
    );
    if (!res) continue;
    resolved.push(...res);
  }
  // console.log(resolved);
  return resolved;
};

export const resolveTypes = async (name: string) => {
  const result = await fetch(`https://esm.sh/${name}/package.json`);
  if (result.status != 200) return;
  const packageJson = await result.json();
  const typesLocation: string | undefined = packageJson['types'];
  if (!typesLocation) return;
  console.log('Starting Resolution');
  const resolved = await resolveInternalTypes(
    `@types/${name}`,
    `@types/${name}/index.d.ts`,
    `https://esm.sh/${name}/${typesLocation.substring(2)}`,
  );
  console.log('yes');
  return resolved;
};
