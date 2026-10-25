/**
 * Opens the system file picker. Resolves with [] when the user cancels.
 * `capture` opens the camera directly on phones ("environment": the back camera).
 */
export function pickFiles({ accept = '', multiple = true, capture }: { accept?: string; multiple?: boolean; capture?: 'environment' | 'user' } = {}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (capture) input.setAttribute('capture', capture);
    input.style.display = 'none';
    let done = false;
    const finish = (files: File[]) => { if (done) return; done = true; input.remove(); resolve(files); };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    document.body.append(input);
    input.click();
  });
}
