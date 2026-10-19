// Small pictures that tell file types apart at a glance (same idea as file icons in Windows Explorer).

export type FileType = 'folder' | 'prefab' | 'image' | 'sound' | 'scene';

export const TYPE_LABEL: Record<FileType, string> = {
  folder: '폴더', prefab: '프리팹', image: '그림', sound: '소리', scene: '장면',
};

const SHAPES: Record<FileType, string> = {
  folder: '<path d="M1.5 4.5h5l1.5 1.5h6.5v7.5h-13z" fill="#e8b84a"/><path d="M1.5 6.5h13v7h-13z" fill="#f5cd6a"/>',
  prefab: '<path d="M8 1.5l6 3v7l-6 3-6-3v-7z" fill="#3d7fd9"/><path d="M8 1.5l6 3-6 3-6-3z" fill="#7fb4ff"/><path d="M8 7.5v7l6-3v-7z" fill="#5a9bf0"/>',
  image: '<rect x="1.5" y="2.5" width="13" height="11" rx="1" fill="#2f8f4e"/><path d="M2.5 12.5l4-5 3 3.5 2-2 2 3.5z" fill="#b6f0a8"/><circle cx="11" cy="5.5" r="1.4" fill="#ffe680"/>',
  sound: '<path d="M2 6h3l4-3.5v11L5 10H2z" fill="#f08c3a"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" stroke="#f8b27a" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  scene: '<rect x="1.5" y="5.5" width="13" height="9" rx="1" fill="#8a5cd6"/><path d="M1.5 2.5l12.5-1 .5 3-12.5 1z" fill="#c9a8ff"/><path d="M4 2.3l1.6 2.8M7.5 2l1.6 2.8M11 1.7l1.6 2.8" stroke="#5b3a99" stroke-width="1.2"/>',
};

/** Extra pictures for the object list: an empty object (only groups others) and a text object. */
const OBJECT_SHAPES = {
  empty: '<path d="M8 1.5l6 3v7l-6 3-6-3v-7z" fill="none" stroke="#9aa3b8" stroke-width="1.2" stroke-dasharray="2 1.6"/>',
  text: '<rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="#4b5170"/><path d="M4.5 4.8h7M8 4.8v7" stroke="#fff" stroke-width="1.8"/>',
};

export type IconName = FileType | keyof typeof OBJECT_SHAPES;

/** A file-type picture as an inline SVG element. */
export function typeIcon(type: IconName, size = 16): SVGSVGElement {
  const wrap = document.createElement('span');
  wrap.innerHTML = `<svg class="ed-icon" width="${size}" height="${size}" viewBox="0 0 16 16">${type in SHAPES ? SHAPES[type as FileType] : OBJECT_SHAPES[type as keyof typeof OBJECT_SHAPES]}</svg>`;
  return wrap.firstElementChild as SVGSVGElement;
}
