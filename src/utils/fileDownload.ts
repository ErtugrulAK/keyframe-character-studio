/** One way to hand bytes to the user, shared by every export in the header. */
export const downloadBlob = (bytes: Uint8Array, fileName: string, mimeType: string): void => {
  // `BlobPart` is narrowed to ArrayBuffer-backed views; every caller hands over a
  // plain `Uint8Array`, and the cast avoids copying the payload to satisfy it.
  const blob = new Blob([bytes as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  // Appended before the click: a detached anchor is ignored by some browsers.
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
