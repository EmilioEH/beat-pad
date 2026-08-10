/* ═══════════════════════════════════════════════════════════════
   ICONS

   One set, one grid, one stroke weight. Emoji were doing this job
   and doing it badly: a photoreal broom next to a flat red no-entry
   sign next to knobs too dark to read, all drawn by different people
   — and all rendered differently on every operating system, so the
   app never looked the same twice.

   Emoji stay where they are content rather than chrome: the pads and
   the pack chips. Those carry the character. Buttons carry meaning,
   and meaning should be legible and consistent.

   Everything is a 24×24 viewBox, 2.4 stroke, round caps and joins,
   currentColor. Chunky enough to read at 20px on a phone and to stay
   friendly rather than corporate.
   ═══════════════════════════════════════════════════════════════ */

const ICONS = {
  play:   '<path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.5-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" fill="currentColor" stroke="none"/>',

  pause:  '<rect x="6.5" y="5" width="4.2" height="14" rx="2.1" fill="currentColor" stroke="none"/>' +
          '<rect x="13.3" y="5" width="4.2" height="14" rx="2.1" fill="currentColor" stroke="none"/>',

  // The loop recorder. A record dot, not a second microphone — two mics
  // meaning two different things was the confusion worth removing.
  record: '<circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/>',

  // Surprise me. A die reads as "chance" to a child who cannot read.
  dice:   '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.4"/>' +
          '<circle cx="8.6" cy="8.6" r="1.5" fill="currentColor" stroke="none"/>' +
          '<circle cx="15.4" cy="15.4" r="1.5" fill="currentColor" stroke="none"/>' +
          '<circle cx="15.4" cy="8.6" r="1.5" fill="currentColor" stroke="none"/>' +
          '<circle cx="8.6" cy="15.4" r="1.5" fill="currentColor" stroke="none"/>',

  // Turn a sound off. A speaker losing its waves, not a prohibition sign.
  mute:   '<path d="M4 9.4h3.4L12 5.6v12.8L7.4 14.6H4a1 1 0 0 1-1-1V10.4a1 1 0 0 1 1-1Z"/>' +
          '<path d="m16.2 9.8 4.4 4.4M20.6 9.8l-4.4 4.4"/>',

  sound:  '<path d="M4 9.4h3.4L12 5.6v12.8L7.4 14.6H4a1 1 0 0 1-1-1V10.4a1 1 0 0 1 1-1Z"/>' +
          '<path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.4 6.6a7.6 7.6 0 0 1 0 10.8"/>',

  // The step grid, drawn as what it opens: two rows of steps, some on.
  // All filled — outlined circles at this size overlap once the stroke is
  // counted, which turned the icon into a smear.
  grid:   '<g fill="currentColor" stroke="none">' +
          '<circle cx="5" cy="9" r="1.9"/>' +
          '<circle cx="9.7" cy="9" r="1.9" opacity=".32"/>' +
          '<circle cx="14.4" cy="9" r="1.9"/>' +
          '<circle cx="19.1" cy="9" r="1.9" opacity=".32"/>' +
          '<circle cx="5" cy="15.4" r="1.9" opacity=".32"/>' +
          '<circle cx="9.7" cy="15.4" r="1.9"/>' +
          '<circle cx="14.4" cy="15.4" r="1.9" opacity=".32"/>' +
          '<circle cx="19.1" cy="15.4" r="1.9"/></g>',

  undo:   '<path d="M4.6 9.2h9.6a5.4 5.4 0 0 1 0 10.8H8"/>' +
          '<path d="m8.4 4.6-3.8 4.6 3.8 4.4"/>',

  // Sweep it away. Friendlier than a bin, and a child reads a broom.
  broom:  '<path d="M15.2 2.9 11.9 10.3"/>' +
          '<path d="M6.7 10.9h10.6l1.3 8.2a1.1 1.1 0 0 1-1.1 1.3H6.5a1.1 1.1 0 0 1-1.1-1.3z"/>' +
          '<path d="M9.7 14.1v5.2M12.2 14.1v5.2M14.7 14.1v5.2"/>',

  // Sliders rather than a cogwheel: at 17px a gear's teeth collapse into a
  // sunburst and stop reading as anything.
  gear:   '<path d="M3.4 8h8.2M16.6 8h4M3.4 16h4.2M12.6 16h8"/>' +
          '<circle cx="14.1" cy="8" r="2.5"/>' +
          '<circle cx="10.1" cy="16" r="2.5"/>',

  // Record your own sounds.
  mic:    '<rect x="8.8" y="2.8" width="6.4" height="11.4" rx="3.2"/>' +
          '<path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v3.4"/>',

  // How much the beat bounces.
  groove: '<path d="M2.8 14.6c2.6 0 2.6-5.2 5.2-5.2s2.6 5.2 5.2 5.2 2.6-5.2 5.2-5.2 2.6 5.2 2.6 5.2"/>',
};

/** Inline SVG for a named icon. Sized by CSS, coloured by currentColor. */
function icon(name) {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false" ` +
         `fill="none" stroke="currentColor" stroke-width="2.4" ` +
         `stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/** Swap the icon inside an already-rendered button. */
function setIcon(el, name) {
  if (el) el.innerHTML = icon(name);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ICONS, icon, setIcon };
}
