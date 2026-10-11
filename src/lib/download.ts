/**
 * Saves a blob as a file. The CSV export cannot be a plain link, because the
 * request needs the bearer token in a header; so the file is fetched first and
 * handed to the browser from memory.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
