// Procedural paper-craft art for the flow views: puppets, herons, pigeons, jars, wax seals, stars, hearts.
// Every function returns an SVG *string* (testable in node, no DOM needed); `el(markup)` turns one into an element.
// Colours only ever enter the markup through safeColour(); text never does (labels are HTML, set as text nodes).
import { safeColour, shade, mix, hash, clamp, starSlots, hearts as heartSlots } from './pure.js';

const INK = '#241a26';
const NS = 'http://www.w3.org/2000/svg';
let UID = 0;
const uid = (p) => `${p}${++UID}`;
const f1 = (n) => Math.round(n * 10) / 10;

/** SVG markup string -> live <svg> element (attributes from `props`, e.g. {class, role, 'aria-label'}). */
export function el(markup, props = {}) {
  const host = document.createElementNS(NS, 'svg');
  host.innerHTML = markup;
  const svg = host.firstElementChild || host;
  for (const [k, v] of Object.entries(props)) if (v != null && v !== false) svg.setAttribute(k, v === true ? '' : String(v));
  return svg;
}

const wrap = (viewBox, inner, { cls = '', label = '', w, h } = {}) =>
  `<svg xmlns="${NS}" viewBox="${viewBox}"${w ? ` width="${w}"` : ''}${h ? ` height="${h}"` : ''} class="${cls}" ${label ? `role="img" aria-label="${String(label).replace(/[<>&"]/g, '')}"` : 'aria-hidden="true"'} fill="none" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;

/* ------------------------------------------------------------------------------------------ puppets */

const MOODS = new Set(['neutral', 'joy', 'fear', 'rage', 'love', 'grief', 'smug']);

function faceBits(mood, ex, ey, mx, my, o = {}) {
  const look = o.look || 0;
  const big = mood === 'fear' ? 1.25 : mood === 'grief' ? 0.95 : 1;
  const eye = (x, flip) => {
    const px = x + look * 1.3;
    const lid = mood === 'smug' ? `<path d="M${x - 4},${ey - 1.5} Q${x},${ey - 4.5} ${x + 4},${ey - 1.5}" fill="${o.skin}" stroke="none"/>` : '';
    return `<g><ellipse cx="${x}" cy="${ey}" rx="3.5" ry="${f1(3.9 * big)}" fill="#fffaf0" stroke="${INK}" stroke-width="1.1"/>
      <circle cx="${f1(px)}" cy="${ey + (mood === 'grief' ? 0.8 : 0.3)}" r="${mood === 'fear' ? 1.3 : 1.9}" fill="${INK}"/><circle cx="${f1(px - 0.7)}" cy="${ey - 0.6}" r="0.6" fill="#fff" stroke="none"/>${lid}</g>`;
  };
  const brow = (x, side) => {
    const s = side; // -1 left, +1 right
    const y = ey - 7.5;
    let d;
    switch (mood) {
      case 'rage': d = `M${x - 4 * s},${y - 2.5} L${x + 4 * s},${y + 1.5}`; break;
      case 'fear': d = `M${x - 4},${y + 0.5} Q${x},${y - 4} ${x + 4},${y + 0.5}`; break;
      case 'grief': d = `M${x - 4 * s},${y + 1.5} L${x + 4 * s},${y - 2.5}`; break;
      case 'smug': d = s > 0 ? `M${x - 4},${y - 2.5} Q${x},${y - 5} ${x + 4},${y - 2.5}` : `M${x - 4},${y} L${x + 4},${y}`; break;
      case 'joy': case 'love': d = `M${x - 4},${y + 1} Q${x},${y - 2.5} ${x + 4},${y + 1}`; break;
      default: d = `M${x - 4},${y} L${x + 4},${y - 0.5}`;
    }
    return `<path d="${d}" stroke="${o.brow}" stroke-width="1.7"/>`;
  };
  let mouth;
  switch (mood) {
    case 'joy': mouth = `<path d="M${mx - 6},${my - 1} Q${mx},${my + 7} ${mx + 6},${my - 1} Z" fill="#7d1527" stroke="${INK}" stroke-width="1.2"/><path d="M${mx - 3},${my + 3} Q${mx},${my + 5} ${mx + 3},${my + 3}" stroke="#ee6c4d" stroke-width="1.6"/>`; break;
    case 'fear': mouth = `<ellipse cx="${mx}" cy="${my + 1.5}" rx="3" ry="4" fill="#4a1020" stroke="${INK}" stroke-width="1.2"/>`; break;
    case 'rage': mouth = `<path d="M${mx - 6},${my + 3} Q${mx},${my - 3} ${mx + 6},${my + 3}" stroke="${INK}" stroke-width="1.8"/><path d="M${mx - 3},${my} v2.5 M${mx},${my - 0.5} v2.5 M${mx + 3},${my} v2.5" stroke="#fffaf0" stroke-width="1.2"/>`; break;
    case 'grief': mouth = `<path d="M${mx - 5},${my + 3} Q${mx},${my - 2} ${mx + 5},${my + 3}" stroke="${INK}" stroke-width="1.8"/><path d="M${ex[1] + 1},${ey + 5} q-1.5,4 0,6 q1.5,-2 0,-6z" fill="#7fb7e6" stroke="none"/>`; break;
    case 'love': mouth = `<path d="M${mx - 5},${my} Q${mx},${my + 5} ${mx + 5},${my}" stroke="${INK}" stroke-width="1.8"/>`; break;
    case 'smug': mouth = `<path d="M${mx - 5},${my + 1.5} Q${mx + 2},${my + 3.5} ${mx + 6},${my - 2}" stroke="${INK}" stroke-width="1.8"/>`; break;
    default: mouth = `<path d="M${mx - 4.5},${my + 0.5} Q${mx},${my + 2.2} ${mx + 4.5},${my + 0.5}" stroke="${INK}" stroke-width="1.7"/>`;
  }
  const blush = `<circle cx="${ex[0] - 3}" cy="${ey + 7}" r="3.1" fill="#ee6c4d" opacity="${mood === 'love' ? 0.55 : 0.28}" stroke="none"/><circle cx="${ex[1] + 3}" cy="${ey + 7}" r="3.1" fill="#ee6c4d" opacity="${mood === 'love' ? 0.55 : 0.28}" stroke="none"/>`;
  const heart = mood === 'love' ? `<path d="M${ex[1] + 9},${ey - 12} c-3,-4 -7,0 -3.5,3.5 l3.5,3.2 3.5,-3.2 c3.5,-3.5 -0.5,-7.5 -3.5,-3.5z" fill="#d8546b" stroke="${INK}" stroke-width="0.9"/>` : '';
  return `${blush}${eye(ex[0], -1)}${eye(ex[1], 1)}${brow(ex[0], -1)}${brow(ex[1], 1)}<g class="pp-jaw">${mouth}</g>${heart}`;
}

/** Head art. Returns {back, head, front, eyes:[x0,x1], ey, mx, my, customFace?} in the 120x200 puppet space (head centre ~60,58). */
function headArt(type, c) {
  const { skin, hair, accent, body } = c;
  const sk = `fill="${skin}" stroke="${INK}" stroke-width="1.6"`;
  switch (type) {
    case 'long':
      return {
        back: `<path d="M44,50 Q40,70 46,86 L50,70Z M76,50 Q80,70 74,86 L70,70Z" fill="${hair}" stroke="${INK}" stroke-width="1.4"/>`,
        head: `<ellipse cx="60" cy="58" rx="15.5" ry="23" ${sk}/>`,
        front: `<path d="M44,50 Q44,31 60,31 Q76,31 76,50 Q70,41 60,41 Q50,41 44,50Z" fill="${hair}" stroke="${INK}" stroke-width="1.4"/>`,
        eyes: [53.5, 66.5], ey: 57, mx: 60, my: 71,
      };
    case 'square':
      return {
        back: '',
        head: `<rect x="42" y="40" width="36" height="37" rx="9" ${sk}/>`,
        front: `<path d="M40,46 Q40,36 60,36 Q80,36 80,46 L80,50 Q60,42 40,50Z" fill="${hair}" stroke="${INK}" stroke-width="1.4"/>`,
        eyes: [52, 68], ey: 58, mx: 60, my: 69,
      };
    case 'beak': {
      const white = '#f6f0e4';
      return {
        back: `<path d="M50,74 Q48,96 52,112 L68,112 Q72,96 68,74Z" fill="${white}" stroke="${INK}" stroke-width="1.6"/>`,
        head: `<ellipse cx="58" cy="56" rx="15" ry="16" fill="${white}" stroke="${INK}" stroke-width="1.6"/>
               <path d="M69,52 Q82,54 92,60 Q82,67 69,65Z" fill="#f2a03d" stroke="${INK}" stroke-width="1.5"/><path d="M70,59 Q80,60.5 90,60.5" stroke="${INK}" stroke-width="1"/>`,
        front: `<path d="M50,41 q3,-8 8,-3 q5,-6 9,1" fill="${white}" stroke="${INK}" stroke-width="1.3"/>`,
        eyes: [54, 54], ey: 52, mx: 76, my: 61, single: true, noBrow: false,
      };
    }
    case 'sock':
      return {
        back: '',
        head: `<path d="M44,66 L44,48 Q44,34 60,34 Q76,34 76,48 L76,66 Q76,82 60,82 Q44,82 44,66Z" ${sk}/>
               <path d="M44,45 H76 M44,52 H76" stroke="${accent}" stroke-width="3.2"/>
               <ellipse cx="60" cy="72" rx="13" ry="9" fill="${shade(skin, -0.18)}" stroke="${INK}" stroke-width="1.2"/>`,
        front: `<circle cx="60" cy="33" r="4" fill="${accent}" stroke="${INK}" stroke-width="1.2"/>`,
        eyes: [52, 68], ey: 44, mx: 60, my: 71, button: true,
      };
    case 'nutcracker':
      return {
        back: `<rect x="42" y="14" width="36" height="28" rx="3" fill="#2b1a2d" stroke="${INK}" stroke-width="1.5"/><rect x="42" y="30" width="36" height="5" fill="${accent}" stroke="${INK}" stroke-width="1"/><path d="M60,14 q-2,-8 4,-10" stroke="${accent}" stroke-width="3"/>`,
        head: `<rect x="43" y="40" width="34" height="24" rx="5" ${sk}/><g class="pp-jaw-hinge"><rect x="45" y="63" width="30" height="14" rx="4" fill="${shade(skin, -0.1)}" stroke="${INK}" stroke-width="1.5"/><path d="M50,63 v8 M55,63 v8 M60,63 v8 M65,63 v8 M70,63 v8" stroke="${INK}" stroke-width="0.9"/></g>`,
        front: `<path d="M46,62 Q60,57 74,62 Q66,66 60,64 Q54,66 46,62Z" fill="${hair}" stroke="${INK}" stroke-width="1.2"/>`,
        eyes: [52, 68], ey: 51, mx: 60, my: 71, noMouth: true,
      };
    case 'tin':
      return {
        back: `<path d="M60,10 L75,40 H45Z" fill="#aeb9c2" stroke="${INK}" stroke-width="1.6"/><circle cx="60" cy="9" r="3" fill="${accent}" stroke="${INK}" stroke-width="1.2"/>`,
        head: `<rect x="44" y="38" width="32" height="38" rx="8" fill="#c3ced6" stroke="${INK}" stroke-width="1.6"/><path d="M44,50 H76 M44,66 H76" stroke="#8d9aa5" stroke-width="1.2"/>
               <circle cx="47.5" cy="43" r="1.2" fill="#6e7a85" stroke="none"/><circle cx="72.5" cy="43" r="1.2" fill="#6e7a85" stroke="none"/><circle cx="47.5" cy="71" r="1.2" fill="#6e7a85" stroke="none"/><circle cx="72.5" cy="71" r="1.2" fill="#6e7a85" stroke="none"/>`,
        front: `<path d="M48,43 q5,-3 10,0" stroke="#fff" stroke-width="1.4" opacity=".7"/>`,
        eyes: [53, 67], ey: 56, mx: 60, my: 68, lens: true,
      };
    case 'shadow':
      return {
        back: '',
        head: `<path d="M60,34 Q76,34 77,56 Q78,72 68,80 L52,80 Q42,72 43,56 Q44,34 60,34Z" fill="#1d1220" stroke="${INK}" stroke-width="1.6"/>`,
        front: '',
        eyes: [53, 67], ey: 56, mx: 60, my: 69, ghost: true,
      };
    default: // round
      return {
        back: '',
        head: `<circle cx="60" cy="58" r="19.5" ${sk}/>`,
        front: `<path d="M40.5,56 Q41,37 60,37 Q79,37 79.5,56 Q72,46 60,46 Q48,46 40.5,56Z" fill="${hair}" stroke="${INK}" stroke-width="1.4"/><path d="M42,52 q-5,8 -2,18 q4,-6 4,-14z M78,52 q5,8 2,18 q-4,-6 -4,-14z" fill="${hair}" stroke="${INK}" stroke-width="1.2"/>`,
        eyes: [52, 68], ey: 58, mx: 60, my: 69,
      };
  }
}

function glowFace(mood, h, c) {
  // shadow puppets: glowing slit eyes + a thin pale mouth
  const [x0, x1] = h.eyes;
  const sleep = mood === 'smug';
  const eye = (x) => `<ellipse cx="${x}" cy="${h.ey}" rx="3.6" ry="${sleep ? 1.4 : mood === 'fear' ? 5.2 : 4}" fill="#fff4c2" stroke="none"/>`;
  const mouth = mood === 'joy' ? `<path d="M52,68 Q60,76 68,68" stroke="#fff4c2" stroke-width="1.6"/>` : mood === 'fear' ? `<ellipse cx="60" cy="70" rx="3" ry="4.5" fill="#fff4c2" stroke="none"/>` : `<path d="M54,70 H66" stroke="#fff4c2" stroke-width="1.6"/>`;
  return `${eye(x0)}${eye(x1)}<g class="pp-jaw">${mouth}</g>`;
}

function lensFace(mood, h) {
  const eye = (x) => `<circle cx="${x}" cy="${h.ey}" r="6" fill="#26343d" stroke="${INK}" stroke-width="1.4"/><circle cx="${x}" cy="${h.ey}" r="${mood === 'fear' ? 4.6 : 3.4}" fill="#f7dc8c" stroke="none"/><circle cx="${x - 1}" cy="${h.ey - 1.2}" r="1" fill="#fff" stroke="none"/>`;
  const grille = `<g class="pp-jaw"><rect x="53" y="65" width="14" height="8" rx="2" fill="#26343d" stroke="${INK}" stroke-width="1.1"/><path d="M56,65 v8 M60,65 v8 M64,65 v8" stroke="#8d9aa5" stroke-width="0.9"/></g>`;
  return `${eye(h.eyes[0])}${eye(h.eyes[1])}${grille}`;
}

function buttonFace(mood, h, c) {
  const eye = (x) => `<circle cx="${x}" cy="${h.ey}" r="5" fill="#fffaf0" stroke="${INK}" stroke-width="1.3"/><circle cx="${x + (mood === 'fear' ? 0 : 0.8)}" cy="${h.ey + 0.5}" r="${mood === 'fear' ? 1.4 : 2.2}" fill="${INK}"/>`;
  const wide = mood === 'joy' ? 7 : mood === 'fear' ? 5 : 4;
  const mouth = `<g class="pp-jaw"><path d="M${60 - 9},${h.my - 2} Q60,${h.my + wide + 2} ${60 + 9},${h.my - 2}Z" fill="#7d1527" stroke="${INK}" stroke-width="1.3"/><ellipse cx="60" cy="${h.my + 3.4}" rx="4" ry="2" fill="#ee6c4d" stroke="none"/></g>`;
  const brow = (x) => `<path d="M${x - 4},${h.ey - 8} q4,${mood === 'rage' ? 3 : -3} 8,0" stroke="${INK}" stroke-width="1.5"/>`;
  return `${eye(h.eyes[0])}${eye(h.eyes[1])}${brow(h.eyes[0])}${brow(h.eyes[1])}${mouth}`;
}

/* ---- costumes: return {torso, legsFrom (y where bare legs begin, null = fully covered), sleeve} */
function costumeArt(kind, c) {
  const { body, accent, hair } = c;
  const dark = shade(body, -0.35), lite = shade(body, 0.28);
  const st = `stroke="${INK}" stroke-width="1.6"`;
  switch (kind) {
    case 'gown':
      return {
        torso: `<path d="M46,118 Q60,124 74,118 L96,182 Q60,192 24,182Z" fill="${body}" ${st}/><path d="M60,121 L60,186 M44,128 L38,184 M76,128 L82,184" stroke="${dark}" stroke-width="1" opacity=".4"/>
                <path d="M42,89 Q60,83 78,89 L75,120 Q60,126 45,120Z" fill="${body}" ${st}/><path d="M45,119 Q60,125 75,119" stroke="${accent}" stroke-width="3.4"/><path d="M26,181 Q60,191 94,181" stroke="${accent}" stroke-width="2.4"/>
                <path d="M48,90 Q60,100 72,90" stroke="${lite}" stroke-width="2"/>`,
        legsFrom: null, sleeve: body,
      };
    case 'robe':
      return {
        torso: `<path d="M42,88 Q60,82 78,88 L98,184 Q60,194 22,184Z" fill="${body}" ${st}/><path d="M60,92 V188" stroke="${dark}" stroke-width="1.2" opacity=".5"/><rect x="44" y="114" width="32" height="7" rx="2" fill="${accent}" ${st}/>
                <path d="M52,90 L60,106 L68,90" fill="${lite}" stroke="${INK}" stroke-width="1.2"/>
                <circle cx="60" cy="118" r="3" fill="${accent}" stroke="${INK}" stroke-width="1"/>`,
        legsFrom: null, sleeve: body, wide: true,
      };
    case 'frock':
      return {
        torso: `<path d="M44,89 Q60,83 76,89 L92,164 Q60,172 28,164Z" fill="${body}" ${st}/>
                <path d="M50,94 L70,94 L72,140 L48,140Z" fill="#fff6e4" ${st}/><rect x="53" y="120" width="14" height="10" rx="2" fill="${lite}" stroke="${INK}" stroke-width="1"/>
                <path d="M28,164 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0 q4,6 8,0" stroke="${INK}" stroke-width="1.2" fill="${accent}" opacity=".95"/>
                <path d="M50,92 Q60,100 70,92" stroke="${accent}" stroke-width="2.2"/>`,
        legsFrom: 170, sleeve: body,
      };
    case 'uniform':
      return {
        torso: `<path d="M40,88 Q60,83 80,88 L79,142 L41,142Z" fill="${body}" ${st}/>
                <path d="M60,88 V142" stroke="${accent}" stroke-width="2.4"/>${[96, 106, 116, 126].map((y) => `<circle cx="54" cy="${y}" r="2" fill="${accent}" stroke="${INK}" stroke-width=".8"/><circle cx="66" cy="${y}" r="2" fill="${accent}" stroke="${INK}" stroke-width=".8"/>`).join('')}
                <rect x="40" y="130" width="40" height="6" fill="${dark}" ${st}/><rect x="55" y="129" width="10" height="8" rx="1.5" fill="${accent}" ${st}/>
                <ellipse cx="39" cy="89" rx="7" ry="3.4" fill="${accent}" ${st}/><ellipse cx="81" cy="89" rx="7" ry="3.4" fill="${accent}" ${st}/>`,
        legsFrom: 142, sleeve: body, trousers: dark,
      };
    case 'rags':
      return {
        torso: `<path d="M42,89 Q60,83 78,89 L82,150 L76,144 L72,153 L65,145 L60,154 L54,145 L48,153 L44,144 L38,150Z" fill="${body}" ${st}/>
                <rect x="47" y="100" width="11" height="10" fill="${mix(body, accent, 0.65)}" stroke="${INK}" stroke-width="1" stroke-dasharray="2 1.6" transform="rotate(-6 52 105)"/>
                <rect x="63" y="120" width="12" height="11" fill="${mix(body, '#7bb661', 0.5)}" stroke="${INK}" stroke-width="1" stroke-dasharray="2 1.6" transform="rotate(5 69 125)"/>
                <path d="M46,92 L74,92" stroke="${dark}" stroke-width="1.2" stroke-dasharray="3 2"/><path d="M60,134 l3,3 m-3,0 l3,-3" stroke="${INK}" stroke-width="1"/>`,
        legsFrom: 150, sleeve: body, ragged: true,
      };
    case 'armour': {
      const steel = '#b4bec7';
      return {
        torso: `<path d="M41,89 Q60,83 79,89 L77,128 L43,128Z" fill="${steel}" ${st}/><path d="M60,89 V128 M44,104 H76 M45,116 H75" stroke="#7d8892" stroke-width="1.2"/>
                <circle cx="38" cy="90" r="8" fill="${steel}" ${st}/><circle cx="82" cy="90" r="8" fill="${steel}" ${st}/>
                <path d="M43,128 H77 L80,150 H40Z" fill="${body}" ${st}/><path d="M50,128 V150 M60,128 V150 M70,128 V150" stroke="${INK}" stroke-width="1" opacity=".5"/>
                <rect x="43" y="124" width="34" height="5" fill="${accent}" ${st}/>`,
        legsFrom: 150, sleeve: steel, trousers: '#8d98a2',
      };
    }
    case 'wig':
      return { ...costumeArt('frock', c), wig: true };
    default: // coat
      return {
        torso: `<path d="M40,88 Q60,83 80,88 L79,138 L41,138Z" fill="${body}" ${st}/>
                <path d="M41,138 L36,166 L50,150Z M79,138 L84,166 L70,150Z" fill="${body}" ${st}/>
                <path d="M50,88 L60,112 L70,88 L66,86 L60,98 L54,86Z" fill="#fff6e4" ${st}/><path d="M60,112 V138" stroke="${INK}" stroke-width="1.2"/>
                <path d="M44,90 L56,118 L48,122Z M76,90 L64,118 L72,122Z" fill="${accent}" ${st}/>
                <circle cx="60" cy="122" r="1.8" fill="${accent}" stroke="${INK}" stroke-width=".8"/><circle cx="60" cy="131" r="1.8" fill="${accent}" stroke="${INK}" stroke-width=".8"/>`,
        legsFrom: 138, sleeve: body, trousers: shade(body, -0.45),
      };
  }
}

const STRING_POINTS = [[60, 38], [24, 134], [96, 134], [42, 88], [78, 88], [50, 160], [70, 160]]; // head, hands, shoulders, knees

/**
 * A paper marionette (or hand puppet). `p` is a performers.json row (or a staff row).
 * opts: {view:'full'|'bust'|'head', mood, look:-1..1, strings:true, hat:'top'|null, title}
 */
export function puppetMarkup(p, opts = {}) {
  const view = opts.view || 'full';
  const mood = MOODS.has(opts.mood) ? opts.mood : 'neutral';
  const pal = p?.palette || {};
  const build = p?.build || {};
  const body = safeColour(pal.body, '#8a5a7a');
  const accent = safeColour(pal.accent, '#e9b949');
  const hair = safeColour(pal.hair, '#3b2a3a');
  const headType = build.head || (p?.id === 'madame' ? 'long' : 'round');
  const costume = build.costume || (p?.id === 'madame' ? 'robe' : 'coat');
  const arms = build.arms || 'normal';
  const hs = clamp(Number(build.height) || 1, 0.8, 1.2);
  const nStrings = clamp(Math.round(build.strings ?? 5), 3, 7);
  const isHand = p?.kind === 'hand';
  const skinBase = { shadow: '#2a1830', tin: '#c3ced6', beak: '#f6f0e4' }[headType];
  const skin = skinBase || mix(body, '#f4dfc2', 0.8);
  const c = { skin, hair, accent, body };
  const hd = headArt(headType, c);
  const co = costumeArt(costume, c);
  const T = (x, y) => [f1(60 + (x - 60) * hs), f1(190 + (y - 190) * hs)];
  const sleeveCol = co.sleeve || body;

  // arms: shoulder -> hand
  const handY = arms === 'long' ? 144 : arms === 'short' ? 116 : arms === 'stubby' ? 112 : 132;
  const handX = arms === 'long' ? 20 : 25;
  const armSvg = [[-1, 42], [1, 78]]
    .map(([s, sx]) => {
      const hx = 60 + s * (60 - handX);
      const wide = co.wide ? 9 : 6.4;
      return `<path d="M${sx},92 Q${f1((sx + hx) / 2 + s * 5)},${f1((92 + handY) / 2 + 4)} ${hx},${handY}" stroke="${INK}" stroke-width="${wide + 2.4}"/><path d="M${sx},92 Q${f1((sx + hx) / 2 + s * 5)},${f1((92 + handY) / 2 + 4)} ${hx},${handY}" stroke="${sleeveCol}" stroke-width="${wide}"/><circle cx="${hx}" cy="${handY + 3}" r="4.6" fill="${skin === '#2a1830' ? '#3b2342' : skin}" stroke="${INK}" stroke-width="1.4"/>`;
    })
    .join('');

  // legs
  let legs = '';
  if (!isHand && co.legsFrom != null) {
    const tr = co.trousers || shade(body, -0.4);
    legs = [[-1, 52], [1, 68]]
      .map(([, x]) => `<rect x="${x - 4.2}" y="${co.legsFrom - 2}" width="8.4" height="${186 - co.legsFrom}" rx="3" fill="${tr}" stroke="${INK}" stroke-width="1.5"/><path d="M${x - 6},186 h12 l1.5,6 h-15Z" fill="${accent}" stroke="${INK}" stroke-width="1.4"/>`)
      .join('');
  } else if (!isHand && co.legsFrom == null) {
    legs = [[52], [68]].map(([x]) => `<path d="M${x - 5},184 h10 l1,7 h-12Z" fill="${INK}" stroke="${INK}" stroke-width="1"/>`).join('');
  }

  // face
  let face;
  if (hd.ghost) face = glowFace(mood, hd, c);
  else if (hd.lens) face = lensFace(mood, hd);
  else if (hd.button) face = buttonFace(mood, hd, c);
  else {
    face = faceBits(mood, hd.eyes, hd.ey, hd.mx, hd.my, { skin, brow: INK, look: opts.look });
    if (hd.noMouth) face = face.replace(/<g class="pp-jaw">[\s\S]*?<\/g>/, '');
  }
  if (hd.single) { // goose: one visible eye in profile
    face = `<ellipse cx="55" cy="52" rx="3" ry="3.4" fill="#fffaf0" stroke="${INK}" stroke-width="1"/><circle cx="56" cy="52.4" r="1.7" fill="${INK}"/><g class="pp-jaw"><path d="M72,60.5 H88" stroke="${INK}" stroke-width="1.1"/></g>${mood === 'rage' ? `<path d="M50,46 L60,50" stroke="${INK}" stroke-width="1.8"/>` : ''}`;
  }

  // wig + hats
  let hat = '';
  if (co.wig) {
    const wc = '#f4efe6';
    hat = `<g stroke="${INK}" stroke-width="1.3" fill="${wc}">${[[44, 42], [50, 33], [60, 29], [70, 33], [76, 42], [41, 54], [79, 54], [42, 66], [78, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7.5"/>`).join('')}</g>`;
  }
  if (opts.hat === 'top' || p?.id === 'madame') {
    hat += `<ellipse cx="60" cy="38" rx="25" ry="5.5" fill="#2b1a2d" stroke="${INK}" stroke-width="1.5"/><path d="M44,38 Q46,14 60,13 Q74,14 76,38Z" fill="#2b1a2d" stroke="${INK}" stroke-width="1.5"/><path d="M45,31 H75" stroke="${accent}" stroke-width="4"/><path d="M74,26 q16,-18 22,2 q-12,-8 -18,6z" fill="${safeColour(pal.accent, '#d8546b')}" stroke="${INK}" stroke-width="1.2"/>`;
  }

  // strings & control bar
  let strings = '';
  if (!isHand && opts.strings !== false) {
    const pts = STRING_POINTS.slice(0, nStrings);
    const barL = 36, barR = 84;
    strings = `<g class="pp-strings" stroke="var(--pp-string, #d9c49a)" stroke-width="0.9" opacity="0.8">${pts
      .map(([x, y], i) => {
        const [tx, ty] = T(x, y);
        const bx = f1(barL + ((barR - barL) * i) / Math.max(1, pts.length - 1));
        return `<path d="M${bx},9 L${tx},${ty}"/>`;
      })
      .join('')}</g><g class="pp-bar"><rect x="30" y="3" width="60" height="6" rx="3" fill="#a97c1f" stroke="${INK}" stroke-width="1.2"/><circle cx="60" cy="3" r="2.4" fill="#e9b949" stroke="${INK}" stroke-width="1"/></g>`;
  }
  const handSleeve = isHand
    ? `<path d="M40,88 Q60,83 80,88 L86,206 L34,206Z" fill="${body}" stroke="${INK}" stroke-width="1.6"/>`
    : '';

  const figure = `<g class="pp-fig" transform="translate(60 190) scale(${hs}) translate(-60 -190)">
    ${hd.back}
    ${isHand ? '' : `<rect x="55" y="76" width="10" height="14" rx="3" fill="${skin === '#2a1830' ? '#3b2342' : skin}" stroke="${INK}" stroke-width="1.4"/>`}
    ${legs}
    ${isHand ? handSleeve : co.torso}
    ${armSvg}
    ${isHand ? '' : ''}
    <g class="pp-head">${hd.head}${hd.front}${face}${hat}</g>
  </g>`;

  const viewBox = view === 'head' ? '28 6 64 84' : view === 'bust' ? '14 2 92 118' : '0 0 120 200';
  const cls = `pp pp-${view}${opts.cls ? ' ' + opts.cls : ''}`;
  return wrap(viewBox, `${view === 'full' || view === 'bust' ? strings : ''}${figure}`, { cls, label: opts.title || p?.name || 'puppet' });
}

/* ------------------------------------------------------------------------------------------ herons (the quills) */

export function heronMarkup(staff, opts = {}) {
  const mood = opts.mood || String(staff?.id || 'pompous').replace(/^quill_/, '');
  const pal = staff?.palette || {};
  const body = safeColour(pal.body, { pompous: '#6a4575', frantic: '#c8574a', tender: '#5c8fb0' }[mood] || '#6a4575');
  const accent = safeColour(pal.accent, '#e9b949');
  const grey = mix(body, '#cfd8e0', 0.7);
  const dark = shade(grey, -0.3);
  const lean = mood === 'pompous' ? -2 : mood === 'tender' ? 6 : 0;
  const neck = `M62,128 C48,112 74,92 58,74 C46,60 ${58 + lean},48 ${60 + lean},36`;
  const hx = 60 + lean;
  const extras = {
    pompous: `<circle cx="${hx + 5}" cy="30" r="7" fill="rgba(255,255,255,.25)" stroke="${accent}" stroke-width="1.8"/><path d="M${hx + 12},31 Q${hx + 16},46 ${hx + 12},58" stroke="${accent}" stroke-width="1"/>
              <path d="M48,77 q6,10 12,0 q6,10 12,0 q-4,12 -12,12 q-8,0 -12,-12z" fill="#fff6e4" stroke="${INK}" stroke-width="1.2"/>`,
    frantic: `<path d="M${hx - 4},22 l-3,-12 l7,8 l2,-14 l4,13 l7,-9 l-2,13z" fill="${shade(body, 0.1)}" stroke="${INK}" stroke-width="1.2"/>
              <path d="M${hx + 18},28 q3,5 0,8 q-3,-3 0,-8z M${hx - 14},40 q3,5 0,8 q-3,-3 0,-8z" fill="#7fb7e6" stroke="none"/>
              <circle cx="${hx + 26}" cy="60" r="2.5" fill="#241a26" stroke="none"/><circle cx="${hx + 32}" cy="52" r="1.6" fill="#241a26" stroke="none"/>`,
    tender: `<path d="M48,78 q12,10 26,0 l2,9 q-14,8 -30,0z" fill="#d8546b" stroke="${INK}" stroke-width="1.2"/><path d="M52,86 v12 l5,-2 v-9" fill="#d8546b" stroke="${INK}" stroke-width="1.2"/>
             <path d="M${hx + 14},12 c-3,-5 -9,0 -4.5,4.5 l4.5,4 4.5,-4 c4.5,-4.5 -1.5,-9.5 -4.5,-4.5z" fill="#d8546b" stroke="${INK}" stroke-width="1"/>`,
  }[mood] || '';
  const browY = mood === 'frantic' ? 28 : 30;
  const inner = `
    <g class="hh-legs"><path d="M60,148 V194 M80,146 V194" stroke="${dark}" stroke-width="3.4"/><path d="M52,194 h16 M72,194 h16" stroke="${dark}" stroke-width="3.4"/></g>
    <ellipse cx="72" cy="136" rx="34" ry="24" fill="${grey}" stroke="${INK}" stroke-width="1.7"/>
    <path d="M70,126 Q96,128 104,150 Q84,156 66,146Z" fill="${shade(grey, -0.12)}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M100,146 L120,158 L104,158Z" fill="${dark}" stroke="${INK}" stroke-width="1.3"/>
    <path d="${neck}" stroke="${INK}" stroke-width="13" /><path d="${neck}" stroke="${grey}" stroke-width="10"/>
    ${extras.includes('fff6e4') ? '' : ''}
    <g class="hh-head"><ellipse cx="${hx}" cy="30" rx="11" ry="9.5" fill="${grey}" stroke="${INK}" stroke-width="1.6"/>
      <path d="M${hx - 9},26 L${hx - 40},38 L${hx - 8},34Z" fill="#f2a03d" stroke="${INK}" stroke-width="1.5"/>
      <circle cx="${hx - 2}" cy="${browY - 1}" r="2.3" fill="#fffaf0" stroke="${INK}" stroke-width="1"/><circle cx="${hx - 2.6}" cy="${browY - 0.7}" r="1.1" fill="${INK}" stroke="none"/>
      <path d="M${hx - 7},${browY - 6} L${hx + 3},${browY - (mood === 'pompous' ? 4 : 7)}" stroke="${INK}" stroke-width="1.5"/>
      <path d="M${hx + 8},22 q10,-10 14,-4 q-6,0 -10,8z" fill="${body}" stroke="${INK}" stroke-width="1.2"/>${extras}</g>
    <g class="hh-quill"><path d="M${hx - 36},44 L${hx - 52},64" stroke="${INK}" stroke-width="0.1"/></g>`;
  return wrap('0 0 130 200', inner, { cls: `hh hh-${mood}`, label: staff?.name || 'heron playwright' });
}

/** A feather quill, drawn pointing down-left (nib at the bottom-left). */
export function quillMarkup(color = '#f6ecd6') {
  return wrap('0 0 40 70', `<path d="M34,2 C40,18 30,40 8,62 L4,66 L7,58 C16,40 22,24 34,2Z" fill="${color}" stroke="${INK}" stroke-width="1.5"/><path d="M33,6 C26,24 16,44 6,63" stroke="${INK}" stroke-width="1.1"/><path d="M4,66 L3,69 L8,66Z" fill="${INK}"/>`, { cls: 'quill-svg' });
}

/* ------------------------------------------------------------------------------------------ pigeons (the critics) */

export function pigeonMarkup(critic, opts = {}) {
  const id = critic?.id || 'pompous';
  const base = { pompous: '#8d98b8', wounded_parent: '#b6a0c4', snacks: '#a9b9a0', chaos_gourmand: '#c9a98f', sentimentalist: '#9fb8c9' }[id] || '#a3a7b8';
  const grey = safeColour(opts.colour, base);
  const dk = shade(grey, -0.3);
  const neck = '#5aa493';
  const acc = {
    pompous: `<ellipse cx="38" cy="27" rx="17" ry="3.8" fill="#2b1a2d" stroke="${INK}" stroke-width="1.3"/><rect x="26" y="9" width="24" height="19" rx="3" fill="#2b1a2d" stroke="${INK}" stroke-width="1.3"/><rect x="26" y="21" width="24" height="4.5" fill="#b3263d"/>
              <circle cx="46" cy="36" r="5.2" fill="rgba(255,255,255,.35)" stroke="#e9b949" stroke-width="1.4"/><path d="M51,38 Q56,50 52,60" stroke="#e9b949" stroke-width=".9"/>`,
    wounded_parent: `<path d="M24,32 Q26,14 40,14 Q52,14 54,30 Q40,24 24,32Z" fill="#d8546b" stroke="${INK}" stroke-width="1.3"/><path d="M28,28 q10,-6 22,0" stroke="#fff6e4" stroke-width="2"/>
              <path d="M70,58 q8,-4 10,6 q-2,8 -10,6z" fill="#fff6e4" stroke="${INK}" stroke-width="1.1"/>`,
    snacks: `<path d="M30,52 Q52,64 74,52 L72,74 Q52,82 32,74Z" fill="#fff6e4" stroke="${INK}" stroke-width="1.2"/><path d="M38,60 q4,3 8,0 M52,60 q4,3 8,0" stroke="#ee6c4d" stroke-width="1.6"/>
              <path d="M70,40 l12,-12 m-4,-2 l8,8 m-14,6 l6,6" stroke="#a97c1f" stroke-width="1.8"/>`,
    chaos_gourmand: `<path d="M30,18 L33,4 L38,15 L42,0 L46,15 L52,5 L52,20Z" fill="#ee6c4d" stroke="${INK}" stroke-width="1.2"/><rect x="32" y="26" width="26" height="9" rx="4.5" fill="#26343d" stroke="${INK}" stroke-width="1.2"/><circle cx="38" cy="30.5" r="3" fill="#f7dc8c" stroke="none"/><circle cx="52" cy="30.5" r="3" fill="#f7dc8c" stroke="none"/>`,
    sentimentalist: `<path d="M28,52 Q50,62 72,52 L74,64 Q50,72 26,64Z" fill="#b8a1e3" stroke="${INK}" stroke-width="1.2"/><path d="M34,63 v12 l6,-2 v-8" fill="#b8a1e3" stroke="${INK}" stroke-width="1.1"/>
              <path d="M47,43 q-2,5 0,8 q2,-3 0,-8z" fill="#7fb7e6" stroke="none"/>`,
  }[id] || '';
  const inner = `
    <g class="pg-feet"><path d="M42,86 v10 M58,86 v10 M36,97 h12 M52,97 h12" stroke="#d98a6a" stroke-width="2.4"/></g>
    <path d="M14,66 L2,80 L20,74Z" fill="${dk}" stroke="${INK}" stroke-width="1.4"/>
    <ellipse cx="46" cy="64" rx="31" ry="24" fill="${grey}" stroke="${INK}" stroke-width="1.7"/>
    <g class="pg-wing"><path d="M30,56 Q48,50 64,62 Q56,80 34,72Z" fill="${dk}" stroke="${INK}" stroke-width="1.4"/><path d="M38,60 Q50,58 58,64 M36,66 Q48,64 56,70" stroke="${INK}" stroke-width="1" opacity=".6"/></g>
    <path d="M58,50 Q74,44 76,36 Q80,48 70,60Z" fill="${neck}" opacity=".85" stroke="none"/>
    <circle cx="66" cy="34" r="13.5" fill="${grey}" stroke="${INK}" stroke-width="1.7"/>
    <path d="M77,31 L90,35 L77,39Z" fill="#f2a03d" stroke="${INK}" stroke-width="1.3"/>
    <circle cx="70" cy="30" r="3.2" fill="#f7dc8c" stroke="${INK}" stroke-width="1"/><circle cx="71" cy="30" r="1.5" fill="${INK}" stroke="none"/>
    <path d="M62,24 q4,-3 8,-1" stroke="${INK}" stroke-width="1.4"/>
    ${acc}`;
  return wrap('0 0 100 104', inner, { cls: `pg pg-${id}`, label: critic?.name || 'pigeon critic' });
}

/* ------------------------------------------------------------------------------------------ jars */

const JAR_ICONS = {
  chair: `<path d="M-8,-12 v22 M8,-12 v22 M-8,0 h16 M-8,-12 h16 M-9,0 v10 M9,0 v10" stroke="#a97c1f" stroke-width="3"/>`,
  goose: `<ellipse cx="0" cy="6" rx="11" ry="7" fill="#f6f0e4" stroke="${INK}" stroke-width="1.3"/><path d="M8,2 C14,-4 8,-10 10,-14" stroke="#f6f0e4" stroke-width="5"/><path d="M8,2 C14,-4 8,-10 10,-14" stroke="${INK}" stroke-width="1.2" opacity=".5"/><circle cx="11" cy="-14" r="4" fill="#f6f0e4" stroke="${INK}" stroke-width="1.2"/><path d="M14,-14 l6,1.5 -6,1.5z" fill="#f2a03d" stroke="${INK}" stroke-width="1"/>`,
  lean: `<g transform="rotate(-24)"><circle cx="0" cy="-12" r="5.5" fill="#f4dfc2" stroke="${INK}" stroke-width="1.3"/><path d="M-6,-6 L6,-6 L9,14 L-9,14Z" fill="#c0566e" stroke="${INK}" stroke-width="1.3"/></g>`,
  candle: `<rect x="-5" y="-4" width="10" height="18" rx="2" fill="#fff6e4" stroke="${INK}" stroke-width="1.3"/><path d="M0,-6 C-5,-12 0,-16 0,-20 C4,-15 5,-10 0,-6Z" fill="#e9b949" stroke="${INK}" stroke-width="1"/>`,
  door: `<rect x="-8" y="-14" width="16" height="28" rx="2" fill="#a0624a" stroke="${INK}" stroke-width="1.4"/><circle cx="4" cy="2" r="1.6" fill="#e9b949"/><path d="M-8,-14 q8,-6 16,0" stroke="${INK}" stroke-width="1.2"/>`,
  chandelier: `<path d="M0,-18 V-8 M-12,-2 Q0,6 12,-2 M-12,-2 v-6 M0,2 v-8 M12,-2 v-6" stroke="#e9b949" stroke-width="2.2"/><path d="M-12,-9 l-1,-4 M0,-9 l0,-4 M12,-9 l1,-4" stroke="#f7dc8c" stroke-width="2.6"/>`,
  cake: `<rect x="-12" y="2" width="24" height="12" rx="3" fill="#ee9bb0" stroke="${INK}" stroke-width="1.3"/><rect x="-9" y="-6" width="18" height="9" rx="3" fill="#fff6e4" stroke="${INK}" stroke-width="1.3"/><path d="M0,-8 v-5" stroke="${INK}" stroke-width="1.2"/><circle cx="0" cy="-15" r="2" fill="#e9b949"/>`,
  moon: `<path d="M6,-12 A13,13 0 1 0 8,10 A10,10 0 1 1 6,-12Z" fill="#f7dc8c" stroke="${INK}" stroke-width="1.3"/>`,
  star: `<path d="M0,-13 L4,-4 L14,-3 L7,4 L9,14 L0,9 L-9,14 L-7,4 L-14,-3 L-4,-4Z" fill="#e9b949" stroke="${INK}" stroke-width="1.3"/>`,
};
export function jarIconFor(slug) {
  const s = String(slug || '').toLowerCase();
  for (const k of ['chair', 'goose', 'lean', 'candle', 'door', 'chandelier', 'cake', 'moon']) if (s.includes(k)) return k;
  const keys = Object.keys(JAR_ICONS);
  return keys[hash(s) % keys.length];
}

export function jarMarkup(slug, opts = {}) {
  const icon = JAR_ICONS[jarIconFor(slug)];
  const tilt = ((hash(slug) % 9) - 4) * 3.5;
  const id = uid('jr');
  const inner = `
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset=".25" stop-color="#ffffff" stop-opacity=".08"/><stop offset=".8" stop-color="#ffffff" stop-opacity=".02"/><stop offset="1" stop-color="#ffffff" stop-opacity=".28"/></linearGradient></defs>
    <path d="M22,26 Q8,32 8,52 V104 Q8,120 28,120 H72 Q92,120 92,104 V52 Q92,32 78,26Z" fill="rgba(200,230,236,.16)" stroke="${INK}" stroke-width="2.2"/>
    <path d="M22,26 Q8,32 8,52 V104 Q8,120 28,120 H72 Q92,120 92,104 V52 Q92,32 78,26Z" fill="url(#${id})" stroke="none"/>
    <g transform="translate(50 82) rotate(${tilt})">${icon}</g>
    <rect x="22" y="14" width="56" height="14" rx="4" fill="#a97c1f" stroke="${INK}" stroke-width="2"/><path d="M28,14 v14 M36,14 v14 M44,14 v14 M52,14 v14 M60,14 v14 M68,14 v14" stroke="${INK}" stroke-width=".8" opacity=".35"/>
    <path d="M16,50 q-2,26 0,44" stroke="#fff" stroke-width="3" opacity=".45"/>`;
  return wrap('0 0 100 130', inner, { cls: `vjar ${opts.cls || ''}` });
}

/* ------------------------------------------------------------------------------------------ seals, stars, hearts, icons */

export function sealMarkup(opts = {}) {
  const col = safeColour(opts.colour, '#b3263d');
  const seed = hash(opts.seed || 'seal');
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 44 + ((seed >> (i % 16)) & 3) * 1.6 + (i % 2 ? 3 : 0);
    pts.push(`${f1(50 + Math.cos(a) * r)},${f1(50 + Math.sin(a) * r)}`);
  }
  const id = uid('sl');
  const mark = opts.mark === 'tick'
    ? `<path d="M30,52 L44,66 L72,34" stroke="${shade(col, 0.45)}" stroke-width="8"/>`
    : opts.mark === 'quill'
      ? `<path d="M68,28 C72,44 62,58 40,72 L36,74 L40,66 C48,52 56,42 68,28Z" fill="${shade(col, 0.4)}" stroke="${shade(col, -0.3)}" stroke-width="2"/>`
      : `<path d="M50,26 L57,43 L76,45 L62,57 L66,76 L50,66 L34,76 L38,57 L24,45 L43,43Z" fill="${shade(col, 0.4)}" stroke="${shade(col, -0.3)}" stroke-width="2"/>`;
  return wrap('0 0 100 100', `<defs><radialGradient id="${id}" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${shade(col, 0.35)}"/><stop offset=".55" stop-color="${col}"/><stop offset="1" stop-color="${shade(col, -0.4)}"/></radialGradient></defs>
    <polygon points="${pts.join(' ')}" fill="url(#${id})" stroke="${shade(col, -0.55)}" stroke-width="2.2"/>
    <circle cx="50" cy="50" r="33" fill="none" stroke="${shade(col, -0.35)}" stroke-width="3" opacity=".7"/><circle cx="50" cy="50" r="29" fill="none" stroke="${shade(col, 0.3)}" stroke-width="1.2" opacity=".5"/>${mark}`,
  { cls: `vseal ${opts.cls || ''}` });
}

const STAR_PATH = 'M12,2.2 L14.9,8.6 L21.8,9.3 L16.6,13.9 L18.1,20.7 L12,17.2 L5.9,20.7 L7.4,13.9 L2.2,9.3 L9.1,8.6Z';
export function starMarkup(state = 'full', { fill = '#e9b949', empty = 'rgba(36,26,38,.22)' } = {}) {
  const id = uid('st');
  const half = state === 'half' ? `<defs><clipPath id="${id}"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>` : '';
  const base = `<path d="${STAR_PATH}" fill="${state === 'empty' || state === 'half' ? empty : fill}" stroke="${INK}" stroke-width="1.4"/>`;
  const top = state === 'half' ? `<path d="${STAR_PATH}" fill="${fill}" clip-path="url(#${id})" stroke="none"/>` : '';
  return `${half}${base}${top}`;
}

/** A row of stars as one SVG string. stars may be fractional; `max` slots. Each star gets --i for staggered CSS. */
export function starsRowMarkup(stars, { max = 5, size = 22, fill = '#e9b949', empty } = {}) {
  const slots = starSlots(stars, max);
  const parts = slots.map((s, i) => `<g class="vstar ${s}" style="--i:${i}" transform="translate(${i * 24} 0)">${starMarkup(s, { fill, empty })}</g>`);
  return `<svg xmlns="${NS}" viewBox="0 0 ${max * 24} 24" width="${max * size}" height="${size}" class="vstars" role="img" aria-label="${stars} of ${max} stars">${parts.join('')}</svg>`;
}

export function starsEl(stars, opts) {
  const host = document.createElement('span');
  host.className = 'v-stars-wrap';
  host.innerHTML = starsRowMarkup(stars, opts);
  return host.firstElementChild;
}

const HEART_PATH = 'M12,21 C3,14 2,9 2,7 C2,4 4,2.5 6.5,2.5 C9,2.5 11,4 12,6 C13,4 15,2.5 17.5,2.5 C20,2.5 22,4 22,7 C22,9 21,14 12,21Z';
export function heartsRowMarkup(rapport, { max = 5, size = 20 } = {}) {
  const slots = heartSlots(rapport, max);
  const parts = slots.map((s, i) => {
    const id = uid('hc');
    return `<g class="vheart ${s}" style="--i:${i}" transform="translate(${i * 24} 0)">${s === 'half' ? `<defs><clipPath id="${id}"><rect x="0" y="0" width="12" height="24"/></clipPath></defs>` : ''}<path d="${HEART_PATH}" fill="${s === 'empty' || s === 'half' ? 'rgba(36,26,38,.3)' : '#d8546b'}" stroke="${INK}" stroke-width="1.5"/>${s === 'half' ? `<path d="${HEART_PATH}" fill="#d8546b" clip-path="url(#${id})"/>` : ''}</g>`;
  });
  return `<svg xmlns="${NS}" viewBox="0 0 ${max * 24} 24" width="${max * size}" height="${size}" class="vhearts" role="img" aria-label="rapport ${rapport} of ${max}">${parts.join('')}</svg>`;
}

/* small stroke icons (24 grid) for chrome: no emoji */
const IC = {
  warn: 'M12 3.5 2.5 20h19L12 3.5zM12 10v4.5M12 17.2v.3',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5h4a1.7 1.7 0 0 1 0 3.4h-3a1.7 1.7 0 0 0 0 3.4h4.2M12 7.5v1.8M12 16.2V18',
  ticket: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 7v10',
  candle: 'M9 11h6v10H9zM12 3c-2 2.5-2 4 0 5.5 2-1.5 2-3 0-5.5z',
  download: 'M12 3v12M7 11l5 5 5-5M4 20h16',
  arrow: 'M4 12h15M13 6l6 6-6 6',
  back: 'M20 12H5M11 6l-6 6 6 6',
  check: 'M4.5 12.5l5 5 10-11',
  x: 'M6 6l12 12M18 6 6 18',
  skip: 'M5 5v14l9-7zM17 5v14',
  scroll: 'M7 4h11a2 2 0 0 1 2 2v1H9v11a2 2 0 0 1-2 2 2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 7h11v10a2 2 0 0 1-2 2H7',
  quill: 'M20 3C14 4 8 8 6 15l-2 5 5-2c7-2 11-8 11-15zM6 18c2-4 5-7 9-9',
  send: 'M3 11l18-8-8 18-2-8z',
  wagon: 'M3 14h13v-4H3zM16 12h3l2 2v3h-2M7 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 6-6 6-3 0-4.5-2-6-5l-1-2a1.5 1.5 0 0 1 2.5-1.5L8 14',
  heart: HEART_PATH,
  star: STAR_PATH,
};
export function iconMarkup(name, size = 18) {
  return `<svg xmlns="${NS}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="ico ico-${name}" aria-hidden="true"><path d="${IC[name] || IC.star}"/></svg>`;
}
export function icon(name, size = 18) {
  const host = document.createElement('span');
  host.innerHTML = iconMarkup(name, size);
  return host.firstElementChild;
}

/** The gold "Encore" ticket (the rewind token). */
export function encoreMarkup() {
  return wrap('0 0 60 36', `<path d="M4,6 H56 V14 A4,4 0 0 0 56,22 V30 H4 V22 A4,4 0 0 0 4,14Z" fill="#e9b949" stroke="${INK}" stroke-width="2"/><path d="M40,6 V30" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 3"/><path d="M16,23 a7,7 0 1 1 7,-6 M23,17 l-3.5,-2.5 M23,17 l-4,2" stroke="${INK}" stroke-width="2.2"/>`, { cls: 'encore-ticket' });
}

/* ------------------------------------------------------------------------------------------ town sign, misc */

export function signpostMarkup() {
  return wrap('0 0 40 120', `<rect x="17" y="6" width="6" height="112" rx="2" fill="#8a5a3a" stroke="${INK}" stroke-width="1.6"/>`, { cls: 'signpost' });
}

/** Deterministic rosette so every wax-sealed thing looks hand stamped, not cloned. */
export function wobble(seed, amount = 2) {
  return (((hash(seed) % 1000) / 1000) - 0.5) * 2 * amount;
}
