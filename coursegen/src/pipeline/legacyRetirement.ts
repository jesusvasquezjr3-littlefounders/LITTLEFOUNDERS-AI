/** Legacy authoring cannot spend or recreate retired schema-1 content. */
export function refuseLegacyAuthoring(): void {
  throw new Error('Legacy lesson generation and publication are retired. Use v2:author and v2:publish instead.');
}
