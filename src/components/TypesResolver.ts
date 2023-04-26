export const resolveTypes = async (importName: string) => {
  const result = await fetch(`https://unpkg.com/${importName}/package.json`);
  if (result.status != 200) return;
  const packageJson = await result.json();
  const typesLocation: string | undefined = packageJson['types'];
  if (!typesLocation) return;
  let typesStr = '';
  if (typesLocation.startsWith('./')) {
    const typesResult = await fetch(`https://unpkg.com/${importName}/${typesLocation.substring(2)}`);
    if (typesResult.status != 200) return;
    typesStr = await typesResult.text();
  }
  return { name: importName, contents: typesStr };
};
