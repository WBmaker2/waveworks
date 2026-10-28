export type IconName =
  | 'wave'
  | 'sine'
  | 'square'
  | 'saw'
  | 'triangle'
  | 'layers'
  | 'piano'
  | 'grid'
  | 'target'
  | 'sliders'
  | 'play'
  | 'stop'
  | 'trash'
  | 'volume'
  | 'headphones'
  | 'reset'
  | 'arrowRight'
  | 'check'
  | 'close'
  | 'spark'
  | 'metronome'
  | 'speakerOff';

const paths: Record<IconName, string> = {
  wave: '<path d="M2 12c3.2-7 5.8-7 9 0s5.8 7 9 0"/><path d="M2 16.5h20" opacity=".3"/>',
  sine: '<path d="M2 12c3.2-7 5.8-7 9 0s5.8 7 9 0"/>',
  square: '<path d="M2 16V8h6.7v8h6.6V8H22v8"/>',
  saw: '<path d="M2 16l6.7-8v8L15.4 8v8L22 8v8"/>',
  triangle: '<path d="M2 16l5-8 5 8 5-8 5 8"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/>',
  piano:
    '<rect x="3" y="4" width="18" height="16" rx="0"/><path d="M8 4v10M12 4v10M16 4v10"/><path d="M3 14h18"/>',
  grid: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16M15 4v16M3 10h18M3 16h18"/>',
  target:
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  sliders:
    '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>',
  stop: '<rect x="6" y="6" width="12" height="12"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  volume:
    '<path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  headphones:
    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="7"/><rect x="17" y="13" width="4" height="7"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.3-5.6L4 8.7"/><path d="M4 4v4.7h4.7"/>',
  arrowRight: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  spark:
    '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5 19 19M19 5l-3.5 3.5M8.5 15.5 5 19"/>',
  metronome: '<path d="M9 21h6M10 3h4l4 18H6L10 3Z"/><path d="m12 16 4-9"/>',
  speakerOff: '<path d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
};

export function icon(name: IconName, size = 20, className = ''): string {
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}
