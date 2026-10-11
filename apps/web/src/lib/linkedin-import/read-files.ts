import { fromLinkedInExport, linkedInFileKind, type LinkedInImport } from '@cofounderbay/shared';
import { readZipText } from './zip';

/** `File.arrayBuffer` where it exists, `FileReader` where it does not (older engines, jsdom). */
function bufferOf(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

async function textOf(file: File): Promise<string> {
  return new TextDecoder('utf-8').decode(await bufferOf(file));
}

/**
 * Turns what the person picked (the export ZIP, or its CSV files) into one
 * import. Runs entirely in the browser: nothing is uploaded, and only the
 * four files a profile uses are opened.
 */
export async function readLinkedInFiles(files: readonly File[]): Promise<LinkedInImport> {
  const texts: Record<string, string> = {};
  for (const file of files) {
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
      Object.assign(texts, await readZipText(await bufferOf(file), (path) => linkedInFileKind(path) !== null));
    } else if (linkedInFileKind(file.name)) {
      texts[file.name] = await textOf(file);
    }
  }
  return fromLinkedInExport(texts);
}
