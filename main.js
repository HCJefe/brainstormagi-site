// Brainstorm AGI primary scene engine.
// First-party Canvas2D pseudo-3D circuit-board flight. No remote deps.
// The road is a bezier spline that visibly twists/banks between
// section-specific buildings. Camera and curve advance with scroll/time
// so each section reads as a distinct checkpoint, not a flat wallpaper.
(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  if (!canvas) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) {
    document.documentElement.dataset.sceneEngine = "no-2d-context";
    document.documentElement.classList.add("no-webgl");
    if (typeof window.__brainstormStartFallback === "function") {
      try { window.__brainstormStartFallback(); } catch (_) {}
    }
    return;
  }

  document.documentElement.dataset.sceneEngine = "canvas2d-curved";
  window.__brainstormRenderFrames = 0;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  // Palette
  var CYAN = "#5cf2ff";
  var CYAN_SOFT = "rgba(92,242,255,";
  var RED = "#ff3a3a";
  var RED_SOFT = "rgba(255,58,58,";
  var WHITE = "#ffffff";
  var ORANGE = "#ff7a3a";
  var DARK = "#070d1c";

  // ---- Section curve targets ----
  // Each section has a lateral offset target. As the user scrolls, the
  // active curve interpolates so the road bends toward the next building.
  // Buildings sit on alternating sides matching the layout in index.html.
  var SECTIONS = [
    { id: "hero",        name: "spire",       side:  0.00, type: "spire" },
    { id: "spire",       name: "spire",       side: -0.55, type: "spire" },
    { id: "foundry",     name: "foundry",     side:  0.65, type: "foundry" },
    { id: "voice",       name: "voice",       side: -0.70, type: "voice" },
    { id: "ops",         name: "ops",         side:  0.55, type: "ops" },
    { id: "revenue",     name: "revenue",     side: -0.65, type: "revenue" },
    { id: "content",     name: "content",     side:  0.70, type: "content" },
    { id: "integration", name: "integration", side: -0.55, type: "integration" },
    { id: "contact",     name: "contact",     side:  0.00, type: "contact" }
  ];

  var stars = [];
  var packets = [];
  var pcbBranches = [];
  var solderPads = [];
  var smdChips = [];

  function seed() {
    stars.length = 0;
    for (var i = 0; i < 260; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.5,
        s: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
        red: Math.random() < 0.12
      });
    }
    packets.length = 0;
    for (var p = 0; p < 110; p++) {
      packets.push({
        z: Math.random(),
        lane: (Math.random() * 0.7 - 0.35),
        speed: 0.10 + Math.random() * 0.22,
        cmd: Math.random() < 0.10
      });
    }
    pcbBranches.length = 0;
    for (var b = 0; b < 22; b++) {
      pcbBranches.push({
        z: Math.random(),
        side: Math.random() < 0.5 ? -1 : 1,
        len: 0.4 + Math.random() * 0.6,
        kind: Math.random() < 0.5 ? "L" : "T",
        speed: 0.05 + Math.random() * 0.10,
        red: Math.random() < 0.35
      });
    }
    solderPads.length = 0;
    for (var s = 0; s < 28; s++) {
      solderPads.push({
        z: Math.random(),
        x: (Math.random() * 1.7 - 0.85),
        speed: 0.04 + Math.random() * 0.10,
        red: Math.random() < 0.30
      });
    }
    smdChips.length = 0;
    for (var c = 0; c < 9; c++) {
      smdChips.push({
        z: Math.random(),
        side: Math.random() < 0.5 ? -1 : 1,
        offset: 0.85 + Math.random() * 0.6,
        w: 0.10 + Math.random() * 0.10,
        h: 0.05 + Math.random() * 0.04,
        speed: 0.05 + Math.random() * 0.08
      });
    }
  }

  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.max(2, Math.floor(w * DPR));
    canvas.height = Math.max(2, Math.floor(h * DPR));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  // Smooth scroll fraction (0..1) across the whole document and per-section
  // weights so the curve targets the closest section heavily.
  function readScroll() {
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var frac = Math.max(0, Math.min(1, scrollY / docH));
    // Section index in float space (0..SECTIONS.length-1)
    var sectionPos = frac * (SECTIONS.length - 1);
    return { frac: frac, sectionPos: sectionPos };
  }

  // Curve state is driven by:
  //  - section progression (which building we're approaching)
  //  - time-based gentle sway so the road never sits still
  //  - sub-section ease so the bend smoothly slides between sections
  function curveLateralAt(zNorm, t, sectionPos) {
    // zNorm: 0 = far horizon, 1 = camera foreground.
    // Near the horizon (z=0) we point toward the *next* section.
    // Near the camera (z=1) we have already arrived from the previous one.
    var idxA = Math.floor(sectionPos);
    var idxB = Math.min(SECTIONS.length - 1, idxA + 1);
    var local = sectionPos - idxA;
    // Ease so transitions feel like banking turns, not linear shifts.
    var ease = local * local * (3 - 2 * local);

    var sideA = SECTIONS[idxA].side;
    var sideB = SECTIONS[idxB].side;
    // The road blends between sides along its length:
    //  - foreground (z=1) leans toward where we *came from* (A)
    //  - far end   (z=0) leans toward where we are *heading* (B)
    var fgSide = sideA + (sideB - sideA) * ease * 0.4;
    var bgSide = sideB + (sideA - sideB) * (1 - ease) * 0.2;

    // Add a continuous time-based sway so even within a section the road
    // is never perfectly straight; this gives the sense of a flying camera.
    var sway = Math.sin(t * 0.6 + zNorm * 3.4) * 0.18 * (1 - zNorm * 0.4);
    var roll = Math.cos(t * 0.35 + sectionPos * 1.2) * 0.10;

    // Bezier-style blend between far and near control points, plus sway
    var blend = 1 - zNorm; // 0 near, 1 far
    var lateral = fgSide * (1 - blend) + bgSide * blend + sway + roll * blend;
    return lateral; // in road-half units
  }

  // Project a road point (zNorm 0=horizon, 1=foreground, lane offset)
  // to screen coordinates with curved lateral and slight banking.
  function project(zNorm, laneOffset, w, h, horizonY, t, sectionPos) {
    var z = Math.max(0, Math.min(1, zNorm));
    var roadHalfFG = w * 0.62;
    var roadHalfH  = w * 0.010;
    // Perspective
    var pp = z * z * 0.94 + z * 0.06;
    var halfW = roadHalfH + (roadHalfFG - roadHalfH) * pp;
    var groundY = horizonY + (h - horizonY) * pp;

    // Curve: lateral offset of the road centerline at this z
    var centerLat = curveLateralAt(z, t, sectionPos);
    var centerX = w * 0.5 + centerLat * halfW * 1.45;

    // Banking: when curve is bending one way the road tilts. The tilt is
    // applied as a vertical offset to the lane edge proportional to lane.
    // Approximate dC/dz numerically for slope-based banking.
    var dz = 0.04;
    var nextLat = curveLateralAt(Math.min(1, z + dz), t, sectionPos);
    var slope = (nextLat - centerLat) / dz;
    var bank = slope * 0.18; // radians-ish

    var localX = laneOffset * halfW;
    var x = centerX + localX * Math.cos(bank);
    var y = groundY + localX * Math.sin(bank) * 0.45;

    return { x: x, y: y, halfW: halfW, centerX: centerX, centerY: groundY, bank: bank };
  }

  // ---- Drawing helpers ----

  function drawBackdrop(w, h, horizonY, scrollFrac, t) {
    // Deep gradient sky/board base
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#020514");
    sky.addColorStop(0.45, "#070d1c");
    sky.addColorStop(0.8, "#0a1530");
    sky.addColorStop(1, "#02040a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun glow that drifts with scroll
    var cx = w * (0.45 + Math.sin(t * 0.2) * 0.05);
    var cy = horizonY - h * 0.04 - scrollFrac * 30;
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
    glow.addColorStop(0, "rgba(255,90,58,0.30)");
    glow.addColorStop(0.45, "rgba(255,42,42,0.12)");
    glow.addColorStop(1, "rgba(255,42,42,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Cyan horizon haze
    var haze = ctx.createLinearGradient(0, horizonY - h * 0.06, 0, horizonY + h * 0.05);
    haze.addColorStop(0, "rgba(92,242,255,0)");
    haze.addColorStop(0.5, "rgba(92,242,255,0.16)");
    haze.addColorStop(1, "rgba(92,242,255,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - h * 0.06, w, h * 0.12);
  }

  function drawStars(w, horizonY, t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.x * w;
      var sy = s.y * horizonY;
      var alpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.2 + s.tw));
      ctx.fillStyle = s.red ? "rgba(255,90,90," + alpha.toFixed(3) + ")"
                            : "rgba(180,210,255," + alpha.toFixed(3) + ")";
      ctx.fillRect(sx, sy, s.s, s.s);
    }
  }

  // PCB substrate beneath the road. Receding bands + branching traces.
  function drawPCBGround(w, h, horizonY, t, sectionPos) {
    var grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, "#0a1830");
    grad.addColorStop(0.5, "#0c1a2e");
    grad.addColorStop(1, "#040810");
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Receding fine etched grid
    ctx.strokeStyle = "rgba(92,242,255,0.10)";
    ctx.lineWidth = 1;
    for (var i = 1; i < 32; i++) {
      var z = i / 32;
      var pp = z * z * 0.94 + z * 0.06;
      var y = horizonY + (h - horizonY) * pp;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vertical PCB columns that converge to a moving vanishing point
    // (the road's far horizon end). This sells motion when scroll changes
    // the section because the vanishing point shifts laterally.
    var farLat = curveLateralAt(0, t, sectionPos);
    var vpX = w * 0.5 + farLat * (w * 0.31);
    ctx.strokeStyle = "rgba(255,90,90,0.18)";
    for (var v = -10; v <= 10; v++) {
      if (v === 0) continue;
      var bottomX = w * 0.5 + (v / 10) * w * 0.9;
      ctx.beginPath();
      ctx.moveTo(vpX, horizonY);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }

    // Solder pads and SMD chip silhouettes scattered on the board
    for (var sp = 0; sp < solderPads.length; sp++) {
      var pad = solderPads[sp];
      pad.z += pad.speed * 0.012;
      if (pad.z > 1.05) pad.z = -0.05;
      if (pad.z < 0) continue;
      var pPad = project(pad.z, pad.x * 1.6, w, h, horizonY, t, sectionPos);
      var pr = Math.max(1, pPad.halfW * 0.020);
      ctx.fillStyle = pad.red ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      ctx.beginPath();
      ctx.arc(pPad.x, pPad.y, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.arc(pPad.x, pPad.y, pr * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var ch = 0; ch < smdChips.length; ch++) {
      var chip = smdChips[ch];
      chip.z += chip.speed * 0.012;
      if (chip.z > 1.05) chip.z = -0.05;
      if (chip.z < 0) continue;
      var chipP = project(chip.z, chip.side * chip.offset * 1.6, w, h, horizonY, t, sectionPos);
      var cw = chipP.halfW * chip.w;
      var chh = chipP.halfW * chip.h;
      ctx.fillStyle = "#0a1428";
      ctx.fillRect(chipP.x - cw / 2, chipP.y - chh / 2, cw, chh);
      ctx.strokeStyle = "rgba(92,242,255,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chipP.x - cw / 2, chipP.y - chh / 2, cw, chh);
      // Pin marks
      ctx.fillStyle = "rgba(255,90,58,0.85)";
      var pins = 4;
      for (var pi = 0; pi < pins; pi++) {
        var px = chipP.x - cw / 2 + (pi + 0.5) * (cw / pins);
        ctx.fillRect(px - 0.5, chipP.y - chh / 2 - 1.5, 1, 1.5);
        ctx.fillRect(px - 0.5, chipP.y + chh / 2, 1, 1.5);
      }
    }
  }

  // The curved highway itself, drawn as many trapezoid slices that hug
  // the spline. This makes the road *visibly* curve.
  function drawHighway(w, h, horizonY, t, sectionPos) {
    var SLICES = 36;
    // Road body
    for (var i = 0; i < SLICES; i++) {
      var z0 = i / SLICES;
      var z1 = (i + 1) / SLICES;
      var p0L = project(z0, -1, w, h, horizonY, t, sectionPos);
      var p0R = project(z0,  1, w, h, horizonY, t, sectionPos);
      var p1L = project(z1, -1, w, h, horizonY, t, sectionPos);
      var p1R = project(z1,  1, w, h, horizonY, t, sectionPos);
      // Road surface fade, darker far, brighter near
      var shade = 14 + Math.floor(z0 * 30);
      ctx.fillStyle = "rgb(" + shade + "," + (shade + 8) + "," + (shade + 30) + ")";
      ctx.beginPath();
      ctx.moveTo(p0L.x, p0L.y);
      ctx.lineTo(p0R.x, p0R.y);
      ctx.lineTo(p1R.x, p1R.y);
      ctx.lineTo(p1L.x, p1L.y);
      ctx.closePath();
      ctx.fill();

      // Inner copper band
      var cL0 = project(z0, -0.55, w, h, horizonY, t, sectionPos);
      var cR0 = project(z0,  0.55, w, h, horizonY, t, sectionPos);
      var cL1 = project(z1, -0.55, w, h, horizonY, t, sectionPos);
      var cR1 = project(z1,  0.55, w, h, horizonY, t, sectionPos);
      ctx.fillStyle = "rgba(192,68,40," + (0.22 + z0 * 0.30).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(cL0.x, cL0.y);
      ctx.lineTo(cR0.x, cR0.y);
      ctx.lineTo(cR1.x, cR1.y);
      ctx.lineTo(cL1.x, cL1.y);
      ctx.closePath();
      ctx.fill();
    }

    // Cyan rail (left) and red rail (right) drawn as polyline along curve
    function drawRail(side, color, glowCol) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (var k = 0; k <= 60; k++) {
        var z = k / 60;
        var p = project(z, side, w, h, horizonY, t, sectionPos);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    drawRail(-1, CYAN, "rgba(92,242,255,0.7)");
    drawRail( 1, RED,  "rgba(255,58,58,0.7)");

    // Center spine (faint)
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var s = 0; s <= 60; s++) {
      var zz = s / 60;
      var pp = project(zz, 0, w, h, horizonY, t, sectionPos);
      if (s === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
    }
    ctx.stroke();

    // Animated dashes streaming forward along the curve
    var DASHES = 18;
    for (var d = 0; d < DASHES; d++) {
      var di = ((d / DASHES) + (t * 0.18) % 1) % 1;
      var dz0 = Math.max(0, di - 0.022);
      var dz1 = Math.min(1, di + 0.022);
      var pa = project(dz0, 0, w, h, horizonY, t, sectionPos);
      var pb = project(dz1, 0, w, h, horizonY, t, sectionPos);
      ctx.strokeStyle = (d % 2 === 0) ? "#ffffff" : ORANGE;
      ctx.lineWidth = Math.max(1, 0.5 + di * 6);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
  }

  // PCB right-angle branches that peel off the road and run to chip pads.
  function drawPCBBranches(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < pcbBranches.length; i++) {
      var br = pcbBranches[i];
      br.z += br.speed * 0.012;
      if (br.z > 1.05) br.z = -0.05;
      if (br.z < 0.02) continue;
      var pStart = project(br.z, br.side * 1.05, w, h, horizonY, t, sectionPos);
      var pEnd   = project(br.z, br.side * (1.05 + br.len * 1.4), w, h, horizonY, t, sectionPos);
      ctx.strokeStyle = br.red ? "rgba(255,58,58,0.7)" : "rgba(92,242,255,0.65)";
      ctx.lineWidth = Math.max(1, pStart.halfW * 0.012);
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      // Right-angle: horizontal segment then vertical jog (in screen space).
      var midX = pStart.x + (pEnd.x - pStart.x) * 0.65;
      var midY = pStart.y;
      ctx.lineTo(midX, midY);
      ctx.lineTo(midX, pEnd.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      // Via at the corner
      ctx.fillStyle = br.red ? "rgba(255,90,90,0.95)" : "rgba(120,240,255,0.95)";
      ctx.beginPath();
      ctx.arc(midX, midY, Math.max(1.5, pStart.halfW * 0.018), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Packets streaming along the curved road on multiple lanes.
  function drawPackets(w, h, horizonY, t, dt, sectionPos) {
    for (var i = 0; i < packets.length; i++) {
      var pk = packets[i];
      pk.z += pk.speed * dt;
      if (pk.z > 1) pk.z -= 1;
      var pp = project(pk.z, pk.lane, w, h, horizonY, t, sectionPos);
      var size = Math.max(1.2, pp.halfW * (pk.cmd ? 0.05 : 0.028));
      ctx.fillStyle = pk.cmd ? RED : (pk.lane < 0 ? "#ffffff" : "#9ff8ff");
      ctx.shadowColor = pk.cmd ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      ctx.shadowBlur = pk.cmd ? 10 : 6;
      ctx.beginPath();
      ctx.arc(pp.x, pp.y - size * 0.4, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ---- Section-specific buildings ----
  // Each draws at a focal z (0..1), anchored on its section's side.
  // The position is computed via project() so buildings ride the curve.

  function buildingBaseScreen(z, side, w, h, horizonY, t, sectionPos, lateralOffset) {
    // lateralOffset is in road-half multiples (e.g. 1.5 places the base
    // just past the rail).
    return project(z, side * lateralOffset, w, h, horizonY, t, sectionPos);
  }

  function drawSpire(p, scale, t) {
    // Tall lit tower with antenna crown
    var hgt = scale * 22;
    var basew = scale * 2.8;
    // Body
    var grad = ctx.createLinearGradient(p.x, p.y - hgt, p.x, p.y);
    grad.addColorStop(0, "#1a2a4a");
    grad.addColorStop(1, "#060c1c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p.x - basew, p.y);
    ctx.lineTo(p.x - basew * 0.35, p.y - hgt * 0.6);
    ctx.lineTo(p.x - basew * 0.18, p.y - hgt);
    ctx.lineTo(p.x + basew * 0.18, p.y - hgt);
    ctx.lineTo(p.x + basew * 0.35, p.y - hgt * 0.6);
    ctx.lineTo(p.x + basew, p.y);
    ctx.closePath();
    ctx.fill();
    // Edge cyan
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "rgba(92,242,255,0.7)";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Window strips
    var rows = 12;
    for (var r = 1; r <= rows; r++) {
      var ry = p.y - (hgt / (rows + 1)) * r;
      var pulse = 0.5 + 0.5 * Math.sin(t * 2 + r);
      ctx.fillStyle = "rgba(92,242,255," + (0.4 + pulse * 0.5).toFixed(3) + ")";
      ctx.fillRect(p.x - basew * 0.6, ry, basew * 1.2, 1);
    }
    // Antenna + beacon
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt);
    ctx.lineTo(p.x, p.y - hgt - scale * 4);
    ctx.stroke();
    ctx.fillStyle = (Math.sin(t * 4) > 0) ? RED : "#ffaa55";
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt - scale * 4, Math.max(1.2, scale * 0.4), 0, Math.PI * 2);
    ctx.fill();
    // Ground footprint (solder pad)
    ctx.fillStyle = "rgba(255,90,58,0.55)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + scale * 0.4, basew * 1.4, basew * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFoundry(p, scale, t) {
    // Two connected fabrication towers with skybridge + pods
    var hgt = scale * 16;
    var w1 = scale * 2.0, w2 = scale * 1.6;
    var x1 = p.x - scale * 2.4;
    var x2 = p.x + scale * 2.4;
    // Towers
    [{ x: x1, w: w1, h: hgt }, { x: x2, w: w2, h: hgt * 0.85 }].forEach(function (tw) {
      ctx.fillStyle = "#0d182e";
      ctx.fillRect(tw.x - tw.w, p.y - tw.h, tw.w * 2, tw.h);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tw.x - tw.w, p.y - tw.h, tw.w * 2, tw.h);
      // Window grid pulses
      var cols = 4, rows = 8;
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var on = ((Math.sin(t * 2 + r * 1.3 + c * 0.7 + tw.x) + 1) * 0.5) > 0.45;
          if (!on) continue;
          ctx.fillStyle = "rgba(92,242,255,0.85)";
          ctx.fillRect(
            tw.x - tw.w + 2 + c * ((tw.w * 2 - 4) / cols),
            p.y - tw.h + 2 + r * ((tw.h - 4) / rows),
            Math.max(1, (tw.w * 2 - 4) / cols - 1),
            Math.max(1, (tw.h - 4) / rows - 1.5)
          );
        }
      }
    });
    // Skybridge
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255,58,58,0.7)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x1 + w1, p.y - hgt * 0.55);
    ctx.lineTo(x2 - w2, p.y - hgt * 0.55);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Floating pods
    for (var k = 0; k < 3; k++) {
      var pf = (Math.sin(t * 0.8 + k) + 1) * 0.5;
      var px = x1 + w1 + (x2 - w2 - (x1 + w1)) * (k / 3 + 0.2);
      var py = p.y - hgt * (0.55 + pf * 0.18);
      ctx.fillStyle = "#3a0a14";
      ctx.beginPath();
      ctx.ellipse(px, py, scale * 0.7, scale * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = RED;
      ctx.stroke();
    }
  }

  function drawVoiceArray(p, scale, t) {
    // Antenna array with concentric rings + wave arcs
    // Center mast
    var hgt = scale * 14;
    ctx.strokeStyle = "rgba(170,200,255,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - hgt);
    ctx.stroke();
    // Crossbars
    for (var i = 1; i <= 4; i++) {
      var ry = p.y - (hgt / 5) * i;
      var rw = scale * (1.2 + i * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x - rw, ry);
      ctx.lineTo(p.x + rw, ry);
      ctx.stroke();
    }
    // Top dish
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt, scale * 1.4, Math.PI, 0);
    ctx.stroke();
    // Wave rings
    for (var w = 0; w < 4; w++) {
      var phase = (t * 0.8 + w * 0.5) % 2;
      if (phase > 1) continue;
      var rad = scale * (2 + phase * 7);
      ctx.strokeStyle = "rgba(92,242,255," + (1 - phase).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - hgt, rad, Math.PI, 0);
      ctx.stroke();
    }
    // Beacon
    ctx.fillStyle = (Math.sin(t * 5) > 0) ? RED : "#ffaa55";
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt - scale * 0.4, Math.max(1.2, scale * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOpsTower(p, scale, t) {
    // Command tower with radar ring sweeping
    var hgt = scale * 17;
    var basew = scale * 2.2;
    ctx.fillStyle = "#0c1830";
    ctx.fillRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    // Bridge / observation deck
    var deckH = scale * 1.6;
    ctx.fillStyle = "#1a2a4a";
    ctx.fillRect(p.x - basew * 1.5, p.y - hgt - deckH, basew * 3, deckH);
    ctx.strokeStyle = RED;
    ctx.strokeRect(p.x - basew * 1.5, p.y - hgt - deckH, basew * 3, deckH);
    // Deck windows
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = "rgba(92,242,255,0.85)";
      ctx.fillRect(p.x - basew * 1.4 + i * (basew * 0.36), p.y - hgt - deckH + 0.5, basew * 0.25, deckH - 1);
    }
    // Radar sweep
    var sweep = (t * 1.4) % (Math.PI * 2);
    var radarR = scale * 4;
    ctx.strokeStyle = "rgba(92,242,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt - deckH, radarR, 0, Math.PI * 2);
    ctx.stroke();
    var sx = p.x + Math.cos(sweep - Math.PI / 2) * radarR;
    var sy = p.y - hgt - deckH + Math.sin(sweep - Math.PI / 2) * radarR;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt - deckH);
    ctx.lineTo(sx, sy);
    ctx.stroke();
  }

  function drawReactor(p, scale, t) {
    // Reactor core with turbine rings and energy column
    var coreY = p.y - scale * 8;
    // Rings
    for (var i = 0; i < 4; i++) {
      var rr = scale * (2 + i * 1.4);
      var rot = t * (0.6 + i * 0.2) + i;
      ctx.strokeStyle = i % 2 === 0 ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, coreY, rr, rr * 0.35, rot, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Core glow
    var pulse = 0.6 + 0.4 * Math.sin(t * 4);
    var coreGrad = ctx.createRadialGradient(p.x, coreY, 0, p.x, coreY, scale * 4);
    coreGrad.addColorStop(0, "rgba(255,200,120," + pulse.toFixed(3) + ")");
    coreGrad.addColorStop(0.5, "rgba(255,90,58,0.45)");
    coreGrad.addColorStop(1, "rgba(255,58,58,0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(p.x, coreY, scale * 4, 0, Math.PI * 2);
    ctx.fill();
    // Energy column
    ctx.strokeStyle = "rgba(255,200,120,0.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,90,58,0.85)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - scale * 14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Base struts
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(p.x + s * scale * 2.5, p.y);
      ctx.lineTo(p.x, p.y - scale * 4);
      ctx.stroke();
    }
  }

  function drawContentForge(p, scale, t) {
    // Studio with holographic screen facade
    var hgt = scale * 13;
    var basew = scale * 4.5;
    ctx.fillStyle = "#0a1628";
    ctx.fillRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    // Holographic facade: animated bars
    var bars = 10;
    for (var i = 0; i < bars; i++) {
      var bh = (Math.sin(t * 2 + i) + 1) * 0.5 * (hgt - 4) + 2;
      var bx = p.x - basew + 4 + i * ((basew * 2 - 8) / bars);
      var bw = (basew * 2 - 8) / bars - 1;
      var hue = i / bars;
      ctx.fillStyle = hue < 0.5 ? "rgba(92,242,255,0.85)" : "rgba(255,58,58,0.85)";
      ctx.fillRect(bx, p.y - 2 - bh, bw, bh);
    }
    // Crown emitters
    for (var k = -1; k <= 1; k++) {
      ctx.fillStyle = (Math.sin(t * 3 + k) > 0) ? "#ffaa55" : RED;
      ctx.beginPath();
      ctx.arc(p.x + k * basew * 0.7, p.y - hgt - 2, Math.max(1.2, scale * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIntegrationDome(p, scale, t) {
    // Dome with radial port bridges
    var domeR = scale * 4;
    var cy = p.y - domeR;
    // Body
    var grad = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, domeR);
    grad.addColorStop(0, "rgba(92,242,255,0.45)");
    grad.addColorStop(1, "rgba(10,20,40,0.9)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, cy, domeR, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Latitude lines
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(p.x, cy, domeR * (1 - i * 0.18), domeR * 0.18 * (4 - i), 0, Math.PI, 0);
      ctx.stroke();
    }
    // Longitude lines
    ctx.strokeStyle = "rgba(92,242,255,0.5)";
    for (var j = -2; j <= 2; j++) {
      var ang = j * 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(Math.PI / 2 + ang) * domeR, cy + Math.sin(Math.PI / 2 + ang) * domeR);
      ctx.lineTo(p.x, cy);
      ctx.stroke();
    }
    // Radial port bridges
    for (var k = 0; k < 6; k++) {
      var a = (k / 6) * Math.PI - Math.PI;
      var bx = p.x + Math.cos(a) * domeR * 1.6;
      var by = cy + Math.sin(a) * domeR * 0.7;
      if (by > p.y) by = p.y;
      ctx.strokeStyle = (k % 2 === 0) ? RED : CYAN;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * domeR, cy + Math.sin(a) * domeR);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // Port pad
      ctx.fillStyle = (k % 2 === 0) ? "rgba(255,58,58,0.9)" : "rgba(92,242,255,0.9)";
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(1.5, scale * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    // Top beacon
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = "rgba(255,200,120," + pulse.toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(p.x, cy - domeR, Math.max(1.2, scale * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawContactPad(p, scale, t) {
    // Landing pad with beacon ring and rising column
    var padR = scale * 4.5;
    // Pad
    ctx.fillStyle = "rgba(20,28,52,0.95)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, padR, padR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Beacon ring
    var ringPulse = (t * 0.8) % 1;
    var rRad = padR * (0.4 + ringPulse * 0.9);
    ctx.strokeStyle = "rgba(92,242,255," + (1 - ringPulse).toFixed(3) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rRad, rRad * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Rising column
    var colH = scale * 9;
    var colGrad = ctx.createLinearGradient(p.x, p.y - colH, p.x, p.y);
    colGrad.addColorStop(0, "rgba(92,242,255,0)");
    colGrad.addColorStop(1, "rgba(92,242,255,0.85)");
    ctx.fillStyle = colGrad;
    ctx.fillRect(p.x - scale * 0.4, p.y - colH, scale * 0.8, colH);
    // Corner markers
    for (var k = 0; k < 6; k++) {
      var ang = (k / 6) * Math.PI * 2;
      var mx = p.x + Math.cos(ang) * padR * 0.95;
      var my = p.y + Math.sin(ang) * padR * 0.4 * 0.95;
      ctx.fillStyle = (k % 2 === 0) ? RED : CYAN;
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(1.2, scale * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Sentinel skyline far behind everything: varied shapes, not flat boxes,
  // for sections without a primary building or as backdrop atmosphere.
  function drawDistantSkyline(w, horizonY, t, sectionPos) {
    // Sectional drift so the silhouette shifts with section, not just a
    // wallpaper row of bars.
    var drift = sectionPos * 60;
    for (var i = 0; i < 36; i++) {
      var nx = ((i * 73 + 17) % 100) / 100;
      var nh = ((i * 41 + 7) % 100) / 100;
      var bx = (nx * w + drift) % w;
      var bw = 8 + (nh * 18);
      var bh = 6 + nh * 60;
      ctx.fillStyle = "#08111e";
      ctx.fillRect(bx, horizonY - bh, bw, bh);
      ctx.strokeStyle = (i % 5 === 0) ? "rgba(255,58,58,0.6)" : "rgba(92,242,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, horizonY - bh + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1));
      // Antenna on tall ones
      if (bh > 40 && i % 4 === 0) {
        ctx.strokeStyle = "rgba(255,58,58,0.7)";
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, horizonY - bh);
        ctx.lineTo(bx + bw / 2, horizonY - bh - 8);
        ctx.stroke();
      }
    }
    // Horizon trace
    ctx.strokeStyle = "rgba(92,242,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 0.5);
    ctx.lineTo(w, horizonY + 0.5);
    ctx.stroke();
  }

  // For each section in a window around the current section, draw its
  // building at a focal z so the active section's structure appears
  // closest. Buildings further down/up the curve appear smaller.
  function drawSectionBuildings(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = SECTIONS[i];
      // Place each section at a z based on offset from current
      // sectionPos: current section is z ~ 0.62 (mid-foreground),
      // upcoming section is z ~ 0.32 (further), and prior sections drift
      // off-screen toward z=1 where they fade out.
      var rel = i - sectionPos; // negative = behind us, positive = ahead
      // Map rel to z. Active building (rel ~ 0) sits at z=0.6 so it's
      // visibly large but not overwhelming the road.
      var z = 0.62 - rel * 0.28;
      if (z <= 0.04 || z >= 0.96) continue;
      var lateral = 1.55; // sit just past the rail
      var p = buildingBaseScreen(z, sec.side >= 0 ? 1 : -1, w, h, horizonY, t, sectionPos, Math.abs(sec.side) * 0.6 + lateral);
      var scale = p.halfW * 0.058;
      // Slight z-fade for distance
      var fade = z;
      ctx.save();
      ctx.globalAlpha = Math.max(0.25, Math.min(1, 0.4 + fade * 0.9));
      switch (sec.type) {
        case "spire":       drawSpire(p, scale, t); break;
        case "foundry":     drawFoundry(p, scale, t); break;
        case "voice":       drawVoiceArray(p, scale, t); break;
        case "ops":         drawOpsTower(p, scale, t); break;
        case "revenue":     drawReactor(p, scale, t); break;
        case "content":     drawContentForge(p, scale, t); break;
        case "integration": drawIntegrationDome(p, scale, t); break;
        case "contact":     drawContactPad(p, scale, t); break;
      }
      ctx.restore();
    }
  }

  function drawScanlines(w, h) {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (var y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  // ---- Main loop ----

  var startedAt = performance.now() / 1000;
  var lastFrame = startedAt;

  function frame() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var now = performance.now() / 1000;
    var t = now - startedAt;
    var dt = Math.min(0.05, Math.max(0.001, now - lastFrame));
    lastFrame = now;

    var s = readScroll();
    var scrollFrac = s.frac;
    var sectionPos = s.sectionPos;

    // Horizon shifts subtly with scroll for parallax
    var horizonY = h * (0.46 - scrollFrac * 0.06);

    ctx.clearRect(0, 0, w, h);
    drawBackdrop(w, h, horizonY, scrollFrac, t);
    drawStars(w, horizonY, t);
    drawDistantSkyline(w, horizonY, t, sectionPos);
    drawPCBGround(w, h, horizonY, t, sectionPos);
    drawHighway(w, h, horizonY, t, sectionPos);
    drawPCBBranches(w, h, horizonY, t, sectionPos);
    drawSectionBuildings(w, h, horizonY, t, sectionPos);
    drawPackets(w, h, horizonY, t, dt, sectionPos);
    drawScanlines(w, h);

    window.__brainstormRenderFrames = (window.__brainstormRenderFrames || 0) + 1;
    requestAnimationFrame(frame);
  }

  function start() {
    seed();
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    requestAnimationFrame(frame);
    try { console.info("[brainstorm] Canvas2D curved-route engine running"); } catch (_) {}
  }

  // Stop the watchdog from triggering the procedural fallback once we
  // start painting frames.
  start();

  // ---- Agent wall (Foundry section roster preview) ----
  var AGENT_SAMPLE = [
    ["Executive Assistant","PA"],["Receptionist","Voice"],["SDR","Sales"],
    ["Collections","AR"],["Bookkeeper","Finance"],["Recruiter","HR"],
    ["Marketing Director","Mktg"],["Creative Director","Mktg"],["Ad Creative","Mktg"],
    ["Community Manager","Mktg"],["Content Writer","Content"],["Video Editor","Content"],
    ["Podcast Producer","Content"],["Music Producer","Content"],["Voiceover Artist","Content"],
    ["Food Photographer","Content"],["Real-Estate Photog","Content"],["AI Photographer","Content"],
    ["Logo Designer","Design"],["Translator","Ops"],["Meeting Summarizer","Ops"],
    ["Inventory Manager","Ops"],["Shipping Manager","Ops"],["Customer Onboarding","CX"],
    ["Win-Back Engine","Revenue"],["Reputation","Revenue"],["Proposal Gen","Revenue"],
    ["Outbound SDR","Revenue"],["Competitive Intel","Strat"],["Patent Research","Legal"],
    ["Contract Reviewer","Legal"],["Tax Prep","Finance"],["Grant Writer","Ops"],
    ["Event Planner","Ops"],["Course Creator","Content"],["Resume Writer","HR"],
    ["Data Dashboard","Analytics"],["Pet Care","Lifestyle"],["Fitness Coach","Lifestyle"],
    ["Gift Finder","Lifestyle"],["Daily Motivation","Lifestyle"],["Trivia Host","Lifestyle"],
    ["Grocery Commander","Lifestyle"]
  ];
  var wall = document.getElementById("agentWall");
  if (wall) {
    wall.innerHTML = AGENT_SAMPLE.map(function (a) {
      return '<div class="a"><b>' + a[0] + '</b><span>' + a[1] + '</span></div>';
    }).join("");
    var more = document.createElement("div");
    more.className = "agent-wall-more";
    more.innerHTML = '<span class="agent-wall-swipe">Swipe to browse roster</span> Plus <b>' + (270 - AGENT_SAMPLE.length) + '+</b> more.';
    wall.parentNode.insertBefore(more, wall.nextSibling);
  }

  // ---- Mobile nav toggle ----
  var hudToggle = document.getElementById("hudToggle");
  var hudNav = document.getElementById("hudNav");
  if (hudToggle && hudNav) {
    var closeNav = function () {
      hudNav.classList.remove("open");
      hudToggle.setAttribute("aria-expanded", "false");
    };
    var openNav = function () {
      hudNav.classList.add("open");
      hudToggle.setAttribute("aria-expanded", "true");
    };
    hudToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (hudNav.classList.contains("open")) closeNav(); else openNav();
    });
    var navLinks = hudNav.querySelectorAll("a");
    for (var nl = 0; nl < navLinks.length; nl++) {
      navLinks[nl].addEventListener("click", closeNav);
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && hudNav.classList.contains("open")) closeNav();
    });
    document.addEventListener("click", function (e) {
      if (!hudNav.classList.contains("open")) return;
      if (hudNav.contains(e.target) || hudToggle.contains(e.target)) return;
      closeNav();
    });
  }

  // ---- Progress rail ----
  var progressFill = document.getElementById("progressFill");
  if (progressFill) {
    var updateProgress = function () {
      var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var sy = window.scrollY || window.pageYOffset || 0;
      var pct = Math.max(0, Math.min(1, sy / docH));
      progressFill.style.width = (pct * 100).toFixed(2) + "%";
    };
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    updateProgress();
  }
})();
