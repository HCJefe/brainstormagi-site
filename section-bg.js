/* Persistent section-level Antigravity background.
   Builds per-section SVG circuit-city checkpoints behind every .sec-bg.
   Independent of WebGL — guarantees the page never reads as empty dark
   space when the Three.js camera frame misses geometry.

   Each variant draws:
     - perspective PCB grid + receding rails
     - cyan/red highway with glowing edges
     - dashed center spine (animated)
     - solder-pad vias with pulses
     - a section-specific futuristic structure silhouette

   Variants by data-bg:
     spire        — Antigravity HQ spire + pylons
     foundry      — agent foundry cluster of stacked rack arrays
     voice        — antenna/dish array with signal arcs
     ops          — ops command tower with radar
     revenue      — reactor / energy core flanked by columns
     content      — broadcast studio with array of screens
     integration  — multi-port hub bridge with branching traces
     contact      — landing pad with twin pylons converging
*/

(function () {
  "use strict";

  /* shared <defs> reused by every variant via xlink references is awkward
     across instanced SVGs, so each SVG embeds its own minimal defs. */
  function defsBlock(idPrefix) {
    return (
      '<defs>' +
      '<linearGradient id="' + idPrefix + '-sky" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#040814" stop-opacity="0"/>' +
        '<stop offset="55%" stop-color="#0a1426" stop-opacity=".55"/>' +
        '<stop offset="100%" stop-color="#02040a" stop-opacity=".95"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + idPrefix + '-road" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#162640" stop-opacity="0"/>' +
        '<stop offset="40%" stop-color="#1a2c4a" stop-opacity=".85"/>' +
        '<stop offset="100%" stop-color="#0a1830" stop-opacity="1"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + idPrefix + '-railC" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#5cf2ff" stop-opacity="0"/>' +
        '<stop offset="60%" stop-color="#5cf2ff" stop-opacity="1"/>' +
        '<stop offset="100%" stop-color="#7ff8ff" stop-opacity="1"/>' +
      '</linearGradient>' +
      '<linearGradient id="' + idPrefix + '-railR" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#ff2a2a" stop-opacity="0"/>' +
        '<stop offset="60%" stop-color="#ff4848" stop-opacity="1"/>' +
        '<stop offset="100%" stop-color="#ff5a5a" stop-opacity="1"/>' +
      '</linearGradient>' +
      '<radialGradient id="' + idPrefix + '-via" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>' +
        '<stop offset="40%" stop-color="#5cf2ff" stop-opacity=".9"/>' +
        '<stop offset="100%" stop-color="#5cf2ff" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="' + idPrefix + '-viaR" cx="0.5" cy="0.5" r="0.5">' +
        '<stop offset="0%" stop-color="#ffe2cc" stop-opacity="1"/>' +
        '<stop offset="40%" stop-color="#ff5a3a" stop-opacity=".9"/>' +
        '<stop offset="100%" stop-color="#ff2a2a" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="' + idPrefix + '-glow" cx="0.5" cy="0.55" r="0.55">' +
        '<stop offset="0%" stop-color="#ff6a3a" stop-opacity=".45"/>' +
        '<stop offset="55%" stop-color="#ff2a2a" stop-opacity=".15"/>' +
        '<stop offset="100%" stop-color="#ff2a2a" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<pattern id="' + idPrefix + '-grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">' +
        '<path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(92,242,255,.10)" stroke-width="1"/>' +
      '</pattern>' +
      '</defs>'
    );
  }

  /* base layer: backdrop, grid, glow, perspective rails, spine, vias.
     Identical layout (1600x900 viewBox) to the hero circuit. */
  function baseBlock(p) {
    return (
      '<rect x="0" y="0" width="1600" height="900" fill="url(#' + p + '-sky)"/>' +
      '<rect x="0" y="380" width="1600" height="520" fill="url(#' + p + '-grid)" opacity=".55"/>' +
      '<ellipse cx="800" cy="540" rx="560" ry="200" fill="url(#' + p + '-glow)"/>' +

      /* circuit-board ground / horizon */
      '<rect x="0" y="540" width="1600" height="360" fill="url(#' + p + '-road)"/>' +

      /* horizon trace lines (PCB grid receding) */
      '<g stroke="rgba(92,242,255,.18)" stroke-width="1" fill="none">' +
        '<line x1="0" y1="560" x2="1600" y2="560"/>' +
        '<line x1="0" y1="600" x2="1600" y2="600"/>' +
        '<line x1="0" y1="650" x2="1600" y2="650"/>' +
        '<line x1="0" y1="710" x2="1600" y2="710"/>' +
        '<line x1="0" y1="780" x2="1600" y2="780"/>' +
        '<line x1="0" y1="860" x2="1600" y2="860"/>' +
      '</g>' +
      '<g stroke="rgba(255,42,42,.14)" stroke-width="1" fill="none">' +
        '<line x1="0" y1="620" x2="1600" y2="620"/>' +
        '<line x1="0" y1="680" x2="1600" y2="680"/>' +
        '<line x1="0" y1="745" x2="1600" y2="745"/>' +
        '<line x1="0" y1="820" x2="1600" y2="820"/>' +
      '</g>' +

      /* trace branches off the highway */
      '<g stroke="rgba(92,242,255,.55)" stroke-width="2" fill="none">' +
        '<path d="M 200 900 L 200 760 L 360 760 L 360 700"/>' +
        '<path d="M 1400 900 L 1400 760 L 1240 760 L 1240 700"/>' +
        '<path d="M 480 900 L 480 820 L 620 820"/>' +
        '<path d="M 1120 900 L 1120 820 L 980 820"/>' +
      '</g>' +
      '<g stroke="rgba(255,42,42,.5)" stroke-width="2" fill="none">' +
        '<path d="M 80 900 L 80 700 L 280 700"/>' +
        '<path d="M 1520 900 L 1520 700 L 1320 700"/>' +
      '</g>' +

      /* solder-pad vias along trace branches */
      '<g>' +
        '<circle cx="200" cy="760" r="9" fill="url(#' + p + '-via)"/>' +
        '<circle cx="360" cy="700" r="7" fill="url(#' + p + '-via)"/>' +
        '<circle cx="1400" cy="760" r="9" fill="url(#' + p + '-via)"/>' +
        '<circle cx="1240" cy="700" r="7" fill="url(#' + p + '-via)"/>' +
        '<circle cx="280" cy="700" r="7" fill="url(#' + p + '-viaR)"/>' +
        '<circle cx="1320" cy="700" r="7" fill="url(#' + p + '-viaR)"/>' +
        '<circle cx="620" cy="820" r="6" fill="url(#' + p + '-via)"/>' +
        '<circle cx="980" cy="820" r="6" fill="url(#' + p + '-via)"/>' +
      '</g>'
    );
  }

  function highwayBlock(p) {
    return (
      /* electrified circuit-board highway core, perspective converging */
      '<polygon points="720,560 880,560 1080,900 520,900" fill="#0e1c34" opacity=".95"/>' +
      '<polygon points="740,560 860,560 1020,900 580,900" fill="#162a48" opacity=".9"/>' +

      /* dashed center spine */
      '<g class="sb-spine" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".95">' +
        '<line x1="800" y1="572" x2="800" y2="588"/>' +
        '<line x1="800" y1="612" x2="800" y2="634"/>' +
        '<line x1="800" y1="660" x2="800" y2="688"/>' +
        '<line x1="800" y1="716" x2="800" y2="752"/>' +
        '<line x1="800" y1="780" x2="800" y2="824"/>' +
        '<line x1="800" y1="852" x2="800" y2="900"/>' +
      '</g>' +

      /* cyan rail (left edge) */
      '<polygon points="720,560 730,560 595,900 575,900" fill="url(#' + p + '-railC)"/>' +
      /* red rail (right edge) */
      '<polygon points="870,560 880,560 1025,900 1005,900" fill="url(#' + p + '-railR)"/>' +

      /* pulsing pads at the highway entry */
      '<circle class="sb-pulse" cx="800" cy="610" r="14" fill="none" stroke="#5cf2ff" stroke-width="2"/>' +
      '<circle class="sb-pulse sb-pulse-2" cx="800" cy="730" r="22" fill="none" stroke="#ff4848" stroke-width="2"/>' +
      '<circle class="sb-pulse sb-pulse-3" cx="800" cy="850" r="34" fill="none" stroke="#5cf2ff" stroke-width="2"/>' +
      '<circle cx="800" cy="610" r="4" fill="#fff"/>' +
      '<circle cx="800" cy="730" r="5" fill="#fff"/>' +
      '<circle cx="800" cy="850" r="6" fill="#fff"/>'
    );
  }

  /* low-row distant skyline silhouette shared between every variant */
  function skylineBlock() {
    return (
      '<g class="sb-city" opacity=".82">' +
        '<rect x="40"   y="450" width="60" height="100" fill="#0a1426" stroke="rgba(92,242,255,.3)"/>' +
        '<rect x="120"  y="420" width="40" height="130" fill="#0a1426" stroke="rgba(92,242,255,.28)"/>' +
        '<rect x="180"  y="460" width="80" height="90"  fill="#0a1426" stroke="rgba(92,242,255,.26)"/>' +
        '<rect x="280"  y="430" width="50" height="120" fill="#0a1426" stroke="rgba(92,242,255,.30)"/>' +
        '<rect x="1280" y="450" width="60" height="100" fill="#0a1426" stroke="rgba(92,242,255,.30)"/>' +
        '<rect x="1360" y="420" width="42" height="130" fill="#0a1426" stroke="rgba(92,242,255,.28)"/>' +
        '<rect x="1430" y="460" width="78" height="90"  fill="#0a1426" stroke="rgba(92,242,255,.26)"/>' +
        '<rect x="1530" y="430" width="50" height="120" fill="#0a1426" stroke="rgba(92,242,255,.30)"/>' +
      '</g>'
    );
  }

  /* per-section structure overlays. Each is a futuristic silhouette + glow.
     Coordinates use 1600x900 viewBox. Structures sit beside / behind the
     content panel area which lives roughly in the center band. */
  const STRUCTURES = {
    spire: function () {
      /* Antigravity HQ spire — floating triangular tower with antenna */
      return (
        '<g class="sb-struct">' +
          /* left supporting tower */
          '<rect x="200" y="300" width="70" height="250" fill="#0e1c30" stroke="rgba(92,242,255,.55)" stroke-width="1.5"/>' +
          '<g fill="#5cf2ff" opacity=".85">' +
            '<rect x="208" y="330" width="54" height="2"/>' +
            '<rect x="208" y="365" width="54" height="2"/>' +
            '<rect x="208" y="400" width="54" height="2"/>' +
            '<rect x="208" y="440" width="54" height="2"/>' +
            '<rect x="208" y="480" width="54" height="2"/>' +
          '</g>' +
          '<line x1="235" y1="300" x2="235" y2="240" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="235" cy="240" r="5" fill="#ff4848"/>' +
          /* main spire — floating tetrahedron HQ */
          '<polygon points="1320,500 1380,180 1440,500" fill="#101e34" stroke="rgba(92,242,255,.7)" stroke-width="1.6"/>' +
          '<polygon points="1320,500 1380,300 1440,500" fill="#162a48" stroke="rgba(92,242,255,.4)" stroke-width="1"/>' +
          '<line x1="1380" y1="180" x2="1380" y2="120" stroke="#5cf2ff" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="1380" cy="120" r="6" fill="#fff"/>' +
          '<circle cx="1380" cy="120" r="14" fill="none" stroke="#5cf2ff" stroke-width="1.4" opacity=".7"/>' +
          '<circle cx="1380" cy="120" r="22" fill="none" stroke="#5cf2ff" stroke-width="1" opacity=".4"/>' +
          /* anti-gravity ring under the spire */
          '<ellipse cx="1380" cy="510" rx="120" ry="14" fill="none" stroke="#5cf2ff" stroke-width="2" opacity=".7"/>' +
          '<ellipse cx="1380" cy="520" rx="80"  ry="9"  fill="none" stroke="#ff4848" stroke-width="1.5" opacity=".6"/>' +
        '</g>'
      );
    },
    foundry: function () {
      /* Stacked rack arrays — the AI agent foundry */
      let g = '<g class="sb-struct">';
      /* left rack cluster */
      for (let i = 0; i < 5; i++) {
        const y = 320 + i * 44;
        g += '<rect x="180" y="' + y + '" width="220" height="34" fill="#0c1a2c" stroke="rgba(92,242,255,.45)"/>' +
             '<rect x="186" y="' + (y + 6) + '" width="6" height="22" fill="#5cf2ff" opacity=".85"/>' +
             '<rect x="200" y="' + (y + 6) + '" width="190" height="2" fill="rgba(92,242,255,.35)"/>' +
             '<rect x="200" y="' + (y + 14) + '" width="160" height="2" fill="rgba(255,42,42,.4)"/>' +
             '<rect x="200" y="' + (y + 22) + '" width="140" height="2" fill="rgba(92,242,255,.3)"/>';
      }
      /* right rack cluster */
      for (let i = 0; i < 4; i++) {
        const y = 340 + i * 50;
        g += '<rect x="1220" y="' + y + '" width="240" height="40" fill="#0c1a2c" stroke="rgba(255,42,42,.45)"/>' +
             '<rect x="1226" y="' + (y + 7) + '" width="6" height="26" fill="#ff4848" opacity=".85"/>' +
             '<rect x="1240" y="' + (y + 8) + '" width="200" height="2" fill="rgba(92,242,255,.35)"/>' +
             '<rect x="1240" y="' + (y + 18) + '" width="170" height="2" fill="rgba(255,42,42,.4)"/>' +
             '<rect x="1240" y="' + (y + 28) + '" width="140" height="2" fill="rgba(92,242,255,.3)"/>';
      }
      /* energy column linking the clusters */
      g += '<line x1="290" y1="320" x2="290" y2="240" stroke="#5cf2ff" stroke-width="2"/>' +
           '<circle class="sb-beacon" cx="290" cy="240" r="5" fill="#fff"/>' +
           '<line x1="1340" y1="340" x2="1340" y2="250" stroke="#ff4848" stroke-width="2"/>' +
           '<circle class="sb-beacon" cx="1340" cy="250" r="5" fill="#ff4848"/>' +
           '</g>';
      return g;
    },
    voice: function () {
      /* Antenna / dish array with signal arcs */
      return (
        '<g class="sb-struct">' +
          /* left dish */
          '<path d="M 200 540 Q 260 360 320 540 Z" fill="#101e34" stroke="rgba(92,242,255,.6)" stroke-width="1.5"/>' +
          '<line x1="260" y1="430" x2="260" y2="540" stroke="rgba(92,242,255,.5)" stroke-width="1.5"/>' +
          '<circle cx="260" cy="430" r="4" fill="#5cf2ff"/>' +
          /* mid relay */
          '<rect x="240" y="540" width="40" height="20" fill="#0c1a2c" stroke="rgba(92,242,255,.5)"/>' +
          /* right antenna mast */
          '<rect x="1280" y="320" width="20" height="230" fill="#101e34" stroke="rgba(255,42,42,.55)"/>' +
          '<rect x="1260" y="320" width="60" height="6" fill="rgba(92,242,255,.3)"/>' +
          '<rect x="1255" y="360" width="70" height="4" fill="rgba(92,242,255,.4)"/>' +
          '<rect x="1250" y="400" width="80" height="6" fill="rgba(92,242,255,.5)"/>' +
          '<rect x="1245" y="440" width="90" height="4" fill="rgba(92,242,255,.4)"/>' +
          '<line x1="1290" y1="320" x2="1290" y2="240" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="1290" cy="240" r="5" fill="#ff4848"/>' +
          /* signal arcs from antenna */
          '<g fill="none" stroke="#5cf2ff" stroke-width="1.5" opacity=".6">' +
            '<path d="M 1300 320 Q 1380 260 1460 320"/>' +
            '<path d="M 1300 320 Q 1410 230 1520 320"/>' +
            '<path d="M 1300 320 Q 1440 200 1580 320"/>' +
          '</g>' +
          /* small ground stations along the road branches */
          '<rect x="100" y="540" width="40" height="20" fill="#0c1a2c" stroke="rgba(92,242,255,.4)"/>' +
          '<rect x="1430" y="540" width="40" height="20" fill="#0c1a2c" stroke="rgba(255,42,42,.45)"/>' +
        '</g>'
      );
    },
    ops: function () {
      /* Ops command tower with rotating radar */
      return (
        '<g class="sb-struct">' +
          /* command tower right */
          '<rect x="1240" y="220" width="120" height="330" fill="#101e34" stroke="rgba(92,242,255,.6)" stroke-width="1.5"/>' +
          '<g fill="#5cf2ff" opacity=".85">' +
            '<rect x="1252" y="260" width="96" height="2"/>' +
            '<rect x="1252" y="300" width="96" height="2"/>' +
            '<rect x="1252" y="340" width="96" height="2"/>' +
            '<rect x="1252" y="380" width="96" height="2"/>' +
            '<rect x="1252" y="420" width="96" height="2"/>' +
            '<rect x="1252" y="460" width="96" height="2"/>' +
            '<rect x="1252" y="500" width="96" height="2"/>' +
          '</g>' +
          /* radar dome */
          '<path d="M 1230 220 Q 1300 170 1370 220 Z" fill="#162a48" stroke="rgba(92,242,255,.7)" stroke-width="1.5"/>' +
          '<circle cx="1300" cy="200" r="4" fill="#5cf2ff"/>' +
          /* radar sweep arcs */
          '<path d="M 1200 200 A 100 100 0 0 1 1300 100" fill="none" stroke="rgba(92,242,255,.5)" stroke-width="1.5"/>' +
          '<line x1="1300" y1="200" x2="1300" y2="120" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="1300" cy="120" r="5" fill="#ff4848"/>' +
          /* left telemetry stacks */
          '<rect x="160" y="380" width="50" height="170" fill="#0c1a2c" stroke="rgba(92,242,255,.5)"/>' +
          '<rect x="220" y="350" width="50" height="200" fill="#0c1a2c" stroke="rgba(92,242,255,.45)"/>' +
          '<rect x="280" y="400" width="50" height="150" fill="#0c1a2c" stroke="rgba(92,242,255,.42)"/>' +
          '<g fill="#5cf2ff" opacity=".75">' +
            '<rect x="170" y="395" width="30" height="2"/>' +
            '<rect x="170" y="420" width="30" height="2"/>' +
            '<rect x="170" y="445" width="30" height="2"/>' +
            '<rect x="230" y="370" width="30" height="2"/>' +
            '<rect x="230" y="395" width="30" height="2"/>' +
            '<rect x="230" y="420" width="30" height="2"/>' +
          '</g>' +
        '</g>'
      );
    },
    revenue: function () {
      /* Reactor / energy core flanked by cooling columns */
      return (
        '<g class="sb-struct">' +
          /* core reactor right side */
          '<circle cx="1300" cy="430" r="100" fill="#0e1c30" stroke="rgba(255,42,42,.65)" stroke-width="1.6"/>' +
          '<circle cx="1300" cy="430" r="70"  fill="none" stroke="rgba(255,42,42,.55)" stroke-width="1.4"/>' +
          '<circle cx="1300" cy="430" r="42"  fill="none" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="1300" cy="430" r="14" fill="#ff5a3a"/>' +
          '<line x1="1200" y1="430" x2="1400" y2="430" stroke="rgba(255,42,42,.5)"/>' +
          '<line x1="1300" y1="330" x2="1300" y2="530" stroke="rgba(92,242,255,.45)"/>' +
          /* cooling columns flanking reactor */
          '<rect x="1180" y="320" width="30" height="220" fill="#101e34" stroke="rgba(92,242,255,.55)"/>' +
          '<rect x="1390" y="320" width="30" height="220" fill="#101e34" stroke="rgba(92,242,255,.55)"/>' +
          /* left vault stacks (where the cash is) */
          '<rect x="180" y="380" width="80" height="170" fill="#0c1a2c" stroke="rgba(92,242,255,.5)"/>' +
          '<rect x="270" y="340" width="80" height="210" fill="#0c1a2c" stroke="rgba(92,242,255,.5)"/>' +
          '<g fill="#5cf2ff" opacity=".75">' +
            '<rect x="190" y="400" width="60" height="2"/>' +
            '<rect x="190" y="430" width="60" height="2"/>' +
            '<rect x="190" y="460" width="60" height="2"/>' +
            '<rect x="280" y="360" width="60" height="2"/>' +
            '<rect x="280" y="390" width="60" height="2"/>' +
            '<rect x="280" y="420" width="60" height="2"/>' +
            '<rect x="280" y="450" width="60" height="2"/>' +
          '</g>' +
        '</g>'
      );
    },
    content: function () {
      /* Broadcast studio — array of screens / projection grid */
      let g = '<g class="sb-struct">';
      /* big screen wall right */
      g += '<rect x="1180" y="280" width="280" height="220" fill="#0c1a2c" stroke="rgba(92,242,255,.6)" stroke-width="1.5"/>';
      const cols = 4, rows = 3;
      const cw = 270 / cols, rh = 210 / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = 1185 + c * cw + 2;
          const y = 285 + r * rh + 2;
          g += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + (cw - 4).toFixed(0) +
               '" height="' + (rh - 4).toFixed(0) + '" fill="#162a48" stroke="rgba(92,242,255,.4)"/>';
        }
      }
      /* studio mast / camera rig */
      g += '<line x1="1320" y1="280" x2="1320" y2="200" stroke="#ff4848" stroke-width="2"/>' +
           '<circle class="sb-beacon" cx="1320" cy="200" r="5" fill="#ff4848"/>' +
           /* left projector tower */
           '<rect x="180" y="320" width="60" height="230" fill="#101e34" stroke="rgba(92,242,255,.55)"/>' +
           '<polygon points="240,360 320,330 320,420 240,400" fill="#162a48" stroke="rgba(92,242,255,.55)"/>' +
           '<g fill="none" stroke="rgba(92,242,255,.35)" stroke-width="1">' +
             '<line x1="320" y1="375" x2="520" y2="350"/>' +
             '<line x1="320" y1="375" x2="520" y2="400"/>' +
           '</g>' +
           '</g>';
      return g;
    },
    integration: function () {
      /* Integration hub — multi-port bridge with branching traces */
      return (
        '<g class="sb-struct">' +
          /* central hub bridge */
          '<rect x="180" y="360" width="220" height="60" fill="#0c1a2c" stroke="rgba(92,242,255,.6)"/>' +
          '<rect x="1200" y="360" width="240" height="60" fill="#0c1a2c" stroke="rgba(92,242,255,.6)"/>' +
          /* port leds */
          '<g fill="#5cf2ff" opacity=".9">' +
            '<circle cx="200" cy="390" r="5"/>' +
            '<circle cx="225" cy="390" r="5"/>' +
            '<circle cx="250" cy="390" r="5"/>' +
            '<circle cx="275" cy="390" r="5"/>' +
            '<circle cx="300" cy="390" r="5"/>' +
            '<circle cx="325" cy="390" r="5"/>' +
            '<circle cx="350" cy="390" r="5"/>' +
            '<circle cx="375" cy="390" r="5"/>' +
            '<circle cx="1220" cy="390" r="5"/>' +
            '<circle cx="1245" cy="390" r="5"/>' +
            '<circle cx="1270" cy="390" r="5"/>' +
            '<circle cx="1295" cy="390" r="5"/>' +
            '<circle cx="1320" cy="390" r="5"/>' +
            '<circle cx="1345" cy="390" r="5"/>' +
            '<circle cx="1370" cy="390" r="5"/>' +
            '<circle cx="1395" cy="390" r="5"/>' +
            '<circle cx="1420" cy="390" r="5"/>' +
          '</g>' +
          /* bridge supports */
          '<line x1="200" y1="420" x2="200" y2="540" stroke="rgba(92,242,255,.5)"/>' +
          '<line x1="380" y1="420" x2="380" y2="540" stroke="rgba(92,242,255,.5)"/>' +
          '<line x1="1220" y1="420" x2="1220" y2="540" stroke="rgba(92,242,255,.5)"/>' +
          '<line x1="1420" y1="420" x2="1420" y2="540" stroke="rgba(92,242,255,.5)"/>' +
          /* mast over center hub */
          '<line x1="290" y1="360" x2="290" y2="270" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="290" cy="270" r="5" fill="#ff4848"/>' +
          '<line x1="1320" y1="360" x2="1320" y2="270" stroke="#ff4848" stroke-width="2"/>' +
          '<circle class="sb-beacon" cx="1320" cy="270" r="5" fill="#ff4848"/>' +
          /* branching traces above the bridges */
          '<g stroke="rgba(92,242,255,.45)" stroke-width="1.4" fill="none">' +
            '<path d="M 100 420 L 100 460 L 180 460"/>' +
            '<path d="M 60 420 L 60 480 L 180 480"/>' +
            '<path d="M 1500 420 L 1500 460 L 1440 460"/>' +
            '<path d="M 1540 420 L 1540 480 L 1440 480"/>' +
          '</g>' +
        '</g>'
      );
    },
    contact: function () {
      /* Landing pad — twin pylons converging on the highway */
      return (
        '<g class="sb-struct">' +
          /* twin pylons left and right of center */
          '<polygon points="500,540 540,260 580,260 620,540" fill="#0e1c30" stroke="rgba(92,242,255,.65)" stroke-width="1.5"/>' +
          '<polygon points="980,540 1020,260 1060,260 1100,540" fill="#0e1c30" stroke="rgba(255,42,42,.65)" stroke-width="1.5"/>' +
          '<line x1="560" y1="540" x2="560" y2="240" stroke="#5cf2ff" stroke-width="2" opacity=".85"/>' +
          '<line x1="1040" y1="540" x2="1040" y2="240" stroke="#ff4848" stroke-width="2" opacity=".85"/>' +
          '<circle class="sb-beacon" cx="560" cy="240" r="6" fill="#fff"/>' +
          '<circle cx="560" cy="240" r="14" fill="none" stroke="#5cf2ff" stroke-width="1.4" opacity=".7"/>' +
          '<circle class="sb-beacon" cx="1040" cy="240" r="6" fill="#ff4848"/>' +
          '<circle cx="1040" cy="240" r="14" fill="none" stroke="#ff4848" stroke-width="1.4" opacity=".7"/>' +
          /* landing pad ring on the highway */
          '<ellipse cx="800" cy="780" rx="220" ry="34" fill="none" stroke="#5cf2ff" stroke-width="2" opacity=".75"/>' +
          '<ellipse cx="800" cy="780" rx="160" ry="22" fill="none" stroke="#ff4848" stroke-width="1.5" opacity=".6"/>' +
          /* arrival arrows on the rails */
          '<g fill="#fff" opacity=".7">' +
            '<polygon points="660,800 690,790 690,810"/>' +
            '<polygon points="940,800 910,790 910,810"/>' +
          '</g>' +
        '</g>'
      );
    }
  };

  function svgFor(variant) {
    const builder = STRUCTURES[variant] || STRUCTURES.spire;
    const p = "sb" + variant.slice(0, 4);
    return (
      '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">' +
        defsBlock(p) +
        baseBlock(p) +
        skylineBlock() +
        builder() +
        highwayBlock(p) +
      '</svg>'
    );
  }

  function paint() {
    const nodes = document.querySelectorAll(".sec-bg[data-bg]");
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.dataset.painted === "1") continue;
      const variant = el.getAttribute("data-bg") || "spire";
      el.innerHTML = svgFor(variant);
      el.dataset.painted = "1";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paint);
  } else {
    paint();
  }
})();
