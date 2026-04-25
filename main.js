// Brainstorm AGI — self-contained Canvas2D electric-circuit fly-through.
// No remote module dependencies. Loaded as a classic script. Runs on every
// section, drives a perspective road through a circuit-board world with
// PCB traces, electric buildings, and animated packets. Also wires the
// agent wall, mobile nav, scroll progress rail, and section reveal.
import { DISTRICTS, AGENT_SAMPLE } from "./districts.js";

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Canvas + DPR sizing. We render into #scene; #scene-fallback stays
  // hidden in normal operation but we keep it as a last-resort net.
  // ------------------------------------------------------------------
  const canvas = document.getElementById("scene");
  if (!canvas) {
    document.documentElement.dataset.sceneEngine = "missing-canvas";
    return;
  }
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    document.documentElement.dataset.sceneEngine = "no-2d-context";
    return;
  }

  const COLOR = {
    bg0: "#02040a",
    bg1: "#070d1c",
    bg2: "#0b1830",
    pcbDark: "#0a1426",
    pcbMid: "#0c1a2e",
    pcbLite: "#101e34",
    cyan: "#5cf2ff",
    cyanSoft: "rgba(92,242,255,0.55)",
    cyanFaint: "rgba(92,242,255,0.18)",
    red: "#ff2a2a",
    redSoft: "rgba(255,42,42,0.55)",
    redFaint: "rgba(255,42,42,0.16)",
    orange: "#ff7a3a",
    white: "#ffffff",
    star: "rgba(170,200,255,0.85)",
    copper: "rgba(192,68,40,0.45)"
  };

  let viewW = 0, viewH = 0, dpr = 1;
  let isMobile = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    isMobile = viewW <= 640;
    canvas.width = Math.max(2, Math.floor(viewW * dpr));
    canvas.height = Math.max(2, Math.floor(viewH * dpr));
    canvas.style.width = viewW + "px";
    canvas.style.height = viewH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ------------------------------------------------------------------
  // Scene seeds. One-time random data so the world reads stable across
  // frames. Counts reduce on mobile.
  // ------------------------------------------------------------------
  const stars = [];
  const packets = [];
  const traces = [];
  const vias = [];

  function seed() {
    stars.length = 0;
    const starCount = isMobile ? 110 : 240;
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.5,
        s: Math.random() * 1.4 + 0.3,
        ph: Math.random() * Math.PI * 2
      });
    }
    packets.length = 0;
    const packetCount = isMobile ? 60 : 130;
    for (let p = 0; p < packetCount; p++) {
      packets.push({
        z: Math.random(),
        lane: (Math.random() < 0.5 ? -1 : 1) * (0.05 + Math.random() * 0.55),
        rail: Math.random() < 0.45,
        speed: 0.10 + Math.random() * 0.30,
        cmd: Math.random() < 0.10
      });
    }
    // PCB trace branches off the road. Each is a polyline in normalized
    // ground space (x in -1..1, z in 0..1, where 0 is horizon).
    traces.length = 0;
    const traceCount = isMobile ? 10 : 18;
    for (let i = 0; i < traceCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const baseZ = 0.18 + (i / traceCount) * 0.78;
      const pts = [];
      let x = side * (0.18 + Math.random() * 0.05);
      let z = baseZ;
      pts.push([x, z]);
      // Right-angle steps outward, three or four segments.
      const steps = 3 + Math.floor(Math.random() * 2);
      for (let s = 0; s < steps; s++) {
        if (s % 2 === 0) x = x + side * (0.18 + Math.random() * 0.45);
        else z = Math.max(0.05, Math.min(0.99, z + (Math.random() - 0.5) * 0.18));
        pts.push([x, z]);
      }
      traces.push({
        pts,
        color: i % 3 === 0 ? COLOR.red : COLOR.cyan,
        ph: Math.random() * Math.PI * 2
      });
    }
    // Solder vias scattered on the substrate.
    vias.length = 0;
    const viaCount = isMobile ? 22 : 40;
    for (let v = 0; v < viaCount; v++) {
      vias.push({
        x: (Math.random() * 2 - 1) * 1.2,
        z: 0.08 + Math.random() * 0.92,
        red: Math.random() < 0.32,
        ph: Math.random() * Math.PI * 2
      });
    }
  }

  // ------------------------------------------------------------------
  // Perspective projection. The road runs from horizon (zNorm=0) toward
  // the viewer (zNorm=1). xLane is in road-half units (-1.5..+1.5 covers
  // a wide lateral band including off-road buildings). Adds a banking
  // sway driven by time + scroll so the road never sits dead-center.
  // ------------------------------------------------------------------
  let camBank = 0;        // lateral pan in screen pixels
  let camPitch = 0;       // horizon offset in pixels
  function updateCamera(t, scrollFrac) {
    // Slow lateral sway plus a section-aware shift.
    const sway = Math.sin(t * 0.35) * (isMobile ? 18 : 36);
    const sectionShift = Math.sin(scrollFrac * Math.PI * 2) * (isMobile ? 14 : 28);
    camBank = sway + sectionShift;
    camPitch = Math.cos(t * 0.22) * (isMobile ? 6 : 14) - scrollFrac * (isMobile ? 18 : 32);
  }

  function project(zNorm, xLane) {
    const t = Math.max(0, Math.min(1, zNorm));
    const horizonY = viewH * 0.46 + camPitch;
    const fgY = viewH + 40;
    // Quadratic so foreground stretches; gives stronger perspective.
    const tt = t * t * 0.9 + t * 0.1;
    const y = horizonY + (fgY - horizonY) * tt;
    const halfNarrow = viewW * 0.014;
    const halfWide = viewW * 0.78;
    const halfW = halfNarrow + (halfWide - halfNarrow) * tt;
    // Horizontal vanishing point swings with camBank for the flying feel.
    const vx = viewW * 0.5 + camBank * (1 - tt);
    return { x: vx + xLane * halfW, y, halfW, t: tt, horizonY };
  }

  // ------------------------------------------------------------------
  // Draw helpers
  // ------------------------------------------------------------------
  function fillRadialGlow(x, y, r, inner, outer) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSky(t, scrollFrac) {
    // Soft red sun glow + cyan horizon haze.
    const horizonY = viewH * 0.46 + camPitch;
    const cx = viewW * 0.5 + Math.sin(t * 0.18) * (isMobile ? 30 : 80);
    const cy = horizonY - viewH * 0.04;
    fillRadialGlow(cx, cy, viewW * 0.55, "rgba(255,90,58,0.22)", "rgba(255,42,42,0)");
    const grad = ctx.createLinearGradient(0, horizonY - viewH * 0.07, 0, horizonY + viewH * 0.05);
    grad.addColorStop(0, "rgba(92,242,255,0)");
    grad.addColorStop(0.55, "rgba(92,242,255,0.12)");
    grad.addColorStop(1, "rgba(92,242,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY - viewH * 0.07, viewW, viewH * 0.12);
  }

  function drawStars(t) {
    const horizonY = viewH * 0.46 + camPitch;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const sx = (s.x * viewW + camBank * 0.4 * (1 - s.y)) % viewW;
      const sy = s.y * horizonY;
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.ph));
      ctx.fillStyle = "rgba(170,200,255," + a.toFixed(3) + ")";
      ctx.fillRect(sx, sy, s.s, s.s);
    }
  }

  // ------------------------------------------------------------------
  // Buildings. 8 archetypes keyed by district id. Each archetype is a
  // recipe that draws a pseudo-3D building at a given screen footprint.
  // We render 2 staggered rows per side along the road, parallaxed by
  // scroll so we feel like we are flying past them.
  // ------------------------------------------------------------------
  const ARCHETYPES = ["spire", "foundry", "voice", "ops", "revenue", "content", "integration", "contact"];

  function chooseArchetype(districtIndex) {
    const id = DISTRICTS[((districtIndex % DISTRICTS.length) + DISTRICTS.length) % DISTRICTS.length].id;
    return id;
  }

  function drawWindowGrid(x, y, w, h, color, rows, cols, t, ph) {
    const cw = w / cols;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const flick = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.2 + r * 1.7 + c * 0.9 + ph));
        ctx.fillStyle = color === COLOR.red
          ? "rgba(255,90,90," + (flick * 0.85).toFixed(3) + ")"
          : "rgba(150,240,255," + (flick * 0.9).toFixed(3) + ")";
        const px = x + c * cw + cw * 0.18;
        const py = y + r * rh + rh * 0.22;
        ctx.fillRect(px, py, Math.max(1, cw * 0.64), Math.max(1, rh * 0.42));
      }
    }
  }

  function drawBuilding(kind, footX, footY, scale, color, t, seed) {
    // Footprint is one screen-pixel scale unit. Buildings are anchored
    // at footY (ground line) and grow upward.
    const w = Math.max(8, scale * (kind === "spire" ? 1.2 : kind === "foundry" ? 2.4 : kind === "voice" ? 1.6 : kind === "ops" ? 2.6 : kind === "revenue" ? 2.0 : kind === "content" ? 2.2 : kind === "integration" ? 2.4 : 2.0));
    const h = Math.max(14, scale * (kind === "spire" ? 7.5 : kind === "foundry" ? 4.5 : kind === "voice" ? 6.0 : kind === "ops" ? 5.5 : kind === "revenue" ? 4.0 : kind === "content" ? 4.8 : kind === "integration" ? 5.0 : 3.0));
    const x = footX - w * 0.5;
    const y = footY - h;
    const accent = color || COLOR.cyan;
    const accentRGBA = accent === COLOR.red ? "rgba(255,42,42," : "rgba(92,242,255,";
    const ph = (seed || 0) * 0.4;

    // Body
    ctx.fillStyle = COLOR.pcbLite;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accentRGBA + "0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));

    if (kind === "spire") {
      // Tall pylon with antenna and beacon halo
      drawWindowGrid(x, y, w, h, accent, Math.max(4, Math.floor(h / 12)), 2, t, ph);
      ctx.strokeStyle = accentRGBA + "0.85)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(footX, y);
      ctx.lineTo(footX, y - h * 0.35);
      ctx.stroke();
      const beaconY = y - h * 0.35;
      fillRadialGlow(footX, beaconY, w * 0.9, accentRGBA + "0.9)", accentRGBA + "0)");
      ctx.fillStyle = COLOR.white;
      ctx.beginPath(); ctx.arc(footX, beaconY, Math.max(1, w * 0.14), 0, Math.PI * 2); ctx.fill();
      // Halo ring pulses
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.4 + ph));
      ctx.strokeStyle = accentRGBA + (0.65 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(footX, beaconY, w * (0.4 + pulse * 0.6), 0, Math.PI * 2); ctx.stroke();
    } else if (kind === "foundry") {
      // Wide industrial shed with 4 stack chimneys spitting embers
      drawWindowGrid(x, y, w, h, accent, 3, 5, t, ph);
      const stackW = w * 0.08;
      for (let i = 0; i < 4; i++) {
        const sx = x + (i + 1) * w / 5 - stackW * 0.5;
        ctx.fillStyle = COLOR.pcbDark;
        ctx.fillRect(sx, y - h * 0.25, stackW, h * 0.25);
        const spark = 0.5 + 0.5 * Math.sin(t * 3 + i + ph);
        ctx.fillStyle = "rgba(255,122,58," + (spark * 0.9).toFixed(3) + ")";
        ctx.fillRect(sx, y - h * 0.27, stackW, 2);
      }
    } else if (kind === "voice") {
      // Antenna array: tall thin tower with 3 dish satellites + signal arcs
      drawWindowGrid(x, y, w, h, accent, Math.max(3, Math.floor(h / 14)), 1, t, ph);
      const mastTop = y - h * 0.45;
      ctx.strokeStyle = accentRGBA + "0.9)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(footX, y); ctx.lineTo(footX, mastTop); ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const dy = mastTop + i * (h * 0.12);
        ctx.fillStyle = COLOR.white;
        ctx.fillRect(footX - w * 0.6, dy - 1, w * 1.2, 2);
        const arc = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.4 + ph);
        ctx.strokeStyle = accentRGBA + (0.5 * arc).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(footX, dy, w * (0.7 + arc * 0.5), -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
      }
    } else if (kind === "ops") {
      // Ops tower: stacked dashboard floors with ticker bars
      const floors = Math.max(5, Math.floor(h / 10));
      for (let f = 0; f < floors; f++) {
        const fy = y + (f / floors) * h;
        ctx.fillStyle = f % 2 === 0 ? "rgba(92,242,255,0.10)" : "rgba(255,42,42,0.08)";
        ctx.fillRect(x + 1, fy, w - 2, h / floors - 1);
        // Ticker bar
        const barW = ((Math.sin(t * 1.2 + f * 0.6 + ph) * 0.5 + 0.5) * 0.7 + 0.2) * (w - 4);
        ctx.fillStyle = f % 3 === 0 ? COLOR.red : COLOR.cyan;
        ctx.fillRect(x + 2, fy + 1, barW, 1);
      }
    } else if (kind === "revenue") {
      // Revenue reactor: hex-ish dome with pulsing core
      drawWindowGrid(x, y, w, h * 0.7, accent, 3, 4, t, ph);
      const coreX = footX;
      const coreY = y + h * 0.35;
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2.6 + ph));
      fillRadialGlow(coreX, coreY, w * 0.6 * pulse, "rgba(247,200,67,0.85)", "rgba(247,200,67,0)");
      ctx.fillStyle = COLOR.orange;
      ctx.beginPath(); ctx.arc(coreX, coreY, Math.max(2, w * 0.14), 0, Math.PI * 2); ctx.fill();
      // Energy columns rising
      ctx.strokeStyle = "rgba(255,122,58,0.7)";
      ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(footX + i * w * 0.3, y + h);
        ctx.lineTo(footX + i * w * 0.3, y);
        ctx.stroke();
      }
    } else if (kind === "content") {
      // Studio: stacked screens with scanline content
      const panels = Math.max(4, Math.floor(h / 14));
      for (let pIdx = 0; pIdx < panels; pIdx++) {
        const py = y + (pIdx / panels) * h;
        const ph2 = h / panels - 2;
        ctx.fillStyle = "rgba(255,122,58,0.10)";
        ctx.fillRect(x + 2, py + 1, w - 4, ph2);
        ctx.strokeStyle = COLOR.orange;
        ctx.lineWidth = 1;
        const lineY = py + 1 + ph2 * (0.5 + 0.4 * Math.sin(t * 4 + pIdx + ph));
        ctx.beginPath();
        ctx.moveTo(x + 3, lineY);
        ctx.lineTo(x + w - 3, lineY);
        ctx.stroke();
      }
    } else if (kind === "integration") {
      // Hub: ringed core with port lights
      drawWindowGrid(x, y, w, h, accent, Math.max(4, Math.floor(h / 12)), 4, t, ph);
      const ringY = y + h * 0.3;
      const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.8 + ph));
      ctx.strokeStyle = accentRGBA + (0.6 * pulse).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(footX, ringY, w * 0.7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(footX, ringY, w * 0.45, 0, Math.PI * 2); ctx.stroke();
      // Ports
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + t * 0.3;
        const px = footX + Math.cos(ang) * w * 0.7;
        const py = ringY + Math.sin(ang) * w * 0.7;
        ctx.fillStyle = i % 2 === 0 ? COLOR.cyan : COLOR.red;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    } else {
      // contact pad: low platform with rising data column
      ctx.fillStyle = COLOR.pcbMid;
      ctx.fillRect(x, y + h * 0.5, w, h * 0.5);
      ctx.fillStyle = COLOR.red;
      const colH = (0.5 + 0.5 * Math.sin(t * 1.6 + ph)) * h * 0.5;
      ctx.fillRect(footX - w * 0.08, y + h * 0.5 - colH, w * 0.16, colH);
      drawWindowGrid(x, y + h * 0.5, w, h * 0.5, COLOR.red, 2, 4, t, ph);
    }
  }

  function drawBuildings(t, scrollFrac) {
    // Two columns of buildings, one each side. Stagger by district.
    // Cycle archetypes so the active section's archetype is dominant.
    const districtIndex = Math.floor(scrollFrac * DISTRICTS.length);
    const slots = isMobile ? 8 : 12;
    for (let s = 0; s < slots; s++) {
      // Stream buildings toward the viewer.
      const baseZ = (s / slots + (t * 0.04)) % 1;
      // Two side rows per slot
      for (let side = -1; side <= 1; side += 2) {
        // Inner row close to road, outer row a bit further
        for (let row = 0; row < 2; row++) {
          const lane = side * (1.05 + row * 0.55);
          // Skip when behind horizon
          if (baseZ < 0.04) continue;
          const proj = project(baseZ, lane);
          if (proj.y < proj.horizonY - 4) continue;
          const scale = Math.max(2, proj.halfW * 0.06);
          // Archetype: nearer slots reflect the active district more strongly.
          const archIdx = (districtIndex + s + row) % DISTRICTS.length;
          const arch = chooseArchetype(archIdx);
          const district = DISTRICTS[archIdx];
          const color = (district.color === 0xff2a2a || district.color === 0xff3a3a || district.color === 0xff5050) ? COLOR.red : COLOR.cyan;
          drawBuilding(arch, proj.x, proj.y, scale, color, t, s * 7 + row * 3 + (side > 0 ? 1 : 0));
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // PCB substrate — receding grid + traces + glowing vias.
  // ------------------------------------------------------------------
  function drawSubstrate(t, scrollFrac) {
    const horizonY = viewH * 0.46 + camPitch;

    // Substrate fill
    const grad = ctx.createLinearGradient(0, horizonY, 0, viewH);
    grad.addColorStop(0, COLOR.pcbDark);
    grad.addColorStop(0.5, COLOR.bg2);
    grad.addColorStop(1, COLOR.bg0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, viewW, viewH - horizonY);

    // Receding lateral grid — these lines stream toward viewer to give
    // the spinning-roads feel.
    ctx.lineWidth = 1;
    const bands = isMobile ? 18 : 28;
    for (let i = 0; i < bands; i++) {
      const zN = ((i / bands) + (t * 0.18 + scrollFrac * 1.6)) % 1;
      const p = project(zN, 0);
      const alpha = 0.05 + zN * 0.18;
      ctx.strokeStyle = i % 4 === 0
        ? "rgba(255,42,42," + alpha.toFixed(3) + ")"
        : "rgba(92,242,255," + alpha.toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(viewW, p.y);
      ctx.stroke();
    }

    // Longitudinal trace lines off the road
    ctx.lineWidth = 1.2;
    for (let i = 0; i < traces.length; i++) {
      const tr = traces[i];
      ctx.strokeStyle = tr.color === COLOR.red ? COLOR.redSoft : COLOR.cyanSoft;
      ctx.beginPath();
      let prev = null;
      for (let j = 0; j < tr.pts.length; j++) {
        const px = tr.pts[j][0];
        let pz = tr.pts[j][1];
        pz = (pz + (t * 0.06 + scrollFrac * 0.6)) % 1;
        const p = project(pz, px);
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    // Solder vias glowing along the substrate
    for (let i = 0; i < vias.length; i++) {
      const v = vias[i];
      const z = (v.z + (t * 0.06 + scrollFrac * 0.6)) % 1;
      const p = project(z, v.x);
      const r = Math.max(1.5, p.halfW * 0.012);
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + v.ph);
      const inner = v.red ? "rgba(255,90,58,0.9)" : "rgba(170,240,255,0.95)";
      const outer = v.red ? "rgba(255,42,42,0)" : "rgba(92,242,255,0)";
      fillRadialGlow(p.x, p.y, r * 5 * (0.7 + pulse * 0.6), inner, outer);
      ctx.fillStyle = v.red ? COLOR.red : COLOR.white;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ------------------------------------------------------------------
  // Highway — main road polygon, animated dashes, glowing rails.
  // ------------------------------------------------------------------
  function drawHighway(t, scrollFrac) {
    const top = project(0.0, 0);
    const bot = project(1.0, 0);

    // Road body
    ctx.fillStyle = COLOR.pcbLite;
    ctx.beginPath();
    ctx.moveTo(top.x - top.halfW * 0.13, top.y);
    ctx.lineTo(top.x + top.halfW * 0.13, top.y);
    ctx.lineTo(bot.x + bot.halfW * 0.78, bot.y);
    ctx.lineTo(bot.x - bot.halfW * 0.78, bot.y);
    ctx.closePath();
    ctx.fill();

    // Inner copper inlay
    ctx.fillStyle = COLOR.copper;
    ctx.beginPath();
    ctx.moveTo(top.x - top.halfW * 0.07, top.y);
    ctx.lineTo(top.x + top.halfW * 0.07, top.y);
    ctx.lineTo(bot.x + bot.halfW * 0.42, bot.y);
    ctx.lineTo(bot.x - bot.halfW * 0.42, bot.y);
    ctx.closePath();
    ctx.fill();

    // Rails
    ctx.lineCap = "round";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(92,242,255,0.7)";
    ctx.strokeStyle = COLOR.cyan;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(top.x - top.halfW * 0.13, top.y);
    ctx.lineTo(bot.x - bot.halfW * 0.78, bot.y);
    ctx.stroke();
    ctx.shadowColor = "rgba(255,42,42,0.7)";
    ctx.strokeStyle = COLOR.red;
    ctx.beginPath();
    ctx.moveTo(top.x + top.halfW * 0.13, top.y);
    ctx.lineTo(bot.x + bot.halfW * 0.78, bot.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dashes — march from horizon to viewer.
    const dashCount = isMobile ? 12 : 22;
    const phase = (t * 0.6 + scrollFrac * 4) % 1;
    for (let i = 0; i < dashCount; i++) {
      const di = (i / dashCount + phase) % 1;
      const a = Math.max(0, di - 0.025);
      const b = Math.min(1, di + 0.025);
      const pa = project(a, 0);
      const pb = project(b, 0);
      ctx.strokeStyle = i % 2 === 0 ? COLOR.white : COLOR.orange;
      ctx.lineWidth = Math.max(1, 0.8 + di * 5);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------------
  // Packets — electric signals streaming along rails and lanes.
  // ------------------------------------------------------------------
  function drawPackets(t, dt, scrollFrac) {
    for (let i = 0; i < packets.length; i++) {
      const pk = packets[i];
      pk.z += pk.speed * dt * (1 + scrollFrac * 0.6);
      if (pk.z > 1) pk.z -= 1;
      // Rail packets lock to rail lanes.
      const lane = pk.rail
        ? (pk.lane > 0 ? 0.78 : -0.78) * (0.13 + 0.65 * pk.z)
        : pk.lane * (0.05 + 0.6 * pk.z);
      const p = project(pk.z, lane);
      const sz = Math.max(1.2, p.halfW * (pk.cmd ? 0.06 : 0.03));
      ctx.shadowBlur = pk.cmd ? 12 : 8;
      ctx.shadowColor = pk.cmd ? "rgba(255,58,58,0.85)" : "rgba(150,240,255,0.85)";
      ctx.fillStyle = pk.cmd ? COLOR.red : (pk.lane < 0 ? COLOR.white : "#9ff8ff");
      ctx.beginPath();
      ctx.arc(p.x, p.y - sz * 0.3, sz, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ------------------------------------------------------------------
  // District labels — render the district name as a faint readable
  // panel that fades in when its section is active. Drawn directly on
  // canvas at the road horizon so it parallaxes naturally.
  // ------------------------------------------------------------------
  function drawDistrictLabel(t, scrollFrac) {
    const idx = Math.min(DISTRICTS.length - 1, Math.floor(scrollFrac * DISTRICTS.length));
    const d = DISTRICTS[idx];
    const horizonY = viewH * 0.46 + camPitch;
    const cx = viewW * 0.5 + camBank * 0.4;
    const cy = horizonY - (isMobile ? 28 : 44);
    const fontSize = isMobile ? 11 : 13;
    ctx.save();
    ctx.font = "600 " + fontSize + "px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = d.name.toUpperCase() + " // " + d.coord;
    const metrics = ctx.measureText(text);
    const padX = 14, padY = 6;
    const w = metrics.width + padX * 2;
    const h = fontSize + padY * 2;
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = "rgba(8,16,32,0.78)";
    ctx.fillRect(cx - w * 0.5, cy - h * 0.5, w, h);
    ctx.strokeStyle = (d.color === 0xff2a2a || d.color === 0xff3a3a || d.color === 0xff5050) ? COLOR.red : COLOR.cyan;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - w * 0.5 + 0.5, cy - h * 0.5 + 0.5, w - 1, h - 1);
    ctx.fillStyle = COLOR.white;
    ctx.fillText(text, cx, cy + 1);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  let startedAt = performance.now() / 1000;
  let lastTs = startedAt;
  let frames = 0;
  window.__brainstormRenderFrames = 0;

  function frame() {
    const now = performance.now() / 1000;
    const dt = Math.max(0.001, Math.min(0.05, now - lastTs));
    lastTs = now;
    const t = now - startedAt;

    const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollFrac = Math.max(0, Math.min(1, window.scrollY / docH));

    updateCamera(t, scrollFrac);

    ctx.clearRect(0, 0, viewW, viewH);
    drawSky(t, scrollFrac);
    drawStars(t);
    drawSubstrate(t, scrollFrac);
    drawBuildings(t, scrollFrac);
    drawHighway(t, scrollFrac);
    drawPackets(t, dt, scrollFrac);
    drawDistrictLabel(t, scrollFrac);

    // Progress rail update
    if (progressFill) progressFill.style.height = (scrollFrac * 100).toFixed(1) + "%";

    frames++;
    window.__brainstormRenderFrames = frames;
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------
  // Boot animation
  // ------------------------------------------------------------------
  function start() {
    document.documentElement.dataset.sceneEngine = "canvas2d";
    document.documentElement.dataset.webglStatus = "running";
    resize();
    seed();
    window.addEventListener("resize", () => {
      resize();
      seed();
    });
    requestAnimationFrame(frame);
    try { console.info("[brainstorm] Canvas2D electric flight engine running"); } catch (_) {}
  }

  // ------------------------------------------------------------------
  // Section reveal + nav highlight
  // ------------------------------------------------------------------
  const sections = Array.from(document.querySelectorAll(".sec"));
  const progressFill = document.getElementById("progressFill");
  const navLinks = Array.from(document.querySelectorAll(".hud-nav a"));

  if ("IntersectionObserver" in window) {
    sections.forEach((s) => { if (!s.classList.contains("hero")) s.classList.add("armed"); });
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("active");
          const id = e.target.id;
          if (id) navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
        }
      }
    }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });
    sections.forEach((s) => io.observe(s));
  }
  function revealAll() { sections.forEach((s) => s.classList.add("active")); }
  function revealOnScroll() {
    const vh = window.innerHeight;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.top < vh * 0.85 && r.bottom > vh * 0.15) s.classList.add("active");
    }
  }
  window.addEventListener("scroll", revealOnScroll, { passive: true });
  window.addEventListener("load", revealOnScroll);
  setTimeout(revealOnScroll, 200);
  setTimeout(revealAll, 1200);

  // ------------------------------------------------------------------
  // Agent wall
  // ------------------------------------------------------------------
  const wall = document.getElementById("agentWall");
  if (wall) {
    wall.innerHTML = AGENT_SAMPLE.map((a) => `<div class="a"><b>${a[0]}</b><span>${a[1]}</span></div>`).join("");
    const more = document.createElement("div");
    more.className = "agent-wall-more";
    more.innerHTML = `<span class="agent-wall-swipe">Swipe to browse roster</span> Plus <b>${270 - AGENT_SAMPLE.length}+</b> more.`;
    wall.parentNode.insertBefore(more, wall.nextSibling);
  }

  // ------------------------------------------------------------------
  // Mobile nav toggle
  // ------------------------------------------------------------------
  const hudToggle = document.getElementById("hudToggle");
  const hudNav = document.getElementById("hudNav");
  if (hudToggle && hudNav) {
    const closeNav = () => {
      hudNav.classList.remove("open");
      hudToggle.setAttribute("aria-expanded", "false");
    };
    const openNav = () => {
      hudNav.classList.add("open");
      hudToggle.setAttribute("aria-expanded", "true");
    };
    hudToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (hudNav.classList.contains("open")) closeNav(); else openNav();
    });
    hudNav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && hudNav.classList.contains("open")) closeNav();
    });
    document.addEventListener("click", (e) => {
      if (!hudNav.classList.contains("open")) return;
      if (hudNav.contains(e.target) || hudToggle.contains(e.target)) return;
      closeNav();
    });
  }

  start();
})();
