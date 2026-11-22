// Line icons for the photo card and cropper, drawn like the kit's (src/components/ui/icons.tsx: a 24 px grid,
// 1.8 stroke in the text's colour). Kept here so the photo work doesn't edit the shared kit while other steps
// are in flight; they can move into the kit's set later. Decorative: the control holding one carries the words.

const PATHS = {
  camera: (
    <>
      <path d="M4 7.5h3l1.6-2.3a1 1 0 0 1 .8-.4h5.2a1 1 0 0 1 .8.4L17 7.5h3a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  crop: <path d="M6 2.5V16a2 2 0 0 0 2 2h13.5M2.5 6H16a2 2 0 0 1 2 2v13.5" />,
  rotate: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
      <path d="M20.5 3.5V8H16" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20.5 20.5-5.4-5.4M10.5 7.5v6M7.5 10.5h6" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20.5 20.5-5.4-5.4M7.5 10.5h6" />
    </>
  ),
  reset: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" />
      <path d="M3.5 3.5V8H8" />
    </>
  ),
  swap: (
    <>
      <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
    </>
  ),
  gallery: (
    <>
      <rect x="7.5" y="3" width="13.5" height="13.5" rx="2" />
      <path d="M4.5 7.5v10a3 3 0 0 0 3 3h10M10.5 12.8l2.3-2.3a1.2 1.2 0 0 1 1.7 0l3 3M12.2 7.3h.01" />
    </>
  ),
  chart: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 3.5l17 17M20.5 3.5l-17 17M12 3.5v17M3.5 12h17" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20.5c.7-4 3.7-6.3 7.5-6.3s6.8 2.3 7.5 6.3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3v1.8M12 19.2V21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M3 12h1.8M19.2 12H21M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
    </>
  ),
  frame: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  face: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.8 14.5a4.2 4.2 0 0 0 6.4 0M9.2 9.7h.01M14.8 9.7h.01" />
    </>
  ),
};

export type PhotoIconName = keyof typeof PATHS;

export function PhotoIcon({ name, className = "size-5" }: { name: PhotoIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}
