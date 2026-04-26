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

  document.documentElement.dataset.sceneEngine = "canvas2d-elevated-rails";
  window.__brainstormRenderFrames = 0;

  var REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var CYAN = "#5cf2ff";
  var RED = "#ff3a3a";

  // Each section: lateral side target plus a vertical lift target so the
  // track climbs and dives between sections like a roller-coaster. Sides
  // alternate aggressively so the route reads as a serpentine S-curve.
  var SECTIONS = [
    { id: "hero",        side:  0.55, lift:  0.18, type: "spire" },
    { id: "spire",       side: -0.85, lift:  0.34, type: "spire" },
    { id: "foundry",     side:  0.90, lift: -0.22, type: "foundry" },
    { id: "voice",       side: -0.95, lift:  0.40, type: "voice" },
    { id: "ops",         side:  0.85, lift: -0.18, type: "ops" },
    { id: "revenue",     side: -0.90, lift:  0.32, type: "revenue" },
    { id: "content",     side:  0.95, lift: -0.22, type: "content" },
    { id: "integration", side: -0.80, lift:  0.36, type: "integration" },
    { id: "contact",     side:  0.10, lift:  0.05, type: "contact" }
  ];

  // ---------- Stable seeded props ----------
  // Precomputed positions so nothing jitters frame-to-frame. The animation
  // comes from time-based sin curves over stable seeds, not random()s.
  var stars = [];
  var streaks = [];
  var pcbBranches = [];
  var pcbTraces = [];
  var pcbVias = [];
  var pcbConnectors = [];
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
    // Streaks ride exactly on the two rails so the electric current
    // visibly flows along the rails, not across an imaginary roadway.
    var lanes = [-0.85, 0.85];
    for (var p = 0; p < 14; p++) {
      streaks.push({
        z: (p / 14) + (Math.random() * 0.04),
        lane: lanes[p % lanes.length],
        speed: 0.34 + Math.random() * 0.18,
        length: 0.16 + Math.random() * 0.10,
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
    for (var c = 0; c < 14; c++) {
      smdChips.push({
        z: c / 14 + Math.random() * 0.04,
        side: c % 2 === 0 ? -1 : 1,
        offset: 1.10 + Math.random() * 0.9,
        w: 0.13 + Math.random() * 0.08,
        h: 0.06 + Math.random() * 0.04,
        speed: 0.04 + Math.random() * 0.04,
        red: Math.random() < 0.30,
        label: ["IC","U1","U2","MCU","RAM","DSP","FPGA"][c % 7]
      });
    }
    // Circular vias / solder pads dotting the board.
    pcbVias.length = 0;
    for (var vv = 0; vv < 36; vv++) {
      pcbVias.push({
        z: vv / 36 + Math.random() * 0.02,
        side: Math.random() < 0.5 ? -1 : 1,
        offset: 0.85 + Math.random() * 1.5,
        r: 0.014 + Math.random() * 0.012,
        speed: 0.04 + Math.random() * 0.04,
        red: Math.random() < 0.30
      });
    }
    // Connector pads (small rectangle clusters along edges).
    pcbConnectors.length = 0;
    for (var cn = 0; cn < 10; cn++) {
      pcbConnectors.push({
        z: cn / 10 + Math.random() * 0.04,
        side: cn % 2 === 0 ? -1 : 1,
        offset: 1.45 + Math.random() * 0.9,
        pins: 4 + Math.floor(Math.random() * 4),
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
    // Track curves strongly down its length so a visible S-bend appears in
    // the foreground/midground at all times. Far end aims at the next
    // section, near end at the current section.
    var fgSide = sideA + (sideB - sideA) * ease * 0.55;
    var bgSide = sideB + (sideA - sideB) * (1 - ease) * 0.45;
    // Strong serpentine sway that varies with depth and time. A
    // depth-driven sin wave forces a visible S-curve regardless of
    // section position so QA always sees turns, not a straight line.
    var sway = Math.sin(zNorm * 5.2 + sectionPos * 1.1 + t * 0.35) * 0.55 * (0.4 + zNorm * 0.6);
    var twist = Math.cos(t * 0.25 + sectionPos * 1.4 + zNorm * 2.4) * 0.18;
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
    // Strong baseline elevation so the track always reads as suspended
    // above the PCB, never flush with the ground.
    var baseLift = 0.22 + zNorm * 0.10;
    // Continuous coaster wave gives the track climbs and dives even within
    // a single section.
    var wave = Math.sin(t * 0.55 + zNorm * 4.6 + sectionPos * 0.7) * 0.13 * (1 - zNorm * 0.3);
    var crest = Math.sin(zNorm * Math.PI * 2 + sectionPos * 1.2 + t * 0.32) * 0.08;
    var blend = 1 - zNorm;
    return fg * (1 - blend) + bg * blend + wave + crest + baseLift;
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
    // Bank is intentionally exaggerated so the inner rail is unmistakably
    // higher/lower than the outer rail in a screenshot.
    for (var k = 0; k <= SAMPLE_COUNT; k++) {
      var prev = samples[Math.max(0, k - 1)];
      var next = samples[Math.min(SAMPLE_COUNT, k + 1)];
      var slope = (next.centerLat - prev.centerLat);
      samples[k].slope = slope;
      samples[k].bank = slope * 6.5;
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
    var cb = Math.cos(bank * 0.35);
    var sb = Math.sin(bank * 0.35);
    return {
      x: centerX + localX * cb,
      y: groundY + localX * sb * 1.1,
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

  // Distant city skyline at the horizon: stepped pseudo-3D silhouettes
  // (front face + side parallelogram + tapered crown) so the city does
  // not read as a row of flat rectangles.
  function drawDistantSkyline(w, horizonY, t, sectionPos) {
    var drift = sectionPos * 80;
    for (var i = 0; i < skylineProps.length; i++) {
      var b = skylineProps[i];
      var bx = ((b.nx * w + drift) % (w + 60)) - 30;
      var bw = 10 + (b.nh * 26);
      var bh = 14 + b.nh * 80;
      var depth = 3 + b.nh * 6;
      var topY = horizonY - bh;
      // Side parallelogram (right)
      ctx.fillStyle = "#04080f";
      ctx.beginPath();
      ctx.moveTo(bx + bw, topY);
      ctx.lineTo(bx + bw + depth, topY - depth * 0.5);
      ctx.lineTo(bx + bw + depth, horizonY - depth * 0.5);
      ctx.lineTo(bx + bw, horizonY);
      ctx.closePath();
      ctx.fill();
      // Top cap parallelogram
      ctx.fillStyle = "#0f1c30";
      ctx.beginPath();
      ctx.moveTo(bx, topY);
      ctx.lineTo(bx + bw, topY);
      ctx.lineTo(bx + bw + depth, topY - depth * 0.5);
      ctx.lineTo(bx + depth, topY - depth * 0.5);
      ctx.closePath();
      ctx.fill();
      // Front face
      ctx.fillStyle = "#08111e";
      ctx.fillRect(bx, topY, bw, bh);
      ctx.strokeStyle = b.red ? "rgba(255,58,58,0.7)" : "rgba(92,242,255,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, topY + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1));
      // Stepped setback (a smaller block on top)
      if (bh > 30) {
        var stepW = bw * 0.55;
        var stepH = Math.min(20, bh * 0.30);
        var stepX = bx + (bw - stepW) / 2;
        var stepY = topY - stepH;
        ctx.fillStyle = "#0f1c30";
        ctx.beginPath();
        ctx.moveTo(stepX + stepW, stepY);
        ctx.lineTo(stepX + stepW + depth * 0.7, stepY - depth * 0.35);
        ctx.lineTo(stepX + stepW + depth * 0.7, topY - depth * 0.35);
        ctx.lineTo(stepX + stepW, topY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#08111e";
        ctx.fillRect(stepX, stepY, stepW, stepH);
        ctx.strokeStyle = "rgba(92,242,255,0.5)";
        ctx.strokeRect(stepX + 0.5, stepY + 0.5, stepW - 1, stepH - 1);
      }
      // Window strips
      if (bh > 28) {
        for (var ww = 0; ww < 3; ww++) {
          for (var hh = 0; hh < Math.floor(bh / 8); hh++) {
            if (((i + ww + hh) % 5) === 0) {
              ctx.fillStyle = "rgba(92,242,255,0.65)";
              ctx.fillRect(bx + 2 + ww * (bw / 3), topY + 2 + hh * 7, 1.5, 2);
            }
          }
        }
      }
      if (b.antenna && bh > 36) {
        ctx.strokeStyle = "rgba(255,58,58,0.85)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bx + bw / 2, topY);
        ctx.lineTo(bx + bw / 2, topY - 10);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,90,58,0.8)";
        ctx.fillRect(bx + bw / 2 - 1, topY - 11, 2, 2);
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

  // PCB substrate. Drawn entirely in screen-space (NOT projected through
  // the track curve) so traces never read as road lanes. The track ribbon
  // sits ON TOP of this layer with its own visible underside, so the PCB
  // and the elevated track are visually distinct.
  function drawPCBSubstrate(w, h, horizonY, t, sectionPos) {
    // Solder-mask plane: bright graphite green so it cannot be confused
    // with asphalt. Vertical gradient for depth, but the dominant hue is
    // unmistakably PCB.
    var grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, "#0c3a30");
    grad.addColorStop(0.45, "#114a3a");
    grad.addColorStop(1, "#04180f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Silkscreen border line at the top of the board (right at horizon).
    ctx.strokeStyle = "rgba(180,255,220,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 2);
    ctx.lineTo(w, horizonY + 2);
    ctx.stroke();

    // ---- Screen-space orthogonal copper traces ----
    // Drawn as straight horizontal+vertical Manhattan paths so they read
    // unambiguously as PCB traces, not as road lanes that follow the curve.
    var boardH = h - horizonY;
    var rowSpacing = boardH / 9;
    var driftX = ((sectionPos * 80) % 90);
    for (var row = 0; row < 9; row++) {
      var ry = horizonY + 14 + row * rowSpacing;
      // Faint etched horizontal rail
      ctx.strokeStyle = "rgba(140,255,200," + (0.10 + row * 0.025).toFixed(3) + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(w, ry);
      ctx.stroke();
      // Bright copper trace with right-angle bends
      ctx.strokeStyle = (row % 3 === 0) ? "rgba(255,160,90,0.85)" : "rgba(170,255,210,0.85)";
      ctx.lineWidth = Math.max(2, 2 + row * 0.4);
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      var segLen = 70 + row * 10;
      var startX = -((row * 37 + driftX) % segLen);
      var x = startX;
      var y = ry;
      ctx.moveTo(x, y);
      var pulseOn = ((Math.floor(t * 1.2 + row) % 2) === 0);
      while (x < w + segLen) {
        var nx = x + segLen;
        ctx.lineTo(nx, y);
        // Drop or rise to next stripe with a right-angle corner
        var dy = ((row + Math.floor(nx / segLen)) % 2 === 0) ? rowSpacing * 0.45 : -rowSpacing * 0.45;
        ctx.lineTo(nx, y + dy);
        // Corner via marker
        x = nx;
        y = y + dy;
      }
      ctx.stroke();
      if (pulseOn) {
        ctx.strokeStyle = "rgba(255,255,255,0.30)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // ---- Vertical Manhattan traces ----
    var colCount = Math.max(8, Math.floor(w / 110));
    for (var col = 0; col < colCount; col++) {
      var cx = ((col + 0.5) * (w / colCount) + (sectionPos * 30) % 60) % w;
      ctx.strokeStyle = (col % 4 === 0) ? "rgba(255,160,90,0.55)" : "rgba(170,255,210,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, horizonY + 6);
      // Step corner roughly halfway down
      var stepY = horizonY + boardH * (0.4 + (col % 3) * 0.12);
      ctx.lineTo(cx, stepY);
      var dxStep = ((col % 2 === 0) ? 28 : -28);
      ctx.lineTo(cx + dxStep, stepY);
      ctx.lineTo(cx + dxStep, h);
      ctx.stroke();
    }

    // ---- Big visible vias along the board ----
    var viaRows = 5;
    for (var vr = 0; vr < viaRows; vr++) {
      var vy = horizonY + 22 + vr * (boardH / viaRows);
      var viasInRow = 6 + vr * 2;
      for (var vc = 0; vc < viasInRow; vc++) {
        var vx = ((vc + 0.5) * (w / viasInRow) + (sectionPos * 20 * (vr + 1)) % (w / viasInRow));
        var rOuter = 4 + vr * 1.4;
        var rInner = rOuter * 0.42;
        // Annular ring
        ctx.fillStyle = (vc % 5 === 0) ? "rgba(255,180,110,0.95)" : "rgba(170,255,210,0.95)";
        ctx.beginPath();
        ctx.arc(vx, vy, rOuter, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#03100a";
        ctx.beginPath();
        ctx.arc(vx, vy, rInner, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(vx, vy, rOuter, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---- SMD chip footprints scattered on the board (screen-space) ----
    var chipPositions = [
      { x: 0.10, y: 0.20, w: 80, h: 38, label: "MCU" },
      { x: 0.86, y: 0.18, w: 70, h: 32, label: "DSP" },
      { x: 0.18, y: 0.55, w: 100, h: 44, label: "FPGA" },
      { x: 0.78, y: 0.50, w: 90, h: 40, label: "RAM" },
      { x: 0.30, y: 0.82, w: 110, h: 50, label: "U1" },
      { x: 0.66, y: 0.86, w: 110, h: 50, label: "U2" }
    ];
    for (var cp = 0; cp < chipPositions.length; cp++) {
      var cps = chipPositions[cp];
      var ccx = cps.x * w;
      var ccy = horizonY + cps.y * boardH;
      var cw = cps.w;
      var chh = cps.h;
      // Chip body
      ctx.fillStyle = "#040f0a";
      ctx.fillRect(ccx - cw / 2, ccy - chh / 2, cw, chh);
      ctx.strokeStyle = "rgba(190,255,220,0.95)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(ccx - cw / 2, ccy - chh / 2, cw, chh);
      // Pin-1 dot
      ctx.fillStyle = "rgba(255,180,110,0.95)";
      ctx.beginPath();
      ctx.arc(ccx - cw / 2 + 5, ccy - chh / 2 + 5, 2, 0, Math.PI * 2);
      ctx.fill();
      // Pin rows: vertical pins on left/right, drawn in copper
      var pinCount = Math.max(6, Math.floor(chh / 5));
      ctx.fillStyle = "rgba(255,210,140,0.95)";
      for (var pi = 0; pi < pinCount; pi++) {
        var py = ccy - chh / 2 + 4 + pi * ((chh - 8) / (pinCount - 1));
        ctx.fillRect(ccx - cw / 2 - 4, py - 1, 4, 2);
        ctx.fillRect(ccx + cw / 2,     py - 1, 4, 2);
      }
      // Top/bottom pins
      var topPins = Math.max(4, Math.floor(cw / 8));
      for (var ti = 0; ti < topPins; ti++) {
        var ppx = ccx - cw / 2 + 4 + ti * ((cw - 8) / (topPins - 1));
        ctx.fillRect(ppx - 1, ccy - chh / 2 - 4, 2, 4);
        ctx.fillRect(ppx - 1, ccy + chh / 2,     2, 4);
      }
      // Silkscreen label
      ctx.fillStyle = "rgba(220,255,235,0.85)";
      ctx.font = "bold 11px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cps.label, ccx, ccy);
    }

    // ---- Connector pad strips along bottom edge ----
    var connY = h - 20;
    for (var ck = 0; ck < 4; ck++) {
      var groupX = w * (0.12 + ck * 0.22);
      for (var pn = 0; pn < 8; pn++) {
        var gx = groupX + pn * 6;
        ctx.fillStyle = "rgba(255,210,140,0.95)";
        ctx.fillRect(gx - 2, connY - 6, 4, 8);
        ctx.strokeStyle = "rgba(80,40,10,0.85)";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(gx - 2, connY - 6, 4, 8);
      }
    }
  }

  // Visible support trusses beneath the elevated track. Each truss is a
  // wide A-frame with two vertical columns spanning the rail gap, multiple
  // stages of X-bracing, horizontal cap braces, and bright copper footing
  // pads on the PCB. Drawn frequently and at large scale so QA cannot
  // miss them in any desktop screenshot.
  var RAIL_OUTER_REF = 0.85;
  function drawSupportTrusses(w, h, horizonY, t, sectionPos) {
    var COUNT = 16;
    for (var i = 1; i <= COUNT; i++) {
      var z = i / COUNT;
      // Anchor each truss column directly under the corresponding rail.
      var pL = projectSample(z, -RAIL_OUTER_REF);
      var pR = projectSample(z,  RAIL_OUTER_REF);
      var pp = z * z * 0.94 + z * 0.06;
      var groundY = horizonY + (h - horizonY) * pp + 6;
      var underYL = pL.y + 3;
      var underYR = pR.y + 3;
      var dropL = groundY - underYL;
      var dropR = groundY - underYR;
      if (dropL <= 18 || dropR <= 18) continue;
      var pylonW = Math.max(5, pL.halfW * 0.045);
      var leftX = pL.x;
      var rightX = pR.x;

      // ---- Footing solder pads on PCB ----
      function footingPad(fx, fy) {
        var rPad = pylonW * 2.4;
        ctx.fillStyle = "rgba(255,200,120,0.98)";
        ctx.beginPath();
        ctx.ellipse(fx, fy, rPad, rPad * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#03100a";
        ctx.beginPath();
        ctx.ellipse(fx, fy, rPad * 0.42, rPad * 0.20, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(fx, fy, rPad, rPad * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Glow halo
        var gh = ctx.createRadialGradient(fx, fy, 0, fx, fy, rPad * 1.6);
        gh.addColorStop(0, "rgba(255,200,120,0.3)");
        gh.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = gh;
        ctx.beginPath();
        ctx.ellipse(fx, fy, rPad * 1.6, rPad * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      footingPad(leftX, groundY);
      footingPad(rightX, groundY);

      // ---- Pseudo-3D columns (two vertical pylons, one under each rail) ----
      function pillar(px, topY, bottomY) {
        var dropH = bottomY - topY;
        var pg = ctx.createLinearGradient(px - pylonW, 0, px + pylonW, 0);
        pg.addColorStop(0,   "#08111e");
        pg.addColorStop(0.45, "#22385e");
        pg.addColorStop(0.55, "#2c456e");
        pg.addColorStop(1,   "#04080f");
        ctx.fillStyle = pg;
        ctx.fillRect(px - pylonW, topY, pylonW * 2, dropH);
        ctx.strokeStyle = "rgba(170,220,255,0.95)";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(px - pylonW + 0.5, topY + 0.5, pylonW * 2 - 1, dropH - 1);
        // Bright cyan rib up the center
        ctx.strokeStyle = "rgba(92,242,255,0.85)";
        ctx.shadowColor = "rgba(92,242,255,0.7)";
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(px, topY + 2);
        ctx.lineTo(px, bottomY - 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      pillar(leftX,  underYL, groundY);
      pillar(rightX, underYR, groundY);

      // ---- Multi-stage X bracing across the gap ----
      var avgUnder = (underYL + underYR) * 0.5;
      var avgDrop = groundY - avgUnder;
      var stages = Math.max(3, Math.floor(avgDrop / 28));
      for (var st = 0; st < stages; st++) {
        var f0 = st / stages;
        var f1 = (st + 1) / stages;
        var lyA = underYL + (groundY - underYL) * f0 + 3;
        var lyB = underYL + (groundY - underYL) * f1 - 3;
        var ryA = underYR + (groundY - underYR) * f0 + 3;
        var ryB = underYR + (groundY - underYR) * f1 - 3;
        // X braces (cyan, glowing)
        ctx.strokeStyle = "rgba(92,242,255,0.95)";
        ctx.shadowColor = "rgba(92,242,255,0.65)";
        ctx.shadowBlur = 5;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(leftX,  lyA);
        ctx.lineTo(rightX, ryB);
        ctx.moveTo(rightX, ryA);
        ctx.lineTo(leftX,  lyB);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Connection nodes at the X intersection
        var midX = (leftX + rightX) / 2;
        var midY = (lyA + lyB + ryA + ryB) / 4;
        ctx.fillStyle = "rgba(255,210,150,0.95)";
        ctx.beginPath();
        ctx.arc(midX, midY, 2.2, 0, Math.PI * 2);
        ctx.fill();
        // Horizontal stage brace (copper)
        ctx.strokeStyle = "rgba(255,180,110,0.95)";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(leftX  - pylonW * 0.5, lyB);
        ctx.lineTo(rightX + pylonW * 0.5, ryB);
        ctx.stroke();
      }

      // ---- Top cap brace right at the rail underside (across the gap) ----
      ctx.strokeStyle = "rgba(255,220,160,1)";
      ctx.shadowColor = "rgba(255,200,120,0.6)";
      ctx.shadowBlur = 5;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(leftX  - pylonW * 0.7, underYL + 1);
      ctx.lineTo(rightX + pylonW * 0.7, underYR + 1);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Two separate elevated rails. No road slab. No deck. Each rail is a
  // thick glowing tube (cyan left, red right) with a separate dark cast
  // shadow projected onto the PCB beneath it. Cross ties span the gap
  // between the rails as visible bars, slanting on banked curves. Banking
  // is exaggerated so on turns one rail sits noticeably higher on screen.
  function drawElevatedTrack(w, h, horizonY, t, sectionPos) {
    var RAIL_OUTER = 0.85;

    // ---- 1) Per-rail cast shadows on the PCB ----
    // Two narrow elliptical shadow strips, one beneath each rail. Drawing
    // them separately (not as a single road slab) preserves the gap.
    for (var sh = 0; sh < SAMPLE_COUNT; sh += 2) {
      var sz = sh / SAMPLE_COUNT;
      var spL = projectSample(sz, -RAIL_OUTER);
      var spR = projectSample(sz,  RAIL_OUTER);
      var pp = sz * sz * 0.94 + sz * 0.06;
      var groundY = horizonY + (h - horizonY) * pp + 6;
      var shHalf = spL.halfW * 0.30;
      var sgL = ctx.createRadialGradient(spL.x, groundY, 0, spL.x, groundY, shHalf);
      sgL.addColorStop(0, "rgba(0,0,0,0.55)");
      sgL.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sgL;
      ctx.beginPath();
      ctx.ellipse(spL.x, groundY, shHalf, shHalf * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      var sgR = ctx.createRadialGradient(spR.x, groundY, 0, spR.x, groundY, shHalf);
      sgR.addColorStop(0, "rgba(0,0,0,0.55)");
      sgR.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sgR;
      ctx.beginPath();
      ctx.ellipse(spR.x, groundY, shHalf, shHalf * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- 2) Cross ties between the rails. Drawn FIRST so the rails
    //         crown them. Each tie is a thick bar with a dark underside,
    //         and slants on banked curves because L and R y differ. ----
    var TIES = 30;
    var tiePhase = (t * 0.16) % (1 / TIES);
    for (var ti = 0; ti < TIES; ti++) {
      var tz = (ti / TIES + tiePhase);
      if (tz <= 0.02 || tz >= 1) continue;
      var tL = projectSample(tz, -RAIL_OUTER);
      var tR = projectSample(tz,  RAIL_OUTER);
      var tieThick = Math.max(3, tL.halfW * 0.052);
      // Underside / shadow body of the tie
      ctx.strokeStyle = "rgba(8,12,22,0.95)";
      ctx.lineWidth = tieThick + 2;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(tL.x, tL.y + 2);
      ctx.lineTo(tR.x, tR.y + 2);
      ctx.stroke();
      // Tie main body: dark steel
      ctx.strokeStyle = "rgba(80,100,140,0.95)";
      ctx.lineWidth = tieThick;
      ctx.beginPath();
      ctx.moveTo(tL.x, tL.y);
      ctx.lineTo(tR.x, tR.y);
      ctx.stroke();
      // Highlighted top edge
      ctx.strokeStyle = "rgba(210,235,255," + (0.65 + tz * 0.3).toFixed(3) + ")";
      ctx.lineWidth = Math.max(1.2, tieThick * 0.30);
      ctx.beginPath();
      ctx.moveTo(tL.x, tL.y - tieThick * 0.45);
      ctx.lineTo(tR.x, tR.y - tieThick * 0.45);
      ctx.stroke();
      // End caps as small bright squares so the ties read as solid bars
      ctx.fillStyle = "rgba(255,210,150,0.95)";
      ctx.fillRect(tL.x - tieThick * 0.4, tL.y - tieThick * 0.5, tieThick * 0.8, tieThick * 1.0);
      ctx.fillRect(tR.x - tieThick * 0.4, tR.y - tieThick * 0.5, tieThick * 0.8, tieThick * 1.0);
    }

    // ---- 3) The two rails, drawn in three passes per rail:
    //         (a) dark underside tube
    //         (b) main glowing rail core
    //         (c) bright highlight stripe along the top of the rail
    function drawRailLayer(side, baseColor, highlightColor, glowColor) {
      // (a) underside / shadow tube
      ctx.strokeStyle = "rgba(6,10,18,0.95)";
      ctx.lineWidth = 14;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      for (var k0 = 0; k0 <= SAMPLE_COUNT; k0++) {
        var z0 = k0 / SAMPLE_COUNT;
        var p0 = projectSample(z0, side);
        var rad0 = Math.max(2, p0.halfW * 0.05);
        if (k0 === 0) ctx.moveTo(p0.x, p0.y + rad0 * 0.7);
        else ctx.lineTo(p0.x, p0.y + rad0 * 0.7);
      }
      ctx.stroke();
      // (b) main core
      ctx.strokeStyle = baseColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 22;
      ctx.lineWidth = 11;
      ctx.beginPath();
      for (var k1 = 0; k1 <= SAMPLE_COUNT; k1++) {
        var z1 = k1 / SAMPLE_COUNT;
        var p1 = projectSample(z1, side);
        if (k1 === 0) ctx.moveTo(p1.x, p1.y); else ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      // (c) bright highlight along the top of the rail
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var k2 = 0; k2 <= SAMPLE_COUNT; k2++) {
        var z2 = k2 / SAMPLE_COUNT;
        var p2 = projectSample(z2, side);
        var rad2 = Math.max(2, p2.halfW * 0.05);
        if (k2 === 0) ctx.moveTo(p2.x, p2.y - rad2 * 0.55);
        else ctx.lineTo(p2.x, p2.y - rad2 * 0.55);
      }
      ctx.stroke();
    }
    // Left rail = cyan beam, right rail = red beam. Clear color separation
    // makes the gap unmistakable.
    drawRailLayer(-RAIL_OUTER, "#5cf2ff", "rgba(220,250,255,0.95)", "rgba(92,242,255,1)");
    drawRailLayer( RAIL_OUTER, "#ff3a3a", "rgba(255,210,210,0.95)", "rgba(255,58,58,1)");

    // ---- 4) Bank indicator: a faint cross-hatch across the gap that
    //         tilts with the bank. Reinforces "two rails with a gap"
    //         instead of "filled deck". ----
    var HATCH = 18;
    var hatchPhase = (t * 0.10) % (1 / HATCH);
    for (var hi = 0; hi < HATCH; hi++) {
      var hz = (hi / HATCH + hatchPhase);
      if (hz <= 0.06 || hz >= 0.98) continue;
      var hL = projectSample(hz, -RAIL_OUTER * 0.85);
      var hR = projectSample(hz,  RAIL_OUTER * 0.85);
      ctx.strokeStyle = "rgba(92,242,255,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hL.x, hL.y);
      ctx.lineTo(hR.x, hR.y);
      ctx.stroke();
    }
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
      var pa = projectSample(sp.z, -0.85);
      var pb = projectSample(sp.z,  0.85);
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

  // ---- Section building cluster helpers ----

  function rectStrip(x, y, w_, h_, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w_, h_);
  }
  // Pseudo-isometric 3D box: front face + right side face + top cap.
  // Centered on (cx, baseY) with width w_ and height h_. depth controls how
  // far the side face shears to the right and how tall the top cap reads.
  // Returns {fx, fy, fw, fh} of the front face for window grid placement.
  function box3D(cx, baseY, w_, h_, depth, frontColor, sideColor, topColor) {
    var fx = cx - w_ / 2;
    var fy = baseY - h_;
    var fw = w_;
    var fh = h_;
    var dx = depth * 0.85;
    var dy = depth * 0.45;
    // Right side face (parallelogram)
    ctx.fillStyle = sideColor;
    ctx.beginPath();
    ctx.moveTo(fx + fw,        fy);
    ctx.lineTo(fx + fw + dx,   fy - dy);
    ctx.lineTo(fx + fw + dx,   baseY - dy);
    ctx.lineTo(fx + fw,        baseY);
    ctx.closePath();
    ctx.fill();
    // Top cap (parallelogram)
    ctx.fillStyle = topColor;
    ctx.beginPath();
    ctx.moveTo(fx,             fy);
    ctx.lineTo(fx + fw,        fy);
    ctx.lineTo(fx + fw + dx,   fy - dy);
    ctx.lineTo(fx + dx,        fy - dy);
    ctx.closePath();
    ctx.fill();
    // Front face
    ctx.fillStyle = frontColor;
    ctx.fillRect(fx, fy, fw, fh);
    // Edge highlights
    ctx.strokeStyle = "rgba(92,242,255,0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);
    ctx.beginPath();
    ctx.moveTo(fx + fw,      fy);
    ctx.lineTo(fx + fw + dx, fy - dy);
    ctx.moveTo(fx + fw + dx, fy - dy);
    ctx.lineTo(fx + fw + dx, baseY - dy);
    ctx.moveTo(fx + fw + dx, baseY - dy);
    ctx.lineTo(fx + fw,      baseY);
    ctx.moveTo(fx,           fy);
    ctx.lineTo(fx + dx,      fy - dy);
    ctx.lineTo(fx + fw + dx, fy - dy);
    ctx.stroke();
    return { fx: fx, fy: fy, fw: fw, fh: fh };
  }
  // Horizontal floor-band glow strips. Replaces the old grid-of-squares
  // window pattern with thin glowing horizontal bands (with a few vertical
  // accents) so towers read as architectural rather than Tetris.
  function windowGrid(x, y, w_, h_, cols, rows, t, seed) {
    var bandH = Math.max(1, (h_ - 4) / Math.max(rows, 6));
    for (var r = 0; r < rows; r++) {
      var by = y + 2 + r * bandH;
      if (by + 1 > y + h_ - 2) break;
      var lit = ((Math.sin(t * 1.3 + r * 0.9 + seed) + 1) * 0.5) > 0.35;
      ctx.fillStyle = lit ? "rgba(92,242,255,0.85)" : "rgba(40,80,140,0.35)";
      ctx.fillRect(x + 2, by, w_ - 4, Math.max(1, bandH * 0.45));
    }
    // Vertical accent slits (just a couple, not a grid)
    var slits = Math.max(1, Math.min(3, Math.floor(cols / 2)));
    for (var s = 0; s < slits; s++) {
      var sx = x + (w_ * (s + 1)) / (slits + 1);
      var lg = ctx.createLinearGradient(sx, y, sx, y + h_);
      lg.addColorStop(0,   "rgba(92,242,255,0)");
      lg.addColorStop(0.5, "rgba(92,242,255,0.95)");
      lg.addColorStop(1,   "rgba(92,242,255,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(sx - 0.7, y + 2, 1.4, h_ - 4);
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
    var hgt = scale * 52;
    var basew = scale * 3.8;
    var midw = scale * 2.6;
    var topw = scale * 1.4;
    var depth = scale * 2.0;

    var seg1H = hgt * 0.45;
    var seg2H = hgt * 0.32;
    var seg3H = hgt * 0.23;
    var y0 = p.y;
    var y1 = y0 - seg1H;
    var y2 = y1 - seg2H;
    var y3 = y2 - seg3H;

    // Bottom segment as 3D box
    var seg1 = box3D(p.x, y0, basew * 2, seg1H, depth, "#0e1a32", "#06101e", "#1c2c4e");
    windowGrid(seg1.fx, seg1.fy, seg1.fw, seg1.fh, 6, 9, t, p.x);
    rectStrip(seg1.fx - 1, seg1.fy - 2, seg1.fw + 2, 2, "rgba(92,242,255,0.85)");

    // Mid segment
    var seg2 = box3D(p.x, y1, midw * 2, seg2H, depth * 0.8, "#0d172a", "#05101c", "#192746");
    windowGrid(seg2.fx, seg2.fy, seg2.fw, seg2.fh, 5, 7, t, p.x + 13);
    rectStrip(seg2.fx - 1, seg2.fy - 2, seg2.fw + 2, 2, "rgba(92,242,255,0.7)");

    // Top segment / crown
    var seg3 = box3D(p.x, y2, topw * 2, seg3H, depth * 0.6, "#0a1426", "#040b16", "#162241");
    windowGrid(seg3.fx, seg3.fy, seg3.fw, seg3.fh, 3, 5, t, p.x + 41);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(seg3.fx + 0.5, seg3.fy + 0.5, seg3.fw - 1, seg3.fh - 1);

    // Vertical light strips on the front face
    for (var ls = 0; ls < 3; ls++) {
      var lsx = seg1.fx + (ls + 1) * (seg1.fw / 4);
      var lsGrad = ctx.createLinearGradient(lsx, seg1.fy, lsx, seg1.fy + seg1.fh);
      lsGrad.addColorStop(0, "rgba(92,242,255,0)");
      lsGrad.addColorStop(0.5, "rgba(92,242,255,0.7)");
      lsGrad.addColorStop(1, "rgba(92,242,255,0)");
      ctx.fillStyle = lsGrad;
      ctx.fillRect(lsx - 0.5, seg1.fy, 1, seg1.fh);
    }

    // Crown antenna mast
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(p.x, y3);
    ctx.lineTo(p.x, y3 - scale * 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x - scale * 1.4, y3 - scale * 4);
    ctx.lineTo(p.x + scale * 1.4, y3 - scale * 4);
    ctx.stroke();
    var beaconOn = Math.sin(t * 3) > 0;
    ctx.fillStyle = beaconOn ? RED : "#ffaa55";
    ctx.shadowColor = "rgba(255,58,58,0.9)";
    ctx.shadowBlur = beaconOn ? 12 : 5;
    ctx.beginPath();
    ctx.arc(p.x, y3 - scale * 8, Math.max(1.6, scale * 0.6), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawFoundry(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 42;
    var depth = scale * 1.8;
    var towers = [
      { x: p.x - scale * 4.6, w: scale * 2.2, h: hgt },
      { x: p.x,                w: scale * 3.0, h: hgt * 1.15 },
      { x: p.x + scale * 4.6,  w: scale * 2.0, h: hgt * 0.85 }
    ];
    var faces = [];
    towers.forEach(function (tw, idx) {
      var face = box3D(tw.x, p.y, tw.w * 2, tw.h, depth, "#0d182e", "#05101c", "#1a2a4a");
      faces.push(face);
      windowGrid(face.fx, face.fy, face.fw, face.fh, 4, 10, t, tw.x + idx * 17);
      rectStrip(face.fx - 1, face.fy - 2, face.fw + 2, 2, "rgba(255,140,90,0.85)");
      // Stack vent
      ctx.strokeStyle = "rgba(180,200,220,0.7)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tw.x, p.y - tw.h - 2);
      ctx.lineTo(tw.x, p.y - tw.h - scale * 4);
      ctx.stroke();
      var puff = (Math.sin(t * 1.0 + idx) + 1) * 0.5;
      ctx.fillStyle = "rgba(255,200,160," + (0.20 + puff * 0.40).toFixed(3) + ")";
      ctx.beginPath();
      ctx.arc(tw.x, p.y - tw.h - scale * 4 - puff * scale * 1.8, scale * (0.5 + puff * 0.35), 0, Math.PI * 2);
      ctx.fill();
    });
    // Skybridges between towers: drawn as thin glowing horizontal beams
    ctx.strokeStyle = "rgba(255,58,58,0.85)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,58,58,0.8)";
    ctx.shadowBlur = 10;
    var bridgeY1 = p.y - towers[0].h * 0.65;
    var bridgeY2 = p.y - towers[0].h * 0.40;
    ctx.beginPath();
    ctx.moveTo(faces[0].fx + faces[0].fw, bridgeY1);
    ctx.lineTo(faces[1].fx, bridgeY1);
    ctx.moveTo(faces[1].fx + faces[1].fw, bridgeY1 - 6);
    ctx.lineTo(faces[2].fx, bridgeY1 - 6);
    ctx.moveTo(faces[0].fx + faces[0].fw, bridgeY2);
    ctx.lineTo(faces[1].fx, bridgeY2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function drawVoiceArray(p, scale, t) {
    pad(p, scale);
    var hgt = scale * 50;
    var w_ = scale * 2.2;
    var depth = scale * 1.4;
    var face = box3D(p.x, p.y, w_ * 2, hgt * 0.7, depth, "#0a1426", "#040b16", "#162241");
    windowGrid(face.fx, face.fy, face.fw, face.fh, 3, 14, t, p.x);
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
    var hgt = scale * 46;
    var basew = scale * 3.2;
    var depth = scale * 1.8;
    var face = box3D(p.x, p.y, basew * 2, hgt, depth, "#0c1830", "#05101c", "#192746");
    windowGrid(face.fx, face.fy, face.fw, face.fh, 5, 12, t, p.x);
    var deckH = scale * 2.6;
    // Observation deck as its own 3D box (overhanging)
    var deckFace = box3D(p.x, p.y - hgt, basew * 3.2, deckH, depth * 1.1, "#1a2a4a", "#0a142a", "#2a3e5e");
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(deckFace.fx + 0.5, deckFace.fy + 0.5, deckFace.fw - 1, deckFace.fh - 1);
    for (var i = 0; i < 9; i++) {
      ctx.fillStyle = "rgba(92,242,255,0.95)";
      ctx.fillRect(deckFace.fx + 1 + i * (deckFace.fw / 9), deckFace.fy + 0.7, deckFace.fw / 9 - 1.5, deckFace.fh - 1.4);
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
    var hgt = scale * 46;
    var w_ = scale * 3.2;
    var depth = scale * 1.8;
    var face = box3D(p.x, p.y, w_ * 2, hgt, depth, "#0e1a2e", "#06101e", "#1a2a48");
    ctx.strokeStyle = "rgba(255,90,58,0.95)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(face.fx + 0.5, face.fy + 0.5, face.fw - 1, face.fh - 1);
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    // Glowing energy seam down the reactor's front
    var seamGrad = ctx.createLinearGradient(p.x, face.fy, p.x, p.y);
    seamGrad.addColorStop(0, "rgba(255,200,120," + (0.4 + pulse * 0.4).toFixed(3) + ")");
    seamGrad.addColorStop(1, "rgba(255,90,58,0.95)");
    ctx.fillStyle = seamGrad;
    ctx.fillRect(p.x - scale * 0.5, face.fy + 2, scale, face.fh - 4);
    ctx.shadowColor = "rgba(255,90,58,0.95)";
    ctx.shadowBlur = 14;
    ctx.fillRect(p.x - scale * 0.25, face.fy + 2, scale * 0.5, face.fh - 4);
    ctx.shadowBlur = 0;
    for (var sd = -1; sd <= 1; sd += 2) {
      windowGrid(p.x + sd * (w_ * 0.55) - w_ * 0.35, face.fy + 2, w_ * 0.7, face.fh - 4, 2, 12, t, p.x + sd * 31);
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
    var hgt = scale * 40;
    var basew = scale * 6.0;
    var depth = scale * 2.0;
    var face = box3D(p.x, p.y, basew * 2, hgt, depth, "#0a1628", "#040d1a", "#16263e");
    var lowerH = hgt * 0.45;
    windowGrid(face.fx, face.fy + (hgt - lowerH), face.fw, lowerH, 10, 4, t, p.x);
    var facadeY = face.fy + 4;
    var facadeH = hgt - lowerH - 8;
    ctx.fillStyle = "rgba(8,18,38,0.9)";
    ctx.fillRect(face.fx + 4, facadeY, face.fw - 8, facadeH);
    var bars = 12;
    for (var i = 0; i < bars; i++) {
      var bh = (Math.sin(t * 1.6 + i) + 1) * 0.5 * (facadeH - 4) + 2;
      var bx = face.fx + 6 + i * ((face.fw - 12) / bars);
      var bw = (face.fw - 12) / bars - 1;
      ctx.fillStyle = i < bars / 2 ? "rgba(92,242,255,0.95)" : "rgba(255,58,58,0.95)";
      ctx.fillRect(bx, facadeY + facadeH - bh - 2, bw, bh);
    }
    rectStrip(face.fx - 1, face.fy - 2, face.fw + 2, 2, "rgba(255,140,90,0.85)");
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
    var towerH = scale * 32;
    var towerW = scale * 2.0;
    var depth = scale * 1.4;
    var face = box3D(p.x, p.y, towerW * 2, towerH, depth, "#0a1426", "#040b16", "#172445");
    windowGrid(face.fx, face.fy, face.fw, face.fh, 2, 10, t, p.x + 7);

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
    var towerH = scale * 36;
    var towerW = scale * 1.6;
    var depthC = scale * 1.2;
    var face = box3D(p.x, p.y, towerW * 2, towerH, depthC, "#0c1828", "#040b16", "#1a2a48");
    var stripGrad = ctx.createLinearGradient(p.x, face.fy, p.x, p.y);
    stripGrad.addColorStop(0, "rgba(92,242,255,0)");
    stripGrad.addColorStop(1, "rgba(92,242,255,0.95)");
    ctx.fillStyle = stripGrad;
    ctx.fillRect(p.x - 0.8, face.fy, 1.6, face.fh);
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
      var z = 0.55 - rel * 0.28;
      if (z <= 0.04 || z >= 0.96) continue;
      // Push the towers further off the rails so they sit alongside the
      // content panels (not overlapping the track) and scale them up.
      var lateral = 2.35;
      var p = projectSample(z, (sec.side >= 0 ? 1 : -1) * (Math.abs(sec.side) * 0.5 + lateral));
      var scale = p.halfW * 0.135;
      ctx.save();
      ctx.globalAlpha = Math.max(0.45, Math.min(1, 0.55 + z * 0.75));
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
    drawPCBSubstrate(w, h, horizonY, t, sectionPos);
    drawDistantBuildings(w, h, horizonY, t, sectionPos);
    drawSectionBuildings(w, h, horizonY, t, sectionPos);
    drawSupportTrusses(w, h, horizonY, t, sectionPos);
    drawElevatedTrack(w, h, horizonY, t, sectionPos);
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
    try { console.info("[brainstorm] Canvas2D roller-circuit elevated/PCB engine running"); } catch (_) {}
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
