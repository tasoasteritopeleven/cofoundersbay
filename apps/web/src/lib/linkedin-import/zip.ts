/**
 * Reads named files out of a ZIP in the browser, with no dependency: the
 * central directory is parsed by hand and deflated entries go through the
 * platform's `DecompressionStream('deflate-raw')`. Enough for LinkedIn's data
 * export (plain ZIP, no ZIP64, no encryption); anything else is skipped.
 */

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
export const ZIP_ENTRY_LIMIT = 5 * 1024 * 1024;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const stream = source.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The entries whose path `want` accepts, decoded as UTF-8 text. */
export async function readZipText(buffer: ArrayBuffer, want: (path: string) => boolean): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file');
  const entries = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');
  const out: Record<string, string> = {};
  for (let n = 0; n < entries && at + 46 <= bytes.length; n++) {
    if (view.getUint32(at, true) !== CENTRAL) break;
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (!want(name) || size > ZIP_ENTRY_LIMIT || view.getUint32(localAt, true) !== LOCAL) continue;
    const dataAt = localAt + 30 + view.getUint16(localAt + 26, true) + view.getUint16(localAt + 28, true);
    const raw = bytes.subarray(dataAt, dataAt + compressed);
    if (method === 0) out[name] = decoder.decode(raw);
    else if (method === 8) out[name] = decoder.decode(await inflateRaw(raw));
  }
  return out;
}
