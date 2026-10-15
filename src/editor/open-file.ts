import { ed, openScene, inspectFile } from './state';
import { openScript } from './script-editor';

/** Double-click on a file anywhere (file dock, graph, previews): scenes open in their view, text in the script editor, the rest in the inspector preview. */
export async function openFile(path: string) {
  if (path.endsWith('.scene.json')) { await openScene(path); if (ed.inspectFile === path) inspectFile(''); }
  else if (/\.(m?js|json|md|txt|css)$/i.test(path)) await openScript(path);
  else inspectFile(path);
}
