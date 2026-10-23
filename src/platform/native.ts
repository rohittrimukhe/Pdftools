import type { SaveAdapter } from './save';
import type { Runtime } from './runtime';

/** Folder the phone apps save into, inside the public Documents folder. */
export const PHONE_FOLDER = 'Happy PDF';

/** Base64 without the "data:...;base64," prefix, as the Capacitor file plugin expects. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file'));
    reader.readAsDataURL(blob);
  });
}

/** "report.pdf" in a folder that already has one becomes "report (2).pdf", and so on. */
export function nextFreeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const extensionOf = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

/** Desktop: the system "Save as" dialog, then a write to the path the person picked. */
async function desktopAdapter(): Promise<SaveAdapter> {
  const [{ save }, { writeFile }] = await Promise.all([import('@tauri-apps/plugin-dialog'), import('@tauri-apps/plugin-fs')]);
  return {
    async save(blob, name) {
      const ext = extensionOf(name);
      const path = await save({ defaultPath: name, filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : [] });
      if (!path) return { status: 'cancelled' };
      await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
      return { status: 'saved' };
    },
  };
}

/** Android and iOS: save into Documents/Happy PDF; share through the system share sheet. */
async function phoneAdapter(runtime: 'android' | 'ios'): Promise<SaveAdapter> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  return {
    async save(blob, name) {
      if (runtime === 'android') await Filesystem.requestPermissions().catch(() => undefined);
      const existing = await Filesystem.readdir({ path: PHONE_FOLDER, directory: Directory.Documents })
        .then((r) => new Set(r.files.map((f) => f.name)), () => new Set<string>());
      const finalName = nextFreeName(name, existing);
      await Filesystem.writeFile({
        path: `${PHONE_FOLDER}/${finalName}`,
        data: await blobToBase64(blob),
        directory: Directory.Documents,
        recursive: true,
      });
      // iOS lists the app's Documents folder in Files under "On My iPhone > Happy PDF".
      return { status: 'saved', where: runtime === 'ios' ? `Files › ${PHONE_FOLDER}` : `Documents/${PHONE_FOLDER}` };
    },
    async share(blob, name) {
      // The app receiving the file may read it after share() returns, so last time's copy is cleared now instead.
      await Filesystem.rmdir({ path: 'share', directory: Directory.Cache, recursive: true }).catch(() => undefined);
      const { uri } = await Filesystem.writeFile({ path: `share/${name}`, data: await blobToBase64(blob), directory: Directory.Cache, recursive: true });
      try {
        await Share.share({ title: name, files: [uri] });
        return 'shared';
      } catch (error) {
        if (error instanceof Error && /cancel/i.test(error.message)) return 'cancelled';
        throw error;
      }
    },
  };
}

/** Swaps the browser download for the native save of the shell the app is running in. */
export async function installNativeSave(runtime: Runtime) {
  if (runtime === 'web') return;
  const { setSaveAdapter } = await import('./save');
  setSaveAdapter(runtime === 'desktop' ? await desktopAdapter() : await phoneAdapter(runtime));
}

/** Android's back button walks back through the app, and leaves it from the first screen. */
export async function installBackButton(runtime: Runtime, canGoBack: () => boolean) {
  if (runtime !== 'android') return;
  const { App } = await import('@capacitor/app');
  await App.addListener('backButton', () => {
    if (canGoBack()) window.history.back();
    else void App.exitApp();
  });
}
