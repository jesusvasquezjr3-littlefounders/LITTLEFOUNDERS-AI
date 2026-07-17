/*
 * Client for the filebase (Filebase) internal upload contract:
 *   POST {FILEBASE_URL}/api/v1/files  multipart(file, bucket, visibility)
 *   header: x-internal-api-key: {FILEBASE_INTERNAL_KEY}
 *   → { data: { id: '<bucket>/<sha256>.<ext>', url, bytes, mime, deduplicated } }
 * Public GET at {FILEBASE_URL}/files/<id>.
 *
 * NOTE: filebase source is intentionally NOT read/modified here — this
 * module codes strictly against the contract above (confirmed FINISHED,
 * header corrected to x-internal-api-key).
 */

export class FilebaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilebaseError';
  }
}

export interface FilebaseUploadResult {
  id: string;
  url: string;
  bytes: number;
  mime: string;
  deduplicated: boolean;
}

export interface FilebaseClientOptions {
  filebaseUrl: string;
  internalKey: string;
  fetchImpl?: typeof fetch;
}

export type Visibility = 'public' | 'internal';

export async function uploadFile(
  bytes: Buffer,
  filename: string,
  mime: string,
  bucket: string,
  visibility: Visibility,
  opts: FilebaseClientOptions,
): Promise<FilebaseUploadResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;

  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), filename);
  form.set('bucket', bucket);
  form.set('visibility', visibility);

  let res: Response;
  try {
    res = await fetchImpl(`${opts.filebaseUrl}/api/v1/files`, {
      method: 'POST',
      headers: { 'x-internal-api-key': opts.internalKey },
      body: form,
    });
  } catch (err) {
    throw new FilebaseError(`Filebase upload request failed: ${String(err)}`);
  }

  const json = (await res.json().catch(() => null)) as { data?: FilebaseUploadResult; error?: { message?: string } } | null;
  if (!res.ok || !json?.data) {
    throw new FilebaseError(`Filebase upload failed (${res.status}): ${json?.error?.message ?? 'no data in response'}`);
  }
  return json.data;
}
