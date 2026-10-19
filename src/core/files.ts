// Read a file's bytes. In an exported game (step 13) files are packed into the page as "data:" text,
// which is decoded here directly so it also works where the page may not fetch anything.
export async function readBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith('data:')) {
    const text = atob(url.slice(url.indexOf(',') + 1));
    return Uint8Array.from(text, (c) => c.charCodeAt(0)).buffer;
  }
  return (await fetch(url)).arrayBuffer();
}
