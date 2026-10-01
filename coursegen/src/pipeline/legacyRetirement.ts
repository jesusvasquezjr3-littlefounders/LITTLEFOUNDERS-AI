/** OD-31: legacy authoring cannot spend or recreate retired schema-1 content. */
export function refuseLegacyAuthoring(): void {
  throw new Error('Legacy lesson generation and publication are retired. Use v2:author and v2:publish with docs/content/FORGE-V2-RELEASE.md.');
}
