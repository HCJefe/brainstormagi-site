// Brainstorm AGI primary scene engine.
// First-party Canvas2D pseudo-3D roller-coaster ride across a circuit-board
// world dotted with futuristic skyscrapers. Each section corresponds to a
// distinct facility cluster the camera flies past. Electric current reads
// as elongated tapered light trails along the track (no ball clutter).
// Motion is time-based with delta clamping and spring-smoothed scroll so
// the ride stays cinematic, not choppy.
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

  document.documentElement.dataset.sceneEngine = "canvas2d-roller-circuit";
  window.__brainstormRenderFrames = 0;

  var REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var CYAN = "#5cf2ff";
  var RED = "#ff3a3a";

  // Each section: lateral side target plus a vertical lift target so the
  // track climbs and dives between sections like a roller-coaster.
  var SECTIONS = [
    { id: "hero",        side:  0.00, lift:  0.05, type: "spire" },
    { id: "spire",       side: -0.55, lift:  0.22, type: "spire" },
    { id: "foundry",     side:  0.70, lift: -0.18, type: "foundry" },
    { id: "voice",       side: -0.80, lift:  0.28, type: "voice" },
    { id: "ops",         side:  0.60, lift: -0.14, type: "ops" },
    { id: "revenue",     side: -0.70, lift:  0.20, type: "revenue" },
    { id: "content",     side:  0.75, lift: -0.18, type: "content" },
    { id: "integration", side: -0.55, lift:  0.24, type: "integration" },
    { id: "contact",     side:  0.00, lift:  0.00, type: "contact" }
  ];

  // ---------- Stable seeded props ----------
  // Precomputed positions so nothing jitters frame-to-frame. The animation
  // comes from time-based sin curves over stable seeds, not random()s.
  var stars = [];
  var streaks = [];
  var pcbBranches = [];
  var pcbTraces = [];
  var smdChips = [];
  var sparks = [];
  var skylineProps = [];
  var distantBuildings = [];

  function seed() {
    stars.length = 0;
    for (var i = 0; i < 220; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.5,
        s: Math.random() * 1.3 + 0.4,
        tw: Math.random() * Math.PI * 2,
        red: Math.random() < 0.10
      });
    }
    // Long tapered light streaks on the track. Two lanes only so the
    // result reads as flowing current, not a swarm of beads.
    streaks.length = 0;
    var lanes = [-0.55, -0.20, 0.20, 0.55];
    for (var p = 0; p < 18; p++) {
      streaks.push({
        z: (p / 18) + (Math.random() * 0.04),
        lane: lanes[p % lanes.length],
        speed: 0.34 + Math.random() * 0.18,
        length: 0.18 + Math.random() * 0.12,
        cmd: (p % 5 === 0),
        offset: Math.random() * Math.PI * 2
      });
    }
    // Right-angle PCB traces peeling off the side of the track.
    pcbBranches.length = 0;
    for (var b = 0; b < 18; b++) {
      pcbBranches.push({
        z: b / 18 + Math.random() * 0.04,
        side: b % 2 === 0 ? -1 : 1,
        len: 0.5 + Math.random() * 0.7,
        speed: 0.04 + Math.random() * 0.05,
        red: Math.random() < 0.30
      });
    }
    // Long horizontal PCB traces flowing on the board (no dots).
    pcbTraces.length = 0;
    for (var tt = 0; tt < 18; tt++) {
      pcbTraces.push({
        z: tt / 18,
        xStart: Math.random() * 1.6 - 0.8,
        xEnd: Math.random() * 1.6 - 0.8,
        speed: 0.03 + Math.random() * 0.05,
        red: Math.random() < 0.25
      });
    }
    smdChips.length = 0;
    for (var c = 0; c < 8; c++) {
      smdChips.push({
        z: c / 8 + Math.random() * 0.04,
        side: c % 2 === 0 ? -1 : 1,
        offset: 0.95 + Math.random() * 0.5,
        w: 0.10 + Math.random() * 0.06,
        h: 0.05 + Math.random() * 0.03,
        speed: 0.04 + Math.random() * 0.04
      });
    }
    sparks.length = 0;
    for (var sp = 0; sp < 8; sp++) {
      sparks.push({
        z: sp / 8,
        speed: 0.16 + Math.random() * 0.12,
        offset: Math.random() * Math.PI * 2
      });
    }
    skylineProps.length = 0;
    for (var sk = 0; sk < 56; sk++) {
      skylineProps.push({
        nx: Math.random(),
        nh: Math.random(),
        red: Math.random() < 0.15,
        antenna: Math.random() < 0.35
      });
    }
    // Distant background skyscrapers (separate from per-section landmarks)
    distantBuildings.length = 0;
    for (var db = 0; db < 14; db++) {
      distantBuildings.push({
        z: 0.05 + Math.random() * 0.35,
        side: Math.random() < 0.5 ? -1 : 1,
        offset: 1.7 + Math.random() * 1.2,
        w: 0.06 + Math.random() * 0.05,
        h: 0.55 + Math.random() * 0.45,
        red: Math.random() < 0.20,
        seed: Math.random() * 100
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

  // ---------- Spring-smoothed scroll ----------
  // The raw scroll position is stiff and stutters under fast scrolls. A
  // critically damped spring smooths it so the camera glides between
  // sections instead of snapping.
  var rawSectionPos = 0;
  var smoothedSectionPos = 0;
  var smoothedVelocity = 0;
  var smoothedScrollFrac = 0;

  function readScroll() {
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var scrollY = window.scrollY || window.pageYOffset || 0;
    var frac = Math.max(0, Math.min(1, scrollY / docH));
    rawSectionPos = frac * (SECTIONS.length - 1);
    smoothedScrollFrac = smoothedScrollFrac + (frac - smoothedScrollFrac) * 0.18;
  }

  function stepSpring(dt) {
    // Critically damped spring on sectionPos. Stiff enough to track the
    // scroll, soft enough to blur out per-frame stutter.
    var stiffness = 28;
    var damping = 2 * Math.sqrt(stiffness);
    var x = smoothedSectionPos - rawSectionPos;
    var force = -stiffness * x - damping * smoothedVelocity;
    smoothedVelocity += force * dt;
    smoothedSectionPos += smoothedVelocity * dt;
  }

  // ---------- Spline sample table (stable per frame) ----------
  // Precomputed on every frame: at each z slice we know centerLat, lift,
  // slope. This avoids recomputing curves four or five times per slice and
  // ensures perfectly consistent geometry across draws.
  var SAMPLE_COUNT = 56;
  var samples = new Array(SAMPLE_COUNT + 1);
  for (var si = 0; si <= SAMPLE_COUNT; si++) samples[si] = { z: 0, centerLat: 0, lift: 0, slope: 0, halfW: 0, centerX: 0, groundY: 0, bank: 0 };

  function curveLateralAt(zNorm, t, sectionPos) {
    var idxA = Math.max(0, Math.min(SECTIONS.length - 1, Math.floor(sectionPos)));
    var idxB = Math.min(SECTIONS.length - 1, idxA + 1);
    var local = sectionPos - idxA;
    var ease = local * local * (3 - 2 * local);
    var sideA = SECTIONS[idxA].side;
    var sideB = SECTIONS[idxB].side;
    // Track curves down its length: far end aims at the next section,
    // near end at the current section.
    var fgSide = sideA + (sideB - sideA) * ease * 0.45;
    var bgSide = sideB + (sideA - sideB) * (1 - ease) * 0.30;
    var sway = Math.sin(t * 0.45 + zNorm * 3.0 + sectionPos * 0.6) * 0.18 * (1 - zNorm * 0.4);
    var twist = Math.cos(t * 0.30 + sectionPos * 1.4 + zNorm * 2.2) * 0.08;
    var blend = 1 - zNorm;
    return fgSide * (1 - blend) + bgSide * blend + sway + twist;
  }

  function curveLiftAt(zNorm, t, sectionPos) {
    var idxA = Math.max(0, Math.min(SECTIONS.length - 1, Math.floor(sectionPos)));
    var idxB = Math.min(SECTIONS.length - 1, idxA + 1);
    var local = sectionPos - idxA;
    var ease = local * local * (3 - 2 * local);
    var liftA = SECTIONS[idxA].lift;
    var liftB = SECTIONS[idxB].lift;
    var fg = liftA + (liftB - liftA) * ease * 0.5;
    var bg = liftB + (liftA - liftB) * (1 - ease) * 0.35;
    // Continuous coaster wave gives the track climbs and dives even within
    // a single section.
    var wave = Math.sin(t * 0.55 + zNorm * 4.6 + sectionPos * 0.7) * 0.11 * (1 - zNorm * 0.3);
    var crest = Math.sin(zNorm * Math.PI * 2 + sectionPos * 1.2 + t * 0.32) * 0.06;
    var blend = 1 - zNorm;
    return fg * (1 - blend) + bg * blend + wave + crest;
  }

  function rebuildSamples(w, h, horizonY, t, sectionPos) {
    var roadHalfFG = w * 0.66;
    var roadHalfH  = w * 0.012;
    for (var i = 0; i <= SAMPLE_COUNT; i++) {
      var z = i / SAMPLE_COUNT;
      var pp = z * z * 0.94 + z * 0.06;
      var halfW = roadHalfH + (roadHalfFG - roadHalfH) * pp;
      var lat = curveLateralAt(z, t, sectionPos);
      var lift = curveLiftAt(z, t, sectionPos);
      var centerX = w * 0.5 + lat * halfW * 1.55;
      var groundY = horizonY + (h - horizonY) * pp - lift * (h - horizonY) * 0.50 * pp;
      var s = samples[i];
      s.z = z;
      s.centerLat = lat;
      s.lift = lift;
      s.halfW = halfW;
      s.centerX = centerX;
      s.groundY = groundY;
    }
    // Pass 2: derive slope/bank from neighbors so the rails twist together.
    for (var k = 0; k <= SAMPLE_COUNT; k++) {
      var prev = samples[Math.max(0, k - 1)];
      var next = samples[Math.min(SAMPLE_COUNT, k + 1)];
      var slope = (next.centerLat - prev.centerLat);
      samples[k].slope = slope;
      samples[k].bank = slope * 1.6;
    }
  }

  // Project a track-relative coordinate using the precomputed samples.
  function projectSample(zNorm, laneOffset) {
    var z = Math.max(0, Math.min(1, zNorm));
    var f = z * SAMPLE_COUNT;
    var i0 = Math.floor(f);
    var i1 = Math.min(SAMPLE_COUNT, i0 + 1);
    var u = f - i0;
    var a = samples[i0];
    var b = samples[i1];
    var halfW = a.halfW + (b.halfW - a.halfW) * u;
    var centerX = a.centerX + (b.centerX - a.centerX) * u;
    var groundY = a.groundY + (b.groundY - a.groundY) * u;
    var bank = a.bank + (b.bank - a.bank) * u;
    var localX = laneOffset * halfW;
    var cb = Math.cos(bank * 0.18);
    var sb = Math.sin(bank * 0.18);
    return {
      x: centerX + localX * cb,
      y: groundY + localX * sb * 0.55,
      halfW: halfW,
      centerX: centerX,
      centerY: groundY,
      bank: bank
    };
  }

  // ---------- Drawing ----------

  function drawBackdrop(w, h, horizonY, scrollFrac, t) {
    var sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#020514");
    sky.addColorStop(0.45, "#070d1c");
    sky.addColorStop(0.8, "#0a1530");
    sky.addColorStop(1, "#02040a");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Cinematic sun/red glow on the horizon shifts with section.
    var cx = w * (0.45 + Math.sin(t * 0.15) * 0.04);
    var cy = horizonY - h * 0.04 - scrollFrac * 24;
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.65);
    glow.addColorStop(0, "rgba(255,90,58,0.30)");
    glow.addColorStop(0.45, "rgba(255,42,42,0.12)");
    glow.addColorStop(1, "rgba(255,42,42,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

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
      var alpha = 0.30 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.9 + s.tw));
      ctx.fillStyle = s.red ? "rgba(255,90,90," + alpha.toFixed(3) + ")"
                            : "rgba(180,210,255," + alpha.toFixed(3) + ")";
      ctx.fillRect(sx, sy, s.s, s.s);
    }
  }

  // Distant city skyline at the horizon (varies per section via drift).
  function drawDistantSkyline(w, horizonY, t, sectionPos) {
    var drift = sectionPos * 80;
    for (var i = 0; i < skylineProps.length; i++) {
      var b = skylineProps[i];
      var bx = ((b.nx * w + drift) % (w + 60)) - 30;
      var bw = 8 + (b.nh * 22);
      var bh = 6 + b.nh * 70;
      ctx.fillStyle = "#08111e";
      ctx.fillRect(bx, horizonY - bh, bw, bh);
      ctx.strokeStyle = b.red ? "rgba(255,58,58,0.6)" : "rgba(92,242,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, horizonY - bh + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1));
      if (bh > 28) {
        for (var ww = 0; ww < 3; ww++) {
          for (var hh = 0; hh < Math.floor(bh / 8); hh++) {
            if (((i + ww + hh) % 5) === 0) {
              ctx.fillStyle = "rgba(92,242,255,0.55)";
              ctx.fillRect(bx + 2 + ww * (bw / 3), horizonY - bh + 2 + hh * 7, 1.5, 2);
            }
          }
        }
      }
      if (b.antenna && bh > 36) {
        ctx.strokeStyle = "rgba(255,58,58,0.7)";
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, horizonY - bh);
        ctx.lineTo(bx + bw / 2, horizonY - bh - 8);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "rgba(92,242,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 0.5);
    ctx.lineTo(w, horizonY + 0.5);
    ctx.stroke();
  }

  // Tall dim background skyscrapers further reinforcing "city" not "road".
  function drawDistantBuildings(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < distantBuildings.length; i++) {
      var d = distantBuildings[i];
      var pp = projectSample(d.z, d.side * d.offset);
      var hgt = pp.halfW * d.h;
      var ww = pp.halfW * d.w;
      var gx = pp.x;
      var gy = pp.y;
      ctx.fillStyle = "#080f1c";
      ctx.fillRect(gx - ww, gy - hgt, ww * 2, hgt);
      ctx.strokeStyle = d.red ? "rgba(255,58,58,0.45)" : "rgba(92,242,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(gx - ww + 0.5, gy - hgt + 0.5, Math.max(1, ww * 2 - 1), Math.max(1, hgt - 1));
      // Faint window strips
      var cols = 3;
      var rows = Math.max(3, Math.floor(hgt / 7));
      for (var c = 0; c < cols; c++) {
        for (var r = 0; r < rows; r++) {
          var on = ((Math.sin(t * 0.9 + r * 1.3 + c + d.seed) + 1) * 0.5) > 0.55;
          if (!on) continue;
          ctx.fillStyle = "rgba(92,242,255,0.55)";
          ctx.fillRect(gx - ww + 2 + c * ((ww * 2 - 4) / cols), gy - hgt + 2 + r * ((hgt - 4) / rows), Math.max(1, (ww * 2 - 4) / cols - 1), 1.4);
        }
      }
    }
  }

  // Circuit board substrate underneath the track. Uses long horizontal
  // copper traces and right-angle conduits, not random dots.
  function drawCircuitBoard(w, h, horizonY, t, sectionPos) {
    var grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, "#0a1830");
    grad.addColorStop(0.5, "#0c1a2e");
    grad.addColorStop(1, "#040810");
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Faint depth grid lines.
    ctx.strokeStyle = "rgba(92,242,255,0.09)";
    ctx.lineWidth = 1;
    for (var i = 1; i < 30; i++) {
      var z = i / 30;
      var pp = z * z * 0.94 + z * 0.06;
      var y = horizonY + (h - horizonY) * pp;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Vanishing converging traces toward the track's far end.
    var farLat = samples[0].centerLat;
    var vpX = w * 0.5 + farLat * (w * 0.31);
    ctx.strokeStyle = "rgba(255,90,90,0.16)";
    for (var v = -10; v <= 10; v++) {
      if (v === 0) continue;
      var bottomX = w * 0.5 + (v / 10) * w * 0.95;
      ctx.beginPath();
      ctx.moveTo(vpX, horizonY);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }

    // Long horizontal copper traces flowing across the board (replace dots).
    for (var tIdx = 0; tIdx < pcbTraces.length; tIdx++) {
      var trace = pcbTraces[tIdx];
      trace.z += trace.speed * 0.012;
      if (trace.z > 1.05) trace.z = -0.05;
      if (trace.z < 0.02) continue;
      var pA = projectSample(trace.z, trace.xStart * 1.6);
      var pB = projectSample(trace.z, trace.xEnd * 1.6);
      ctx.strokeStyle = trace.red ? "rgba(255,90,90,0.45)" : "rgba(92,242,255,0.4)";
      ctx.lineWidth = Math.max(1, pA.halfW * 0.010);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

    // SMD chips sitting on the board.
    for (var ch = 0; ch < smdChips.length; ch++) {
      var chip = smdChips[ch];
      chip.z += chip.speed * 0.012;
      if (chip.z > 1.05) chip.z = -0.05;
      if (chip.z < 0.02) continue;
      var chipP = projectSample(chip.z, chip.side * chip.offset * 1.6);
      var cw = chipP.halfW * chip.w;
      var chh = chipP.halfW * chip.h;
      ctx.fillStyle = "#0a1428";
      ctx.fillRect(chipP.x - cw / 2, chipP.y - chh / 2, cw, chh);
      ctx.strokeStyle = "rgba(92,242,255,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(chipP.x - cw / 2, chipP.y - chh / 2, cw, chh);
      ctx.fillStyle = "rgba(255,90,58,0.85)";
      var pins = 4;
      for (var pi = 0; pi < pins; pi++) {
        var px = chipP.x - cw / 2 + (pi + 0.5) * (cw / pins);
        ctx.fillRect(px - 0.5, chipP.y - chh / 2 - 1.5, 1, 1.5);
        ctx.fillRect(px - 0.5, chipP.y + chh / 2, 1, 1.5);
      }
    }
  }

  // Pylons / supports beneath the elevated track.
  function drawTrackPylons(w, h, horizonY, t, sectionPos) {
    var COUNT = 12;
    for (var i = 1; i < COUNT; i++) {
      var z = i / COUNT;
      var pCenter = projectSample(z, 0);
      var pp = z * z * 0.94 + z * 0.06;
      var groundY = horizonY + (h - horizonY) * pp;
      if (groundY <= pCenter.y + 4) continue;
      var pylonW = Math.max(1.5, pCenter.halfW * 0.05);
      ctx.fillStyle = "rgba(20,30,55,0.85)";
      ctx.fillRect(pCenter.x - pylonW / 2, pCenter.y, pylonW, groundY - pCenter.y);
      ctx.strokeStyle = "rgba(92,242,255,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(pCenter.x - pylonW / 2, pCenter.y, pylonW, groundY - pCenter.y);
      ctx.strokeStyle = "rgba(92,242,255,0.30)";
      ctx.beginPath();
      ctx.moveTo(pCenter.x - pylonW / 2, pCenter.y);
      ctx.lineTo(pCenter.x + pylonW / 2, groundY);
      ctx.moveTo(pCenter.x + pylonW / 2, pCenter.y);
      ctx.lineTo(pCenter.x - pylonW / 2, groundY);
      ctx.stroke();
      // Footing pad (becomes a chip-pad on the PCB ground).
      ctx.fillStyle = "rgba(255,90,58,0.55)";
      ctx.beginPath();
      ctx.ellipse(pCenter.x, groundY, pylonW * 1.8, pylonW * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The elevated roller-coaster ribbon. Uses sample table so far/near
  // edges are perfectly consistent across draws.
  function drawTrackRibbon(w, h, horizonY, t, sectionPos) {
    // Underglow band: a soft cyan trail beneath the track.
    for (var u = 0; u < SAMPLE_COUNT; u += 2) {
      var u0 = u / SAMPLE_COUNT;
      var u1 = (u + 2) / SAMPLE_COUNT;
      var uL0 = projectSample(u0, -1.20);
      var uR0 = projectSample(u0,  1.20);
      var uL1 = projectSample(u1, -1.20);
      var uR1 = projectSample(u1,  1.20);
      ctx.fillStyle = "rgba(92,242,255,0.05)";
      ctx.beginPath();
      ctx.moveTo(uL0.x, uL0.y + 6);
      ctx.lineTo(uR0.x, uR0.y + 6);
      ctx.lineTo(uR1.x, uR1.y + 18);
      ctx.lineTo(uL1.x, uL1.y + 18);
      ctx.closePath();
      ctx.fill();
    }

    // Track body: dark trapezoidal slices for the deck.
    for (var i = 0; i < SAMPLE_COUNT; i++) {
      var z0 = i / SAMPLE_COUNT;
      var z1 = (i + 1) / SAMPLE_COUNT;
      var p0L = projectSample(z0, -1);
      var p0R = projectSample(z0,  1);
      var p1L = projectSample(z1, -1);
      var p1R = projectSample(z1,  1);
      var shade = 14 + Math.floor(z0 * 28);
      ctx.fillStyle = "rgb(" + shade + "," + (shade + 8) + "," + (shade + 30) + ")";
      ctx.beginPath();
      ctx.moveTo(p0L.x, p0L.y);
      ctx.lineTo(p0R.x, p0R.y);
      ctx.lineTo(p1R.x, p1R.y);
      ctx.lineTo(p1L.x, p1L.y);
      ctx.closePath();
      ctx.fill();

      // Inner copper core band.
      var cL0 = projectSample(z0, -0.45);
      var cR0 = projectSample(z0,  0.45);
      var cL1 = projectSample(z1, -0.45);
      var cR1 = projectSample(z1,  0.45);
      ctx.fillStyle = "rgba(192,68,40," + (0.18 + z0 * 0.32).toFixed(3) + ")";
      ctx.beginPath();
      ctx.moveTo(cL0.x, cL0.y);
      ctx.lineTo(cR0.x, cR0.y);
      ctx.lineTo(cR1.x, cR1.y);
      ctx.lineTo(cL1.x, cL1.y);
      ctx.closePath();
      ctx.fill();
    }

    // Cross ties: short transverse bars sliding along the track. Time-based
    // phase keeps them gliding smoothly even at variable framerate.
    var TIES = 22;
    var tiePhase = (t * 0.18) % (1 / TIES);
    for (var ti = 0; ti < TIES; ti++) {
      var tz = (ti / TIES + tiePhase);
      if (tz <= 0.02 || tz >= 1) continue;
      var tL = projectSample(tz, -0.92);
      var tR = projectSample(tz,  0.92);
      ctx.strokeStyle = "rgba(140,180,220," + (0.30 + tz * 0.5).toFixed(3) + ")";
      ctx.lineWidth = Math.max(0.8, tL.halfW * 0.012);
      ctx.beginPath();
      ctx.moveTo(tL.x, tL.y);
      ctx.lineTo(tR.x, tR.y);
      ctx.stroke();
    }

    // Side conduits drawn as long polylines so they read as continuous
    // glowing rails, not segmented dashes.
    function drawRail(side, color, glowCol, lw) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.shadowColor = glowCol;
      ctx.shadowBlur = 14;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var k = 0; k <= SAMPLE_COUNT; k++) {
        var p = projectSample(k / SAMPLE_COUNT, side);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    drawRail(-1.05, CYAN, "rgba(92,242,255,0.85)", 3);
    drawRail( 1.05, RED,  "rgba(255,58,58,0.85)", 3);
    drawRail(-0.92, "rgba(180,230,255,0.7)", "rgba(92,242,255,0.5)", 1.5);
    drawRail( 0.92, "rgba(255,170,170,0.7)", "rgba(255,58,58,0.5)", 1.5);

    // Center spine.
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var s = 0; s <= SAMPLE_COUNT; s++) {
      var pp = projectSample(s / SAMPLE_COUNT, 0);
      if (s === 0) ctx.moveTo(pp.x, pp.y); else ctx.lineTo(pp.x, pp.y);
    }
    ctx.stroke();
  }

  // Long tapered electric streaks running along the track. Each streak is
  // a continuous gradient stroke so it reads as a light trail, not beads.
  function drawElectricStreaks(w, h, horizonY, t, dt, sectionPos) {
    for (var i = 0; i < streaks.length; i++) {
      var sk = streaks[i];
      sk.z += sk.speed * dt;
      if (sk.z > 1) sk.z -= 1;
      var head = Math.min(1, sk.z);
      var tail = Math.max(0, sk.z - sk.length);
      if (head <= 0.02) continue;
      // Sample a polyline for this streak.
      var STEPS = 14;
      var pts = [];
      for (var k = 0; k <= STEPS; k++) {
        var u = tail + (head - tail) * (k / STEPS);
        if (u < 0 || u > 1) continue;
        pts.push(projectSample(u, sk.lane));
      }
      if (pts.length < 2) continue;
      var headP = pts[pts.length - 1];
      var tailP = pts[0];

      // Build a linear gradient down the streak so the head is bright and
      // the tail fades to transparent. This kills the bead look.
      var grad = ctx.createLinearGradient(tailP.x, tailP.y, headP.x, headP.y);
      if (sk.cmd) {
        grad.addColorStop(0,    "rgba(255,58,58,0)");
        grad.addColorStop(0.55, "rgba(255,58,58,0.55)");
        grad.addColorStop(1,    "rgba(255,200,180,1)");
      } else if (sk.lane < 0) {
        grad.addColorStop(0,    "rgba(92,242,255,0)");
        grad.addColorStop(0.55, "rgba(92,242,255,0.55)");
        grad.addColorStop(1,    "rgba(220,250,255,1)");
      } else {
        grad.addColorStop(0,    "rgba(255,180,140,0)");
        grad.addColorStop(0.55, "rgba(255,180,140,0.55)");
        grad.addColorStop(1,    "rgba(255,230,210,1)");
      }
      ctx.strokeStyle = grad;
      ctx.shadowColor = sk.cmd ? "rgba(255,58,58,0.95)" : "rgba(92,242,255,0.9)";
      ctx.shadowBlur = sk.cmd ? 16 : 12;
      ctx.lineWidth = Math.max(1.5, headP.halfW * 0.022 * (sk.cmd ? 1.5 : 1.0));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var pp = 1; pp < pts.length; pp++) ctx.lineTo(pts[pp].x, pts[pp].y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Sparse arcing sparks that flash briefly between the rails. Each
    // spark uses a stable phase so it does not jitter per frame.
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      sp.z += sp.speed * dt;
      if (sp.z > 1) sp.z -= 1;
      if (sp.z < 0.06) continue;
      var phase = (Math.sin(t * 1.2 + sp.offset) + 1) * 0.5;
      if (phase < 0.85) continue;
      var pa = projectSample(sp.z, -0.95);
      var pb = projectSample(sp.z,  0.95);
      var mx = (pa.x + pb.x) / 2 + Math.cos(t * 3 + sp.offset) * 8;
      var my = (pa.y + pb.y) / 2 - 6 - Math.abs(Math.sin(t * 3 + sp.offset)) * 8;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.shadowColor = "rgba(92,242,255,0.95)";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // PCB right-angle branches that peel off the track sides and connect
  // to chip pads. These replace the noisy "ball" pad clutter.
  function drawPCBBranches(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < pcbBranches.length; i++) {
      var br = pcbBranches[i];
      br.z += br.speed * 0.012;
      if (br.z > 1.05) br.z = -0.05;
      if (br.z < 0.04) continue;
      var pStart = projectSample(br.z, br.side * 1.05);
      var pEnd   = projectSample(br.z, br.side * (1.05 + br.len * 1.4));
      ctx.strokeStyle = br.red ? "rgba(255,58,58,0.7)" : "rgba(92,242,255,0.65)";
      ctx.lineWidth = Math.max(1, pStart.halfW * 0.012);
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      var midX = pStart.x + (pEnd.x - pStart.x) * 0.65;
      var midY = pStart.y;
      ctx.lineTo(midX, midY);
      ctx.lineTo(midX, pEnd.y);
      ctx.lineTo(pEnd.x, pEnd.y);
      ctx.stroke();
      // Small pad at the corner (single small marker, not a ball).
      ctx.fillStyle = br.red ? "rgba(255,90,90,0.85)" : "rgba(120,240,255,0.85)";
      ctx.fillRect(midX - 1.2, midY - 1.2, 2.4, 2.4);
    }
  }

  // ---- Section building cluster helpers ----

  function rectStrip(x, y, w_, h_, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w_, h_);
  }
  function windowGrid(x, y, w_, h_, cols, rows, t, seed) {
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var on = ((Math.sin(t * 1.4 + r * 1.3 + c * 0.7 + seed) + 1) * 0.5) > 0.45;
        var cx = x + 1.5 + c * ((w_ - 3) / cols);
        var cy = y + 1.5 + r * ((h_ - 3) / rows);
        var cw = Math.max(1, (w_ - 3) / cols - 1);
        var ch = Math.max(1, (h_ - 3) / rows - 1.2);
        ctx.fillStyle = on ? "rgba(92,242,255,0.85)" : "rgba(20,40,70,0.6)";
        ctx.fillRect(cx, cy, cw, ch);
      }
    }
  }
  function pad(p, scale) {
    ctx.fillStyle = "rgba(255,90,58,0.45)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + scale * 0.6, scale * 4.0, scale * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(92,242,255,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + scale * 0.6, scale * 4.0, scale * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSpire(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 30;
    var basew = scale * 3.4;
    var midw = scale * 2.4;
    var topw = scale * 1.4;

    var seg1H = hgt * 0.45;
    var seg2H = hgt * 0.32;
    var seg3H = hgt * 0.23;
    var y0 = p.y;
    var y1 = y0 - seg1H;
    var y2 = y1 - seg2H;
    var y3 = y2 - seg3H;

    var bg = ctx.createLinearGradient(p.x, y1, p.x, y0);
    bg.addColorStop(0, "#1a2a4a");
    bg.addColorStop(1, "#06101e");
    ctx.fillStyle = bg;
    ctx.fillRect(p.x - basew, y1, basew * 2, seg1H);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.shadowColor = "rgba(92,242,255,0.6)";
    ctx.shadowBlur = 6;
    ctx.strokeRect(p.x - basew, y1, basew * 2, seg1H);
    ctx.shadowBlur = 0;
    windowGrid(p.x - basew, y1, basew * 2, seg1H, 6, 8, t, p.x);

    ctx.fillStyle = "#0d182e";
    ctx.fillRect(p.x - midw, y2, midw * 2, seg2H);
    ctx.strokeStyle = CYAN;
    ctx.strokeRect(p.x - midw, y2, midw * 2, seg2H);
    windowGrid(p.x - midw, y2, midw * 2, seg2H, 5, 6, t, p.x + 13);

    ctx.fillStyle = "#0a1426";
    ctx.fillRect(p.x - topw, y3, topw * 2, seg3H);
    ctx.strokeStyle = RED;
    ctx.strokeRect(p.x - topw, y3, topw * 2, seg3H);
    windowGrid(p.x - topw, y3, topw * 2, seg3H, 3, 5, t, p.x + 41);

    rectStrip(p.x - basew - 1, y1 - 2, basew * 2 + 2, 2, "rgba(92,242,255,0.7)");
    rectStrip(p.x - midw - 1, y2 - 2, midw * 2 + 2, 2, "rgba(92,242,255,0.55)");

    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, y3);
    ctx.lineTo(p.x, y3 - scale * 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - scale * 1.2, y3 - scale * 3);
    ctx.lineTo(p.x + scale * 1.2, y3 - scale * 3);
    ctx.stroke();
    var beaconOn = Math.sin(t * 3) > 0;
    ctx.fillStyle = beaconOn ? RED : "#ffaa55";
    ctx.shadowColor = "rgba(255,58,58,0.9)";
    ctx.shadowBlur = beaconOn ? 10 : 4;
    ctx.beginPath();
    ctx.arc(p.x, y3 - scale * 6, Math.max(1.4, scale * 0.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawFoundry(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 22;
    var towers = [
      { x: p.x - scale * 3.4, w: scale * 1.8, h: hgt },
      { x: p.x,                w: scale * 2.2, h: hgt * 1.05 },
      { x: p.x + scale * 3.4,  w: scale * 1.6, h: hgt * 0.85 }
    ];
    towers.forEach(function (tw, idx) {
      ctx.fillStyle = "#0d182e";
      ctx.fillRect(tw.x - tw.w, p.y - tw.h, tw.w * 2, tw.h);
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(tw.x - tw.w, p.y - tw.h, tw.w * 2, tw.h);
      windowGrid(tw.x - tw.w, p.y - tw.h, tw.w * 2, tw.h, 4, 10, t, tw.x + idx * 17);
      rectStrip(tw.x - tw.w - 1, p.y - tw.h - 2, tw.w * 2 + 2, 2, "rgba(255,90,58,0.7)");
      ctx.strokeStyle = "rgba(180,200,220,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tw.x, p.y - tw.h - 2);
      ctx.lineTo(tw.x, p.y - tw.h - scale * 3);
      ctx.stroke();
      var puff = (Math.sin(t * 1.0 + idx) + 1) * 0.5;
      ctx.fillStyle = "rgba(255,200,160," + (0.18 + puff * 0.35).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(tw.x, p.y - tw.h - scale * 3 - puff * scale * 1.5, scale * (0.4 + puff * 0.3), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(255,58,58,0.8)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(towers[0].x + towers[0].w, p.y - towers[0].h * 0.6);
    ctx.lineTo(towers[1].x - towers[1].w, p.y - towers[1].h * 0.6);
    ctx.moveTo(towers[1].x + towers[1].w, p.y - towers[1].h * 0.55);
    ctx.lineTo(towers[2].x - towers[2].w, p.y - towers[2].h * 0.55);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawVoiceArray(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 28;
    var w_ = scale * 1.6;
    ctx.fillStyle = "#0a1426";
    ctx.fillRect(p.x - w_, p.y - hgt * 0.7, w_ * 2, hgt * 0.7);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - w_, p.y - hgt * 0.7, w_ * 2, hgt * 0.7);
    windowGrid(p.x - w_, p.y - hgt * 0.7, w_ * 2, hgt * 0.7, 3, 14, t, p.x);
    ctx.strokeStyle = "rgba(170,200,255,0.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt * 0.7);
    ctx.lineTo(p.x, p.y - hgt);
    ctx.stroke();
    for (var i = 1; i <= 4; i++) {
      var ry = p.y - hgt * 0.7 - (hgt * 0.3 / 5) * i;
      var rw = scale * (1.2 + i * 0.5);
      ctx.beginPath();
      ctx.moveTo(p.x - rw, ry);
      ctx.lineTo(p.x + rw, ry);
      ctx.stroke();
    }
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt, scale * 1.6, Math.PI, 0);
    ctx.stroke();
    for (var w0 = 0; w0 < 4; w0++) {
      var phase = (t * 0.7 + w0 * 0.5) % 2;
      if (phase > 1) continue;
      var rad = scale * (2 + phase * 8);
      ctx.strokeStyle = "rgba(92,242,255," + (1 - phase).toFixed(3) + ")";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y - hgt, rad, Math.PI, 0);
      ctx.stroke();
    }
    ctx.fillStyle = (Math.sin(t * 4) > 0) ? RED : "#ffaa55";
    ctx.shadowColor = "rgba(255,58,58,0.9)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt - scale * 0.4, Math.max(1.4, scale * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawOpsTower(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 26;
    var basew = scale * 2.6;
    ctx.fillStyle = "#0c1830";
    ctx.fillRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    windowGrid(p.x - basew, p.y - hgt, basew * 2, hgt, 5, 12, t, p.x);
    var deckH = scale * 2.4;
    ctx.fillStyle = "#1a2a4a";
    ctx.fillRect(p.x - basew * 1.6, p.y - hgt - deckH, basew * 3.2, deckH);
    ctx.strokeStyle = RED;
    ctx.strokeRect(p.x - basew * 1.6, p.y - hgt - deckH, basew * 3.2, deckH);
    for (var i = 0; i < 9; i++) {
      ctx.fillStyle = "rgba(92,242,255,0.85)";
      ctx.fillRect(p.x - basew * 1.55 + i * (basew * 0.36), p.y - hgt - deckH + 0.7, basew * 0.28, deckH - 1.4);
    }
    ctx.strokeStyle = "rgba(170,200,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt - deckH);
    ctx.lineTo(p.x, p.y - hgt - deckH - scale * 5);
    ctx.stroke();
    var sweep = (t * 1.1) % (Math.PI * 2);
    var radarR = scale * 4.5;
    ctx.strokeStyle = "rgba(92,242,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y - hgt - deckH, radarR, 0, Math.PI * 2);
    ctx.stroke();
    var sx = p.x + Math.cos(sweep - Math.PI / 2) * radarR;
    var sy = p.y - hgt - deckH + Math.sin(sweep - Math.PI / 2) * radarR;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(92,242,255,0.9)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt - deckH);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawReactor(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 26;
    var w_ = scale * 2.4;
    ctx.fillStyle = "#0e1a2e";
    ctx.fillRect(p.x - w_, p.y - hgt, w_ * 2, hgt);
    ctx.strokeStyle = "rgba(255,90,58,0.85)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(p.x - w_, p.y - hgt, w_ * 2, hgt);
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    var seamGrad = ctx.createLinearGradient(p.x, p.y - hgt, p.x, p.y);
    seamGrad.addColorStop(0, "rgba(255,200,120," + (0.4 + pulse * 0.4).toFixed(3) + ")");
    seamGrad.addColorStop(1, "rgba(255,90,58,0.95)");
    ctx.fillStyle = seamGrad;
    ctx.fillRect(p.x - scale * 0.5, p.y - hgt + 2, scale, hgt - 4);
    ctx.shadowColor = "rgba(255,90,58,0.95)";
    ctx.shadowBlur = 14;
    ctx.fillRect(p.x - scale * 0.25, p.y - hgt + 2, scale * 0.5, hgt - 4);
    ctx.shadowBlur = 0;
    for (var sd = -1; sd <= 1; sd += 2) {
      windowGrid(p.x + sd * (w_ * 0.55) - w_ * 0.35, p.y - hgt + 2, w_ * 0.7, hgt - 4, 2, 12, t, p.x + sd * 31);
    }
    var coreY = p.y - hgt * 0.78;
    for (var i = 0; i < 4; i++) {
      var rr = scale * (2.5 + i * 1.2);
      var rot = t * (0.5 + i * 0.15) + i;
      ctx.strokeStyle = i % 2 === 0 ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(p.x, coreY, rr, rr * 0.32, rot, 0, Math.PI * 2);
      ctx.stroke();
    }
    var coreGrad = ctx.createRadialGradient(p.x, coreY, 0, p.x, coreY, scale * 4);
    coreGrad.addColorStop(0, "rgba(255,200,120," + pulse.toFixed(3) + ")");
    coreGrad.addColorStop(0.5, "rgba(255,90,58,0.45)");
    coreGrad.addColorStop(1, "rgba(255,58,58,0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(p.x, coreY, scale * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - hgt);
    ctx.lineTo(p.x, p.y - hgt - scale * 3);
    ctx.stroke();
  }

  function drawContentForge(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 22;
    var basew = scale * 5.0;
    ctx.fillStyle = "#0a1628";
    ctx.fillRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(p.x - basew, p.y - hgt, basew * 2, hgt);
    var lowerH = hgt * 0.45;
    windowGrid(p.x - basew, p.y - lowerH, basew * 2, lowerH, 10, 4, t, p.x);
    var facadeY = p.y - hgt + 4;
    var facadeH = hgt - lowerH - 8;
    ctx.fillStyle = "rgba(8,18,38,0.9)";
    ctx.fillRect(p.x - basew + 4, facadeY, basew * 2 - 8, facadeH);
    var bars = 12;
    for (var i = 0; i < bars; i++) {
      var bh = (Math.sin(t * 1.6 + i) + 1) * 0.5 * (facadeH - 4) + 2;
      var bx = p.x - basew + 6 + i * ((basew * 2 - 12) / bars);
      var bw = (basew * 2 - 12) / bars - 1;
      ctx.fillStyle = i < bars / 2 ? "rgba(92,242,255,0.85)" : "rgba(255,58,58,0.85)";
      ctx.fillRect(bx, facadeY + facadeH - bh - 2, bw, bh);
    }
    rectStrip(p.x - basew - 1, p.y - hgt - 2, basew * 2 + 2, 2, "rgba(255,90,58,0.8)");
    for (var k = -1; k <= 1; k++) {
      var on = Math.sin(t * 2.4 + k) > 0;
      ctx.fillStyle = on ? "#ffaa55" : RED;
      ctx.shadowColor = "rgba(255,58,58,0.9)";
      ctx.shadowBlur = on ? 10 : 4;
      ctx.beginPath();
      ctx.arc(p.x + k * basew * 0.7, p.y - hgt - 4, Math.max(1.4, scale * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawIntegrationDome(p, scale, t) {
    pad(p, scale);
    var towerH = scale * 16;
    var towerW = scale * 1.3;
    ctx.fillStyle = "#0a1426";
    ctx.fillRect(p.x - towerW, p.y - towerH, towerW * 2, towerH);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(p.x - towerW, p.y - towerH, towerW * 2, towerH);
    windowGrid(p.x - towerW, p.y - towerH, towerW * 2, towerH, 2, 9, t, p.x + 7);

    var domeR = scale * 4.5;
    var cy = p.y - domeR;
    var grad = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, domeR);
    grad.addColorStop(0, "rgba(92,242,255,0.5)");
    grad.addColorStop(1, "rgba(10,20,40,0.9)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, cy, domeR, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (var i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(p.x, cy, domeR * (1 - i * 0.18), domeR * 0.18 * (4 - i), 0, Math.PI, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(92,242,255,0.5)";
    for (var j = -2; j <= 2; j++) {
      var ang = j * 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(Math.PI / 2 + ang) * domeR, cy + Math.sin(Math.PI / 2 + ang) * domeR);
      ctx.lineTo(p.x, cy);
      ctx.stroke();
    }
    for (var k = 0; k < 6; k++) {
      var a = (k / 6) * Math.PI - Math.PI;
      var bx = p.x + Math.cos(a) * domeR * 1.7;
      var by = cy + Math.sin(a) * domeR * 0.75;
      if (by > p.y) by = p.y;
      ctx.strokeStyle = (k % 2 === 0) ? RED : CYAN;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(a) * domeR, cy + Math.sin(a) * domeR);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = (k % 2 === 0) ? "rgba(255,58,58,0.9)" : "rgba(92,242,255,0.9)";
      ctx.fillRect(bx - 1.6, by - 1.6, 3.2, 3.2);
    }
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, cy - domeR);
    ctx.lineTo(p.x, cy - domeR - scale * 4);
    ctx.stroke();
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = "rgba(255,200,120," + pulse.toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(p.x, cy - domeR - scale * 4, Math.max(1.2, scale * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawContactPad(p, scale, t) {
    pad(p, scale);
    var padR = scale * 5.0;
    ctx.fillStyle = "rgba(20,28,52,0.95)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, padR, padR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    var ringPulse = (t * 0.6) % 1;
    var rRad = padR * (0.4 + ringPulse * 0.9);
    ctx.strokeStyle = "rgba(92,242,255," + (1 - ringPulse).toFixed(3) + ")";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rRad, rRad * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    var towerH = scale * 18;
    var towerW = scale * 0.8;
    ctx.fillStyle = "#0c1828";
    ctx.fillRect(p.x - towerW, p.y - towerH, towerW * 2, towerH);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(p.x - towerW, p.y - towerH, towerW * 2, towerH);
    var stripGrad = ctx.createLinearGradient(p.x, p.y - towerH, p.x, p.y);
    stripGrad.addColorStop(0, "rgba(92,242,255,0)");
    stripGrad.addColorStop(1, "rgba(92,242,255,0.95)");
    ctx.fillStyle = stripGrad;
    ctx.fillRect(p.x - 0.8, p.y - towerH, 1.6, towerH);
    var beacon = (Math.sin(t * 2.4) > 0);
    ctx.fillStyle = beacon ? RED : "#ffaa55";
    ctx.shadowColor = "rgba(255,58,58,0.9)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y - towerH - scale * 0.6, Math.max(1.4, scale * 0.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    for (var k = 0; k < 6; k++) {
      var ang = (k / 6) * Math.PI * 2;
      var mx = p.x + Math.cos(ang) * padR * 0.92;
      var my = p.y + Math.sin(ang) * padR * 0.4 * 0.92;
      ctx.fillStyle = (k % 2 === 0) ? RED : CYAN;
      ctx.fillRect(mx - 0.5, my - scale * 1.5, 1, scale * 1.5);
      ctx.fillRect(mx - 1.2, my - scale * 1.7 - 1.2, 2.4, 2.4);
    }
  }

  function drawSectionBuildings(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < SECTIONS.length; i++) {
      var sec = SECTIONS[i];
      var rel = i - sectionPos;
      var z = 0.62 - rel * 0.30;
      if (z <= 0.04 || z >= 0.96) continue;
      var lateral = 1.55;
      var p = projectSample(z, (sec.side >= 0 ? 1 : -1) * (Math.abs(sec.side) * 0.6 + lateral));
      var scale = p.halfW * 0.060;
      ctx.save();
      ctx.globalAlpha = Math.max(0.30, Math.min(1, 0.45 + z * 0.85));
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
    ctx.fillStyle = "rgba(255,255,255,0.022)";
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
    // Time-based delta with hard clamp so a backgrounded tab does not jump
    // the world when it returns.
    var dt = Math.min(0.05, Math.max(0.001, now - lastFrame));
    lastFrame = now;

    readScroll();
    if (REDUCED_MOTION) {
      // Snap directly to the target instead of springing.
      smoothedSectionPos = rawSectionPos;
      smoothedVelocity = 0;
    } else {
      stepSpring(dt);
    }
    var sectionPos = Math.max(0, Math.min(SECTIONS.length - 1, smoothedSectionPos));
    var scrollFrac = smoothedScrollFrac;
    var horizonY = h * (0.46 - scrollFrac * 0.06);

    // Rebuild the spline sample table once per frame so every draw call
    // reads from the same stable data (smoothness + cheaper than 5x recompute).
    rebuildSamples(w, h, horizonY, t, sectionPos);

    // Subtle motion-blur trail: dim the prior frame instead of fully
    // clearing. Keeps text legible because text is DOM, not canvas.
    if (!REDUCED_MOTION) {
      ctx.fillStyle = "rgba(2,5,18,0.55)";
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    drawBackdrop(w, h, horizonY, scrollFrac, t);
    drawStars(w, horizonY, t);
    drawDistantSkyline(w, horizonY, t, sectionPos);
    drawCircuitBoard(w, h, horizonY, t, sectionPos);
    drawDistantBuildings(w, h, horizonY, t, sectionPos);
    drawTrackPylons(w, h, horizonY, t, sectionPos);
    drawTrackRibbon(w, h, horizonY, t, sectionPos);
    drawPCBBranches(w, h, horizonY, t, sectionPos);
    drawSectionBuildings(w, h, horizonY, t, sectionPos);
    drawElectricStreaks(w, h, horizonY, t, dt, sectionPos);
    drawScanlines(w, h);

    window.__brainstormRenderFrames = (window.__brainstormRenderFrames || 0) + 1;
    requestAnimationFrame(frame);
  }

  function start() {
    seed();
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);
    requestAnimationFrame(frame);
    try { console.info("[brainstorm] Canvas2D roller-circuit smooth engine running"); } catch (_) {}
  }

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
