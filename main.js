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

  document.documentElement.dataset.sceneEngine = "canvas2d-artdirected-rails";
  // QA marker: confirms the art-directed screen-space rail renderer is
  // active. Replaces dynamic projection-based rails which produced visual
  // knots in the foreground.
  document.documentElement.dataset.trackMode = "artdirected-rails";
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
    var lanes = [-0.95, 0.95];
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
    // Far-distance skyline silhouettes: fewer but each is a stacked
    // pseudo-3D space-tower with crown, antenna, ring, or skybridge.
    skylineProps.length = 0;
    for (var sk = 0; sk < 16; sk++) {
      skylineProps.push({
        nx: Math.random(),
        nh: 0.35 + Math.random() * 0.65,
        red: Math.random() < 0.25,
        crown: Math.floor(Math.random() * 4),
        antenna: Math.random() < 0.6,
        ring: Math.random() < 0.4
      });
    }
    // Mid-range pseudo-3D buildings flanking the rails (much fewer,
    // much larger, each volumetric with side face + tiered tops).
    distantBuildings.length = 0;
    for (var db = 0; db < 10; db++) {
      distantBuildings.push({
        z: 0.10 + (db / 10) * 0.55 + Math.random() * 0.04,
        side: db % 2 === 0 ? -1 : 1,
        offset: 1.55 + Math.random() * 0.6,
        w: 0.10 + Math.random() * 0.06,
        h: 0.85 + Math.random() * 0.65,
        red: Math.random() < 0.30,
        tiers: 2 + Math.floor(Math.random() * 3),
        antenna: Math.random() < 0.7,
        ring: Math.random() < 0.5,
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
    var fgSide = sideA + (sideB - sideA) * ease * 0.35;
    var bgSide = sideB + (sideA - sideB) * (1 - ease) * 0.30;
    // Single low-frequency S-bend. Amplitude is gated so the foreground
    // (zNorm < ~0.35) stays nearly straight — prevents the rails from
    // crossing or tangling near the camera. Mid/far still curves.
    var depthGate = Math.max(0, (zNorm - 0.18)) * 1.2;
    if (depthGate > 1) depthGate = 1;
    var sway = Math.sin(zNorm * 2.6 + sectionPos * 0.9 + t * 0.22) * 0.28 * depthGate;
    var blend = 1 - zNorm;
    return fgSide * (1 - blend) + bgSide * blend + sway;
  }

  function curveLiftAt(zNorm, t, sectionPos) {
    var idxA = Math.max(0, Math.min(SECTIONS.length - 1, Math.floor(sectionPos)));
    var idxB = Math.min(SECTIONS.length - 1, idxA + 1);
    var local = sectionPos - idxA;
    var ease = local * local * (3 - 2 * local);
    var liftA = SECTIONS[idxA].lift;
    var liftB = SECTIONS[idxB].lift;
    var fg = liftA + (liftB - liftA) * ease * 0.4;
    var bg = liftB + (liftA - liftB) * (1 - ease) * 0.30;
    // Strong baseline elevation so the track always reads as suspended
    // above the PCB, never flush with the ground.
    var baseLift = 0.32 + zNorm * 0.10;
    // Single low-amplitude wave for a gentle climb/dive — kept small so
    // adjacent samples stay near each other and rails never criss-cross.
    var wave = Math.sin(t * 0.4 + zNorm * 2.6 + sectionPos * 0.6) * 0.06;
    var blend = 1 - zNorm;
    return fg * (1 - blend) + bg * blend + wave + baseLift;
  }

  function rebuildSamples(w, h, horizonY, t, sectionPos) {
    // Foreground rail-to-rail half-span. Kept narrow so BOTH rails stay
    // fully on-screen with a clear PCB-visible gap between them, and so
    // cross ties never become wide enough to overlap each other into a
    // continuous tan/orange slab in the viewport.
    var roadHalfFG = w * 0.22;
    var roadHalfH  = w * 0.012;
    for (var i = 0; i <= SAMPLE_COUNT; i++) {
      var z = i / SAMPLE_COUNT;
      var pp = z * z * 0.94 + z * 0.06;
      var halfW = roadHalfH + (roadHalfFG - roadHalfH) * pp;
      var lat = curveLateralAt(z, t, sectionPos);
      var lift = curveLiftAt(z, t, sectionPos);
      // Clamp lateral excursion so the rail centerline never sweeps off
      // the viewport. Prevents the perceived "ramp" silhouette where rails
      // disappear past the screen edges and the area between them reads as
      // a continuous filled slab.
      var clampedLat = Math.max(-1, Math.min(1, lat));
      var centerX = w * 0.5 + clampedLat * halfW * 0.85;
      var groundY = horizonY + (h - horizonY) * pp - lift * (h - horizonY) * 0.50 * pp;
      var s = samples[i];
      s.z = z;
      s.centerLat = lat;
      s.lift = lift;
      s.halfW = halfW;
      s.centerX = centerX;
      s.groundY = groundY;
    }
    // Pass 2: derive slope/bank and a screen-space tangent normal from
    // neighbor samples. The normal is what we use to offset the rails so
    // they always sit on opposite sides of the centerline in screen space
    // (no possibility of crossing/tangling regardless of bank or curve).
    for (var k = 0; k <= SAMPLE_COUNT; k++) {
      var prev = samples[Math.max(0, k - 1)];
      var next = samples[Math.min(SAMPLE_COUNT, k + 1)];
      var slope = (next.centerLat - prev.centerLat);
      samples[k].slope = slope;
      // Bank kept small — visible tilt but cannot rotate the lane offset
      // past 90 deg, which is what previously caused the rails to swap
      // sides and tangle in the foreground.
      samples[k].bank = Math.max(-0.45, Math.min(0.45, slope * 1.2));
      // Screen-space tangent (dx,dy) along the centerline polyline.
      var tdx = next.centerX - prev.centerX;
      var tdy = next.groundY - prev.groundY;
      var tlen = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
      // Perpendicular (right-hand normal): rotate (tdx,tdy) by +90deg.
      samples[k].nx = -tdy / tlen;
      samples[k].ny =  tdx / tlen;
    }
  }

  // Minimum on-screen gap between the two rails. Prevents the rails from
  // ever visually merging or crossing — they always sit at least this far
  // apart in screen space regardless of curve, bank, or projection.
  function minRailGapPx(zNorm) {
    var vw = canvas.width || 1280;
    // ~6% of viewport at horizon, ~10% in foreground. Scales with depth.
    var fg = Math.max(60, vw * 0.10);
    var bg = Math.max(36, vw * 0.06);
    return bg + (fg - bg) * zNorm;
  }

  // Project a track-relative coordinate using the precomputed samples.
  // Rails (laneOffset = +/-1) are placed using the screen-space normal of
  // the centerline polyline so the two rails ALWAYS sit on opposite sides
  // of the centerline, with a minimum visible gap. This makes self-
  // intersection geometrically impossible.
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
    var nx = a.nx + (b.nx - a.nx) * u;
    var ny = a.ny + (b.ny - a.ny) * u;
    // Lateral offset has TWO floors: the projected rail half-span, and a
    // hard minimum screen-space gap. Whichever is larger wins. This is
    // the key fix that prevents foreground rail tangling.
    var minHalf = minRailGapPx(z) * 0.5;
    var effHalf = Math.max(halfW, minHalf);
    var sign = laneOffset >= 0 ? 1 : -1;
    var amt = sign * effHalf;
    // Bank lifts the offset rail slightly along Y for a subtle tilt look,
    // but is clamped so it can never reverse left/right ordering.
    var by = bank * 0.35;
    return {
      x: centerX + nx * amt,
      y: groundY + ny * amt + amt * by * 0.18,
      halfW: effHalf,
      centerX: centerX,
      centerY: groundY,
      bank: bank,
      nx: nx,
      ny: ny
    };
  }

  // ---------- Art-directed screen-space track ----------
  // The previous projection-based rail geometry produced visual knots in the
  // foreground because the rails followed a dynamically deformed centerline.
  // This system replaces that with a stable cubic Bezier in screen space.
  // Control points are anchored to viewport coordinates with a small,
  // bounded section-driven shift on the mid bend. Rails are obtained by
  // offsetting along the screen-space normal of the centerline polyline,
  // so the two rails ALWAYS sit on opposite sides with a depth-tapered gap
  // and CANNOT cross or tangle regardless of section, scroll, or motion.
  var TRACK_STEPS = 64;
  var trackSamples = new Array(TRACK_STEPS + 1);
  for (var ts = 0; ts <= TRACK_STEPS; ts++) {
    trackSamples[ts] = { u: 0, cx: 0, cy: 0, nx: 0, ny: 0, gap: 0, lx: 0, ly: 0, rx: 0, ry: 0 };
  }
  // Section-driven mid bend shift in [-1,1]. Drives the curve into a gentle
  // S without ever introducing a self-intersection. Smoothed across sections.
  function trackBendAt(sectionPos) {
    var idxA = Math.max(0, Math.min(SECTIONS.length - 1, Math.floor(sectionPos)));
    var idxB = Math.min(SECTIONS.length - 1, idxA + 1);
    var local = sectionPos - idxA;
    var ease = local * local * (3 - 2 * local);
    var sA = SECTIONS[idxA].side;
    var sB = SECTIONS[idxB].side;
    return sA + (sB - sA) * ease;
  }
  function buildArtTrack(w, h, horizonY, sectionPos) {
    var bend = trackBendAt(sectionPos);
    if (bend > 1) bend = 1; if (bend < -1) bend = -1;
    // Stable screen-space anchor points.
    // P0 = far/horizon center, P3 = foreground/bottom center. Track climbs
    // from bottom of viewport up toward the horizon. P1/P2 control the
    // bend; only P1 carries the section bend so the foreground always sits
    // near center and the gap stays consistent at the camera.
    var fgY = h * 0.96;
    var horY = horizonY + Math.max(20, h * 0.04);
    // Modest bend amplitude — strong enough to read as an S-curve, small
    // enough that ties and trusses always stay on screen.
    var bendAmp = w * 0.16;
    var P0x = w * 0.50;            var P0y = horY;
    var P1x = w * 0.50 + bend * bendAmp;
    var P1y = horizonY + (h - horizonY) * 0.45;
    var P2x = w * 0.50 - bend * bendAmp * 0.35;
    var P2y = horizonY + (h - horizonY) * 0.78;
    var P3x = w * 0.50;            var P3y = fgY;
    // Foreground rail-to-rail gap (px). Tapers with depth but never below
    // a hard floor so QA always sees a clear transparent gap between rails.
    var gapFG = Math.max(70, Math.min(140, w * 0.085));
    var gapHor = Math.max(30, w * 0.022);
    for (var i = 0; i <= TRACK_STEPS; i++) {
      var u = i / TRACK_STEPS; // 0 = horizon, 1 = foreground
      var omu = 1 - u;
      // Cubic Bezier centerline.
      var cx = omu*omu*omu*P0x + 3*omu*omu*u*P1x + 3*omu*u*u*P2x + u*u*u*P3x;
      var cy = omu*omu*omu*P0y + 3*omu*omu*u*P1y + 3*omu*u*u*P2y + u*u*u*P3y;
      // Tangent (derivative of Bezier).
      var tx = 3*omu*omu*(P1x-P0x) + 6*omu*u*(P2x-P1x) + 3*u*u*(P3x-P2x);
      var ty = 3*omu*omu*(P1y-P0y) + 6*omu*u*(P2y-P1y) + 3*u*u*(P3y-P2y);
      var tlen = Math.sqrt(tx*tx + ty*ty) || 1;
      // Right-hand normal in screen space.
      var nx = -ty / tlen;
      var ny =  tx / tlen;
      // Depth-tapered gap. u=1 is foreground (large gap), u=0 horizon (small).
      var gap = gapHor + (gapFG - gapHor) * u;
      var half = gap * 0.5;
      var s = trackSamples[i];
      s.u = u;
      s.cx = cx; s.cy = cy;
      s.nx = nx; s.ny = ny;
      s.gap = gap;
      s.lx = cx - nx * half; s.ly = cy - ny * half;
      s.rx = cx + nx * half; s.ry = cy + ny * half;
    }
  }
  function projectTrack(u) {
    var uu = Math.max(0, Math.min(1, u));
    var f = uu * TRACK_STEPS;
    var i0 = Math.floor(f);
    var i1 = Math.min(TRACK_STEPS, i0 + 1);
    var k = f - i0;
    var a = trackSamples[i0];
    var b = trackSamples[i1];
    return {
      cx: a.cx + (b.cx - a.cx) * k,
      cy: a.cy + (b.cy - a.cy) * k,
      lx: a.lx + (b.lx - a.lx) * k,
      ly: a.ly + (b.ly - a.ly) * k,
      rx: a.rx + (b.rx - a.rx) * k,
      ry: a.ry + (b.ry - a.ry) * k,
      nx: a.nx + (b.nx - a.nx) * k,
      ny: a.ny + (b.ny - a.ny) * k,
      gap: a.gap + (b.gap - a.gap) * k
    };
  }
  function strokeCenterPolyline() {
    ctx.beginPath();
    ctx.moveTo(trackSamples[0].cx, trackSamples[0].cy);
    for (var i = 1; i <= TRACK_STEPS; i++) ctx.lineTo(trackSamples[i].cx, trackSamples[i].cy);
  }
  function strokeRailPolyline(side) {
    ctx.beginPath();
    if (side < 0) {
      ctx.moveTo(trackSamples[0].lx, trackSamples[0].ly);
      for (var i = 1; i <= TRACK_STEPS; i++) ctx.lineTo(trackSamples[i].lx, trackSamples[i].ly);
    } else {
      ctx.moveTo(trackSamples[0].rx, trackSamples[0].ry);
      for (var j = 1; j <= TRACK_STEPS; j++) ctx.lineTo(trackSamples[j].rx, trackSamples[j].ry);
    }
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

  // Far-distance skyline: a small number of unmistakable space-tower
  // silhouettes (tapered cores, antennas, halo rings) at the horizon —
  // never a continuous row of flat rectangles.
  function drawDistantSkyline(w, horizonY, t, sectionPos) {
    var drift = sectionPos * 60;
    for (var i = 0; i < skylineProps.length; i++) {
      var b = skylineProps[i];
      var bx = ((b.nx * w * 1.15 + drift) % (w + 120)) - 60;
      var bw = 18 + b.nh * 30;
      var bh = 60 + b.nh * 130;
      var depth = 5 + b.nh * 7;
      var topY = horizonY - bh;
      var midY = topY + bh * 0.55;
      // Side face (parallelogram)
      ctx.fillStyle = "#03060d";
      ctx.beginPath();
      ctx.moveTo(bx + bw,         topY);
      ctx.lineTo(bx + bw + depth, topY - depth * 0.5);
      ctx.lineTo(bx + bw + depth, horizonY - depth * 0.5);
      ctx.lineTo(bx + bw,         horizonY);
      ctx.closePath();
      ctx.fill();
      // Top cap
      ctx.fillStyle = "#0f1c30";
      ctx.beginPath();
      ctx.moveTo(bx,              topY);
      ctx.lineTo(bx + bw,         topY);
      ctx.lineTo(bx + bw + depth, topY - depth * 0.5);
      ctx.lineTo(bx + depth,      topY - depth * 0.5);
      ctx.closePath();
      ctx.fill();
      // Front face — taper inward at the top so it reads as a tower
      // rather than a brick. Tapered trapezoid via polygon.
      var taperT = bw * 0.18;
      ctx.fillStyle = "#06101e";
      ctx.beginPath();
      ctx.moveTo(bx,              horizonY);
      ctx.lineTo(bx + bw,         horizonY);
      ctx.lineTo(bx + bw - taperT, midY);
      ctx.lineTo(bx + bw * 0.78,  topY);
      ctx.lineTo(bx + bw * 0.22,  topY);
      ctx.lineTo(bx + taperT,     midY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = b.red ? "rgba(255,58,58,0.75)" : "rgba(92,242,255,0.65)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // Vertical neon spine on the front face
      var spineGrad = ctx.createLinearGradient(bx + bw * 0.5, horizonY, bx + bw * 0.5, topY);
      spineGrad.addColorStop(0, b.red ? "rgba(255,90,90,0)" : "rgba(92,242,255,0)");
      spineGrad.addColorStop(0.5, b.red ? "rgba(255,90,90,0.85)" : "rgba(92,242,255,0.85)");
      spineGrad.addColorStop(1, b.red ? "rgba(255,140,140,0)" : "rgba(180,240,255,0)");
      ctx.fillStyle = spineGrad;
      ctx.fillRect(bx + bw * 0.5 - 0.8, topY + 4, 1.6, bh - 8);
      // Optional ring around the upper third (haloed observation deck)
      if (b.ring) {
        ctx.strokeStyle = "rgba(92,242,255,0.65)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(bx + bw * 0.5, topY + bh * 0.32, bw * 0.85, bw * 0.18, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Crown styles: 0=spire, 1=dome, 2=stepped setback, 3=stack
      var crownTop = topY;
      var cx = bx + bw * 0.5;
      if (b.crown === 0) {
        ctx.strokeStyle = "rgba(170,220,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, topY);
        ctx.lineTo(cx, topY - 18);
        ctx.stroke();
      } else if (b.crown === 1) {
        ctx.fillStyle = "#16263e";
        ctx.beginPath();
        ctx.arc(cx, topY, bw * 0.35, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = "rgba(92,242,255,0.7)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else if (b.crown === 2) {
        var sw = bw * 0.5;
        var sh = 10 + b.nh * 8;
        ctx.fillStyle = "#0f1c30";
        ctx.fillRect(cx - sw / 2, topY - sh, sw, sh);
        ctx.strokeStyle = "rgba(92,242,255,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - sw / 2 + 0.5, topY - sh + 0.5, sw - 1, sh - 1);
        crownTop = topY - sh;
      } else {
        var stack1W = bw * 0.55;
        var stack1H = 8 + b.nh * 6;
        var stack2W = bw * 0.32;
        var stack2H = 6 + b.nh * 5;
        ctx.fillStyle = "#0f1c30";
        ctx.fillRect(cx - stack1W / 2, topY - stack1H, stack1W, stack1H);
        ctx.fillRect(cx - stack2W / 2, topY - stack1H - stack2H, stack2W, stack2H);
        ctx.strokeStyle = "rgba(92,242,255,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - stack1W / 2 + 0.5, topY - stack1H + 0.5, stack1W - 1, stack1H - 1);
        ctx.strokeRect(cx - stack2W / 2 + 0.5, topY - stack1H - stack2H + 0.5, stack2W - 1, stack2H - 1);
        crownTop = topY - stack1H - stack2H;
      }
      if (b.antenna) {
        ctx.strokeStyle = "rgba(255,58,58,0.9)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx, crownTop);
        ctx.lineTo(cx, crownTop - 14);
        ctx.stroke();
        var beaconOn = ((Math.sin(t * 2 + i) + 1) * 0.5) > 0.5;
        ctx.fillStyle = beaconOn ? "#ff5a3a" : "#ffaa55";
        ctx.shadowColor = "rgba(255,58,58,0.85)";
        ctx.shadowBlur = beaconOn ? 8 : 3;
        ctx.beginPath();
        ctx.arc(cx, crownTop - 14, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
    ctx.strokeStyle = "rgba(92,242,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 0.5);
    ctx.lineTo(w, horizonY + 0.5);
    ctx.stroke();
  }

  // Mid-range pseudo-3D space-towers flanking the rails. Multi-tier
  // volumetric: side face + tiered crowns + accent rings + antennas.
  // Drawn to dominate the viewport so the city reads volumetric, not
  // as flat Tetris facades.
  function drawDistantBuildings(w, h, horizonY, t, sectionPos) {
    for (var i = 0; i < distantBuildings.length; i++) {
      var d = distantBuildings[i];
      var pp = projectSample(d.z, d.side * d.offset);
      var hgt = pp.halfW * d.h;
      var ww = pp.halfW * d.w;
      if (hgt < 24 || ww < 6) continue;
      var gx = pp.x;
      var gy = pp.y;
      var depth = ww * 0.55;
      var topY = gy - hgt;
      // ---- Side face (parallelogram) ----
      ctx.fillStyle = "#04080f";
      ctx.beginPath();
      ctx.moveTo(gx + ww,         topY);
      ctx.lineTo(gx + ww + depth, topY - depth * 0.5);
      ctx.lineTo(gx + ww + depth, gy - depth * 0.5);
      ctx.lineTo(gx + ww,         gy);
      ctx.closePath();
      ctx.fill();
      // ---- Top cap parallelogram ----
      ctx.fillStyle = "#16263e";
      ctx.beginPath();
      ctx.moveTo(gx - ww,         topY);
      ctx.lineTo(gx + ww,         topY);
      ctx.lineTo(gx + ww + depth, topY - depth * 0.5);
      ctx.lineTo(gx - ww + depth, topY - depth * 0.5);
      ctx.closePath();
      ctx.fill();
      // ---- Front face with vertical gradient (darker base, lighter top) ----
      var faceGrad = ctx.createLinearGradient(0, topY, 0, gy);
      faceGrad.addColorStop(0, "#0e1a32");
      faceGrad.addColorStop(1, "#04080f");
      ctx.fillStyle = faceGrad;
      ctx.fillRect(gx - ww, topY, ww * 2, hgt);
      // Hard outlines so the volume reads
      ctx.strokeStyle = d.red ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.75)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(gx - ww + 0.5, topY + 0.5, Math.max(1, ww * 2 - 1), Math.max(1, hgt - 1));
      ctx.beginPath();
      ctx.moveTo(gx + ww, topY);
      ctx.lineTo(gx + ww + depth, topY - depth * 0.5);
      ctx.moveTo(gx + ww + depth, topY - depth * 0.5);
      ctx.lineTo(gx + ww + depth, gy - depth * 0.5);
      ctx.moveTo(gx + ww + depth, gy - depth * 0.5);
      ctx.lineTo(gx + ww,         gy);
      ctx.moveTo(gx - ww,         topY);
      ctx.lineTo(gx - ww + depth, topY - depth * 0.5);
      ctx.lineTo(gx + ww + depth, topY - depth * 0.5);
      ctx.stroke();
      // ---- Vertical neon core spine on the front face ----
      var spineGrad = ctx.createLinearGradient(gx, topY, gx, gy);
      spineGrad.addColorStop(0,    d.red ? "rgba(255,90,90,0)" : "rgba(92,242,255,0)");
      spineGrad.addColorStop(0.5,  d.red ? "rgba(255,90,90,0.85)" : "rgba(92,242,255,0.85)");
      spineGrad.addColorStop(1,    d.red ? "rgba(255,140,140,0.5)" : "rgba(180,240,255,0.5)");
      ctx.fillStyle = spineGrad;
      ctx.fillRect(gx - 1, topY + 4, 2, hgt - 8);
      // ---- Horizontal floor bands (a few faint bands, NOT a window grid) ----
      var bands = Math.max(3, Math.floor(hgt / 24));
      for (var bi = 1; bi < bands; bi++) {
        var by = topY + (hgt / bands) * bi;
        var on = ((Math.sin(t * 0.9 + bi * 0.7 + d.seed) + 1) * 0.5) > 0.45;
        ctx.fillStyle = on ? "rgba(92,242,255,0.55)" : "rgba(40,80,140,0.30)";
        ctx.fillRect(gx - ww + 3, by, ww * 2 - 6, 1.2);
      }
      // ---- Stacked tier setbacks on top ----
      var crownTop = topY;
      for (var ti = 0; ti < d.tiers; ti++) {
        var tw = ww * (0.78 - ti * 0.18);
        var th = Math.max(8, hgt * 0.10 - ti * 2);
        if (tw < 4 || th < 4) break;
        var ty = crownTop - th;
        var td = depth * (0.78 - ti * 0.18);
        // tier side face
        ctx.fillStyle = "#04080f";
        ctx.beginPath();
        ctx.moveTo(gx + tw,      ty);
        ctx.lineTo(gx + tw + td, ty - td * 0.5);
        ctx.lineTo(gx + tw + td, crownTop - td * 0.5);
        ctx.lineTo(gx + tw,      crownTop);
        ctx.closePath();
        ctx.fill();
        // tier top cap
        ctx.fillStyle = "#1a2a48";
        ctx.beginPath();
        ctx.moveTo(gx - tw,      ty);
        ctx.lineTo(gx + tw,      ty);
        ctx.lineTo(gx + tw + td, ty - td * 0.5);
        ctx.lineTo(gx - tw + td, ty - td * 0.5);
        ctx.closePath();
        ctx.fill();
        // tier front
        ctx.fillStyle = "#0e1a32";
        ctx.fillRect(gx - tw, ty, tw * 2, th);
        ctx.strokeStyle = d.red ? "rgba(255,58,58,0.7)" : "rgba(92,242,255,0.6)";
        ctx.lineWidth = 1;
        ctx.strokeRect(gx - tw + 0.5, ty + 0.5, tw * 2 - 1, th - 1);
        crownTop = ty;
      }
      // ---- Halo ring around the upper section (skybridge / observation) ----
      if (d.ring) {
        var ringY = topY + hgt * 0.28;
        ctx.strokeStyle = "rgba(92,242,255,0.7)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(gx, ringY, ww * 1.25, ww * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ---- Antenna mast + beacon ----
      if (d.antenna) {
        ctx.strokeStyle = "rgba(170,220,255,0.85)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, crownTop);
        ctx.lineTo(gx, crownTop - 16);
        ctx.stroke();
        // crossbar
        ctx.beginPath();
        ctx.moveTo(gx - 5, crownTop - 8);
        ctx.lineTo(gx + 5, crownTop - 8);
        ctx.stroke();
        var beaconOn = ((Math.sin(t * 2.2 + d.seed) + 1) * 0.5) > 0.5;
        ctx.fillStyle = beaconOn ? "#ff5a3a" : "#ffaa55";
        ctx.shadowColor = "rgba(255,58,58,0.85)";
        ctx.shadowBlur = beaconOn ? 10 : 4;
        ctx.beginPath();
        ctx.arc(gx, crownTop - 16, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      // ---- Copper pad footing where the building sits on PCB ----
      ctx.fillStyle = "rgba(255,180,110,0.55)";
      ctx.beginPath();
      ctx.ellipse(gx, gy + 3, ww * 1.4, ww * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,200,140,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(gx, gy + 3, ww * 1.4, ww * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();
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

  // Art-directed support trusses below the elevated track. Each truss is a
  // wide screen-space A-frame anchored to the centerline curve at fixed
  // u-positions. Two vertical pylons span the gap, multiple stages of X
  // bracing, horizontal cap braces, copper footing pads. Positions are
  // chosen in the foreground/midground so several supports are always
  // unmistakably visible on desktop, and the columns sit DIRECTLY under
  // the rails (no projection drift).
  function drawSupportTrusses(w, h, horizonY, t, sectionPos) {
    // Foreground/midground anchor positions on the curve (u from 0=horizon
    // to 1=foreground). Five large supports — within the 3-5 spec band.
    var POSITIONS = [0.30, 0.46, 0.62, 0.78, 0.92];
    for (var i = 0; i < POSITIONS.length; i++) {
      var u = POSITIONS[i];
      var p = projectTrack(u);
      var leftX = p.lx;
      var rightX = p.rx;
      // Use the average rail Y for the truss top, vertical columns drop
      // straight down to the PCB ground. This guarantees orderly columns
      // (no slanted columns when the rail sags).
      var topY = Math.max(p.ly, p.ry) + 4;
      // Ground sits a bit below the bottom of the curve at this u so the
      // truss is always tall enough to read.
      var groundY = h - 8 - (1 - u) * (h - horizonY) * 0.05;
      if (groundY < topY + 60) groundY = topY + 60;
      // Pylon width scales with the depth-tapered rail gap so foreground
      // trusses look beefy and midground trusses look proportional.
      var pylonW = Math.max(7, Math.min(16, p.gap * 0.10));

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

      // ---- Two vertical pylons (front face + side parallelogram + cap) ----
      function pillar(px, accent) {
        var dropH = groundY - topY;
        var depth = pylonW * 0.85;
        ctx.fillStyle = "#05080f";
        ctx.beginPath();
        ctx.moveTo(px + pylonW,         topY);
        ctx.lineTo(px + pylonW + depth, topY - depth * 0.5);
        ctx.lineTo(px + pylonW + depth, groundY - depth * 0.5);
        ctx.lineTo(px + pylonW,         groundY);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#1a2a48";
        ctx.beginPath();
        ctx.moveTo(px - pylonW,         topY);
        ctx.lineTo(px + pylonW,         topY);
        ctx.lineTo(px + pylonW + depth, topY - depth * 0.5);
        ctx.lineTo(px - pylonW + depth, topY - depth * 0.5);
        ctx.closePath();
        ctx.fill();
        var pg = ctx.createLinearGradient(px - pylonW, 0, px + pylonW, 0);
        pg.addColorStop(0,    "#0a1424");
        pg.addColorStop(0.45, "#2a4068");
        pg.addColorStop(0.55, "#36507e");
        pg.addColorStop(1,    "#06101c");
        ctx.fillStyle = pg;
        ctx.fillRect(px - pylonW, topY, pylonW * 2, dropH);
        ctx.strokeStyle = "rgba(190,220,255,0.95)";
        ctx.lineWidth = 1.6;
        ctx.strokeRect(px - pylonW + 0.5, topY + 0.5, pylonW * 2 - 1, dropH - 1);
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(px, topY + 2);
        ctx.lineTo(px, groundY - 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        var flangeStep = 24;
        ctx.strokeStyle = "rgba(190,220,255,0.7)";
        ctx.lineWidth = 1;
        for (var fy = topY + 16; fy < groundY - 4; fy += flangeStep) {
          ctx.beginPath();
          ctx.moveTo(px - pylonW + 1, fy);
          ctx.lineTo(px + pylonW - 1, fy);
          ctx.stroke();
        }
      }
      pillar(leftX,  "rgba(92,242,255,0.95)");
      pillar(rightX, "rgba(255,90,90,0.95)");

      // ---- Multi-stage X bracing across the gap ----
      var dropAvg = groundY - topY;
      var stages = Math.max(3, Math.min(6, Math.floor(dropAvg / 28)));
      for (var st = 0; st < stages; st++) {
        var f0 = st / stages;
        var f1 = (st + 1) / stages;
        var yA = topY + dropAvg * f0 + 3;
        var yB = topY + dropAvg * f1 - 3;
        ctx.strokeStyle = "rgba(8,12,22,0.95)";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(leftX,  yA); ctx.lineTo(rightX, yB);
        ctx.moveTo(rightX, yA); ctx.lineTo(leftX,  yB);
        ctx.stroke();
        ctx.strokeStyle = "rgba(92,242,255,0.95)";
        ctx.shadowColor = "rgba(92,242,255,0.7)";
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(leftX,  yA); ctx.lineTo(rightX, yB);
        ctx.moveTo(rightX, yA); ctx.lineTo(leftX,  yB);
        ctx.stroke();
        ctx.shadowBlur = 0;
        var midX = (leftX + rightX) / 2;
        var midY = (yA + yB) / 2;
        ctx.fillStyle = "rgba(255,220,160,1)";
        ctx.beginPath();
        ctx.arc(midX, midY, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(leftX  - pylonW * 0.5, yB);
        ctx.lineTo(rightX + pylonW * 0.5, yB);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,180,110,0.98)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(leftX  - pylonW * 0.5, yB);
        ctx.lineTo(rightX + pylonW * 0.5, yB);
        ctx.stroke();
      }

      // ---- Top cap brace at the rail underside ----
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(leftX  - pylonW * 0.8, topY + 1);
      ctx.lineTo(rightX + pylonW * 0.8, topY + 1);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,220,160,1)";
      ctx.shadowColor = "rgba(255,200,120,0.7)";
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(leftX  - pylonW * 0.8, topY + 1);
      ctx.lineTo(rightX + pylonW * 0.8, topY + 1);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ---- Conduit from each footing outward to PCB ----
      ctx.strokeStyle = "rgba(255,180,110,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftX, groundY + 4);
      ctx.lineTo(leftX - pylonW * 3.2, groundY + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightX, groundY + 4);
      ctx.lineTo(rightX + pylonW * 3.2, groundY + 4);
      ctx.stroke();
    }
  }

  // Art-directed elevated track. Two parallel rails generated by offsetting
  // a single stable cubic Bezier centerline along its screen-space normal.
  // This eliminates rail tangling because both rails share the same curve
  // and are simply translated by +/- (gap/2) along the perpendicular —
  // mathematical self-intersection is impossible. NO continuous deck, NO
  // road slab, NO longitudinal stripe between rails. Cross ties are drawn
  // AFTER the rails as discrete perpendicular bars.
  function drawElevatedTrack(w, h, horizonY, t, sectionPos) {
    // ---- 1) Per-rail elliptical cast shadows on the PCB ----
    for (var sh = 0; sh < TRACK_STEPS; sh += 4) {
      var sa = trackSamples[sh];
      var groundY = h - 6;
      var shHalf = Math.max(8, sa.gap * 0.18);
      var sgL = ctx.createRadialGradient(sa.lx, groundY, 0, sa.lx, groundY, shHalf);
      sgL.addColorStop(0, "rgba(0,0,0,0.50)");
      sgL.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sgL;
      ctx.beginPath();
      ctx.ellipse(sa.lx, groundY, shHalf, shHalf * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      var sgR = ctx.createRadialGradient(sa.rx, groundY, 0, sa.rx, groundY, shHalf);
      sgR.addColorStop(0, "rgba(0,0,0,0.50)");
      sgR.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sgR;
      ctx.beginPath();
      ctx.ellipse(sa.rx, groundY, shHalf, shHalf * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- 2) Two rails as separate beams. Each is drawn as an outer rim,
    //         a graphite core, a glowing colored sheath, and a top
    //         highlight ridge so it reads as a 3D beam, not a flat line.
    function drawRailBeam(side, glowColor, sheathColor, topHL) {
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      // Outer rim
      strokeRailPolyline(side);
      ctx.strokeStyle = "rgba(40,52,72,0.95)";
      ctx.lineWidth = 9;
      ctx.stroke();
      // Graphite core
      ctx.strokeStyle = "#0a0f1a";
      ctx.lineWidth = 6.5;
      ctx.stroke();
      // Glowing sheath
      ctx.strokeStyle = sheathColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 3.2;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Top highlight ridge — sample the rail polyline shifted up by 3px.
      ctx.strokeStyle = topHL;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var i = 0; i <= TRACK_STEPS; i++) {
        var s = trackSamples[i];
        var rx = side < 0 ? s.lx : s.rx;
        var ry = (side < 0 ? s.ly : s.ry) - 3;
        if (i === 0) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.stroke();
    }
    drawRailBeam(-1, "rgba(92,242,255,1)", "rgba(150,235,255,0.95)", "rgba(220,250,255,0.95)");
    drawRailBeam( 1, "rgba(255,58,58,1)", "rgba(255,150,150,0.95)", "rgba(255,220,220,0.95)");

    // ---- 3) Cross ties: orderly perpendicular bars between the rails.
    //         12 ties in a fixed cadence with a small phase drift for
    //         motion. Each tie is a thick rectangular polygon with bolt
    //         heads at the rail contacts. Spacing guarantees the PCB
    //         remains visible between consecutive ties.
    var TIES = 12;
    var tiePhase = (t * 0.05) % (1 / TIES);
    for (var ti = 0; ti < TIES; ti++) {
      var tu = (ti / TIES) + tiePhase + 0.04;
      if (tu <= 0.05 || tu >= 0.99) continue;
      var p = projectTrack(tu);
      var dx = p.rx - p.lx;
      var dy = p.ry - p.ly;
      var len = Math.sqrt(dx*dx + dy*dy) || 1;
      if (len < 30) continue;
      // Perpendicular for tie thickness (extruded into a bar shape).
      var nxp = -dy / len;
      var nyp =  dx / len;
      var tieThick = Math.max(5, Math.min(14, len * 0.10));
      var hw = tieThick * 0.5;
      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.moveTo(p.lx + nxp * hw + 1, p.ly + nyp * hw + 3);
      ctx.lineTo(p.rx + nxp * hw + 1, p.ry + nyp * hw + 3);
      ctx.lineTo(p.rx - nxp * hw + 1, p.ry - nyp * hw + 3);
      ctx.lineTo(p.lx - nxp * hw + 1, p.ly - nyp * hw + 3);
      ctx.closePath();
      ctx.fill();
      // Copper bar body
      var barGrad = ctx.createLinearGradient(
        p.lx + nxp * hw, p.ly + nyp * hw,
        p.lx - nxp * hw, p.ly - nyp * hw
      );
      barGrad.addColorStop(0,    "rgba(120,70,30,1)");
      barGrad.addColorStop(0.45, "rgba(255,180,110,1)");
      barGrad.addColorStop(0.55, "rgba(255,210,150,1)");
      barGrad.addColorStop(1,    "rgba(80,40,15,1)");
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.moveTo(p.lx + nxp * hw, p.ly + nyp * hw);
      ctx.lineTo(p.rx + nxp * hw, p.ry + nyp * hw);
      ctx.lineTo(p.rx - nxp * hw, p.ry - nyp * hw);
      ctx.lineTo(p.lx - nxp * hw, p.ly - nyp * hw);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(20,12,4,0.95)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Bolt heads
      ctx.fillStyle = "rgba(255,240,200,0.95)";
      ctx.beginPath();
      ctx.arc(p.lx, p.ly, Math.max(1.4, tieThick * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.rx, p.ry, Math.max(1.4, tieThick * 0.22), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Art-directed electric streaks: continuous tapered light trails moving
  // along each rail. Streaks ride exactly on the rail polyline so they
  // CAN'T cross between rails. Drawn as gradient strokes for clear "light
  // trail" reading rather than scattered dots.
  function drawElectricStreaks(w, h, horizonY, t, dt, sectionPos) {
    for (var i = 0; i < streaks.length; i++) {
      var sk = streaks[i];
      sk.z += sk.speed * dt;
      if (sk.z > 1) sk.z -= 1;
      var head = Math.min(1, sk.z);
      var tail = Math.max(0, sk.z - sk.length);
      if (head <= 0.02) continue;
      var STEPS = 14;
      var pts = [];
      var side = sk.lane < 0 ? -1 : 1;
      for (var k = 0; k <= STEPS; k++) {
        var u = tail + (head - tail) * (k / STEPS);
        if (u < 0 || u > 1) continue;
        pts.push(projectTrack(u));
      }
      if (pts.length < 2) continue;
      // Build pixel polyline along this rail.
      var headP = pts[pts.length - 1];
      var tailP = pts[0];
      var hx = side < 0 ? headP.lx : headP.rx;
      var hy = side < 0 ? headP.ly : headP.ry;
      var txp = side < 0 ? tailP.lx : tailP.rx;
      var typ = side < 0 ? tailP.ly : tailP.ry;

      var grad = ctx.createLinearGradient(txp, typ, hx, hy);
      if (sk.cmd) {
        grad.addColorStop(0,    "rgba(255,58,58,0)");
        grad.addColorStop(0.55, "rgba(255,58,58,0.55)");
        grad.addColorStop(1,    "rgba(255,200,180,1)");
      } else if (side < 0) {
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
      ctx.lineWidth = Math.max(1.5, headP.gap * 0.025 * (sk.cmd ? 1.5 : 1.0));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (var pp = 0; pp < pts.length; pp++) {
        var sx = side < 0 ? pts[pp].lx : pts[pp].rx;
        var sy = side < 0 ? pts[pp].ly : pts[pp].ry;
        if (pp === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Sparse arcing sparks across the rail gap.
    for (var s = 0; s < sparks.length; s++) {
      var sp = sparks[s];
      sp.z += sp.speed * dt;
      if (sp.z > 1) sp.z -= 1;
      if (sp.z < 0.06) continue;
      var phase = (Math.sin(t * 1.2 + sp.offset) + 1) * 0.5;
      if (phase < 0.85) continue;
      var pa = projectTrack(sp.z);
      var mx = (pa.lx + pa.rx) / 2 + Math.cos(t * 3 + sp.offset) * 8;
      var my = (pa.ly + pa.ry) / 2 - 6 - Math.abs(Math.sin(t * 3 + sp.offset)) * 8;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.shadowColor = "rgba(92,242,255,0.95)";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pa.lx, pa.ly);
      ctx.quadraticCurveTo(mx, my, pa.rx, pa.ry);
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
      // content panels (not overlapping the track) and scale them up to
      // dominate the viewport.
      var lateral = 2.10;
      var p = projectSample(z, (sec.side >= 0 ? 1 : -1) * (Math.abs(sec.side) * 0.4 + lateral));
      var scale = p.halfW * 0.20;
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
    // Rebuild the art-directed cubic Bezier track once per frame. All rail,
    // tie, truss, and streak rendering reads from this stable sample table
    // instead of the dynamic projection-based curve.
    buildArtTrack(w, h, horizonY, sectionPos);

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
