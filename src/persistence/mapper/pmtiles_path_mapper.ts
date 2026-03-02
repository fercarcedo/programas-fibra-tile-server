export const resolvePmtilesArchivePath = (
  name: string,
  setting?: string
): string => {
  if (setting) return setting.replaceAll("{name}", name);
  return `${name}.pmtiles`;
};
