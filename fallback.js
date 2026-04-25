// Procedural Canvas2D pseudo-3D circuit-board highway fallback.
// Painted into #scene-fallback only when the WebGL path is unavailable
// (probe fail, renderer construction throw, importmap/CDN failure, or
// context-lost). Persists across every section, scroll-reactive, with a
// receding perspective road, lamp pylons, packets, and a horizon skyline.
// No external dependencies. Classic script so it loads even if module
// resolution fails.
(function () {
  "use strict";

  var canvas = document.getElementById("scene-fallback");
  if (!canvas) return;
  var ctx = null;
  var rafId = 0;
  var running = false;
  var startedAt = 0;

  // Scene constants (unitless world space).
  var CYAN = "#5cf2ff";
  var CYAN_DEEP = "#3da6c8";
  var RED = "#ff3a3a";
  var ORANGE = "#ff7a3a";

  // Persistent random props seeded once so the scene reads the same
  // across frames (stars, packet seeds, building strip layouts).
  var stars = [];
  var packets = [];
  var pylons = [];
  var skyline = [];

  function seedScene() {
    stars.length = 0;
    for (var i = 0; i < 220; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.45,
        s: Math.random() * 1.4 + 0.3,
        twPhase: Math.random() * Math.PI * 2,
      });
    }
    packets.length = 0;
    for (var p = 0; p < 90; p++) {
      packets.push({
        z: Math.random(),
        lane: Math.random() < 0.5 ? -1 : 1,
        speed: 0.10 + Math.random() * 0.18,
        cmd: Math.random() < 0.12,
      });
    }
    pylons.length = 0;
    for (var k = 0; k < 18; k++) {
      pylons.push({
        z: k / 18,
        side: k % 2 === 0 ? -1 : 1,
        color: k % 3 === 0 ? RED : CYAN,
        h: 0.16 + Math.random() * 0.06,
      });
    }
    skyline.length = 0;
    for (var b = 0; b < 26; b++) {
      skyline.push({
        x: Math.random(),
        w: 0.018 + Math.random() * 0.05,
        h: 0.04 + Math.random() * 0.16,
        color: Math.random() < 0.7 ? CYAN : RED,
        windowsRows: Math.floor(2 + Math.random() * 5),
      });
    }
  }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.max(2, Math.floor(w * dpr));
    canvas.height = Math.max(2, Math.floor(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Project a point on the road (zNorm 0=horizon, 1=foreground) to
  // screen pixels. Uses simple perspective: foreground is wide and low,
  // horizon is narrow and high.
  function project(zNorm, xLane, w, h, horizonY) {
    var t = Math.max(0, Math.min(1, zNorm));
    var roadHalfFG = w * 0.62;
    var roadHalfH = w * 0.012;
    var halfW = roadHalfH + (roadHalfFG - roadHalfH) * t * t;
    var groundY = horizonY + (h - horizonY) * (t * t * 0.96 + t * 0.04);
    return {
      x: w * 0.5 + xLane * halfW,
      y: groundY,
      halfW: halfW,
    };
  }

  function drawSky(w, h, horizonY, scrollFrac) {
    // Body already paints a deep gradient; we add a soft sun glow that
    // shifts with scroll so the scene feels like aerial travel.
    var cx = w * 0.5;
    var cy = horizonY + h * 0.04 - scrollFrac * 30;
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55);
    grad.addColorStop(0, "rgba(255,90,58,0.22)");
    grad.addColorStop(0.45, "rgba(255,42,42,0.08)");
    grad.addColorStop(1, "rgba(255,42,42,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Cyan haze band along the horizon.
    var grad2 = ctx.createLinearGradient(0, horizonY - h * 0.05, 0, horizonY + h * 0.04);
    grad2.addColorStop(0, "rgba(92,242,255,0)");
    grad2.addColorStop(0.55, "rgba(92,242,255,0.10)");
    grad2.addColorStop(1, "rgba(92,242,255,0)");
    ctx.fillStyle = grad2;
    ctx.fillRect(0, horizonY - h * 0.05, w, h * 0.09);
  }

  function drawStars(w, horizonY, t) {
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.x * w;
      var sy = s.y * horizonY;
      var alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.4 + s.twPhase));
      ctx.fillStyle = "rgba(170,200,255," + alpha.toFixed(3) + ")";
      ctx.fillRect(sx, sy, s.s, s.s);
    }
  }

  function drawSkyline(w, horizonY) {
    // Distant futuristic skyline silhouette across the horizon line.
    var baseY = horizonY;
    for (var i = 0; i < skyline.length; i++) {
      var b = skyline[i];
      var x = b.x * w;
      var bw = b.w * w;
      var bh = b.h * horizonY;
      ctx.fillStyle = "#0a1426";
      ctx.fillRect(x, baseY - bh, bw, bh);
      ctx.strokeStyle = b.color === RED ? "rgba(255,58,58,0.55)" : "rgba(92,242,255,0.55)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, baseY - bh + 0.5, Math.max(1, bw - 1), Math.max(1, bh - 1));
      // Window strips
      ctx.fillStyle = b.color === RED ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      var rows = b.windowsRows;
      for (var r = 1; r <= rows; r++) {
        var ry = baseY - bh + (bh / (rows + 1)) * r;
        ctx.fillRect(x + 1.5, ry, Math.max(1, bw - 3), 0.8);
      }
      // Antenna / beacon on a few of the taller buildings
      if (bh > horizonY * 0.12 && i % 4 === 0) {
        ctx.strokeStyle = "rgba(255,58,58,0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + bw * 0.5, baseY - bh);
        ctx.lineTo(x + bw * 0.5, baseY - bh - 8);
        ctx.stroke();
        ctx.fillStyle = "#ff5a3a";
        ctx.fillRect(x + bw * 0.5 - 1, baseY - bh - 9, 2, 2);
      }
    }
    // Horizon trace line.
    ctx.strokeStyle = "rgba(92,242,255,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 0.5);
    ctx.lineTo(w, baseY + 0.5);
    ctx.stroke();
  }

  function drawGround(w, h, horizonY) {
    // Receding PCB substrate beneath the highway.
    var grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, "#0a1830");
    grad.addColorStop(0.5, "#0c1a2e");
    grad.addColorStop(1, "#040810");
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Receding PCB grid lines (horizontal bands compressed near the horizon).
    ctx.strokeStyle = "rgba(92,242,255,0.10)";
    ctx.lineWidth = 1;
    for (var i = 0; i < 28; i++) {
      var t = i / 28;
      var y = horizonY + (h - horizonY) * (t * t * 0.96 + t * 0.04);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  function drawHighway(w, h, horizonY, t) {
    // Filled road polygon.
    var top = project(0.0, 0, w, h, horizonY);
    var bot = project(1.0, 0, w, h, horizonY);
    ctx.fillStyle = "#0e1c34";
    ctx.beginPath();
    ctx.moveTo(top.x - top.halfW, top.y);
    ctx.lineTo(top.x + top.halfW, top.y);
    ctx.lineTo(bot.x + bot.halfW, bot.y);
    ctx.lineTo(bot.x - bot.halfW, bot.y);
    ctx.closePath();
    ctx.fill();

    // Inner copper band.
    var topI = project(0.0, 0, w, h, horizonY);
    var botI = project(1.0, 0, w, h, horizonY);
    ctx.fillStyle = "rgba(192,68,40,0.45)";
    ctx.beginPath();
    ctx.moveTo(topI.x - topI.halfW * 0.55, topI.y);
    ctx.lineTo(topI.x + topI.halfW * 0.55, topI.y);
    ctx.lineTo(botI.x + botI.halfW * 0.55, botI.y);
    ctx.lineTo(botI.x - botI.halfW * 0.55, botI.y);
    ctx.closePath();
    ctx.fill();

    // Cyan rail (left).
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(92,242,255,0.7)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(top.x - top.halfW, top.y);
    ctx.lineTo(bot.x - bot.halfW, bot.y);
    ctx.stroke();
    // Red rail (right).
    ctx.strokeStyle = RED;
    ctx.shadowColor = "rgba(255,58,58,0.7)";
    ctx.beginPath();
    ctx.moveTo(top.x + top.halfW, top.y);
    ctx.lineTo(bot.x + bot.halfW, bot.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center spine + animated dashes.
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bot.x, bot.y);
    ctx.stroke();

    // Dashes — march from horizon to viewer with time.
    var dashCount = 16;
    for (var i = 0; i < dashCount; i++) {
      var di = (i + (t * 0.6) % 1) / dashCount;
      var pTop = project(Math.max(0, di - 0.04), 0, w, h, horizonY);
      var pBot = project(Math.min(1, di + 0.04), 0, w, h, horizonY);
      ctx.strokeStyle = i % 2 === 0 ? "#ffffff" : ORANGE;
      ctx.lineWidth = Math.max(1, 0.5 + di * 5);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
      ctx.stroke();
    }
  }

  function drawPylons(w, h, horizonY, t, scrollFrac) {
    for (var i = 0; i < pylons.length; i++) {
      var py = pylons[i];
      var z = (py.z + (t * 0.06) + scrollFrac * 0.4) % 1;
      var lane = py.side * 1.45;
      var p = project(z, lane, w, h, horizonY);
      var topY = p.y - p.halfW * py.h * 6;
      var lampSize = Math.max(2, p.halfW * 0.04);
      // Post
      ctx.strokeStyle = "rgba(170,200,255,0.55)";
      ctx.lineWidth = Math.max(1, p.halfW * 0.012);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, topY);
      ctx.stroke();
      // Crown lamp glow
      var glow = ctx.createRadialGradient(p.x, topY, 0, p.x, topY, lampSize * 6);
      glow.addColorStop(0, py.color === RED ? "rgba(255,58,58,0.95)" : "rgba(92,242,255,0.95)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, topY, lampSize * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = py.color;
      ctx.beginPath();
      ctx.arc(p.x, topY, lampSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPackets(w, h, horizonY, t, dt) {
    for (var i = 0; i < packets.length; i++) {
      var pk = packets[i];
      pk.z += pk.speed * dt;
      if (pk.z > 1) pk.z -= 1;
      var lane = pk.lane * 0.18;
      var pos = project(pk.z, lane, w, h, horizonY);
      var size = Math.max(1.2, pos.halfW * (pk.cmd ? 0.06 : 0.035));
      ctx.fillStyle = pk.cmd ? RED : (pk.lane < 0 ? "#ffffff" : "#9ff8ff");
      ctx.shadowColor = pk.cmd ? "rgba(255,58,58,0.85)" : "rgba(92,242,255,0.85)";
      ctx.shadowBlur = pk.cmd ? 10 : 6;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - size * 0.3, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawScanlines(w, h) {
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (var y = 0; y < h; y += 3) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  function drawFrame() {
    if (!running) return;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var now = performance.now() / 1000;
    var t = now - startedAt;
    var dt = 1 / 60;
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var scrollFrac = Math.max(0, Math.min(1, window.scrollY / docH));

    // Horizon shifts subtly with scroll so the sky/skyline parallax
    // reads as forward motion through the city.
    var horizonY = h * (0.42 - scrollFrac * 0.06);

    ctx.clearRect(0, 0, w, h);
    drawSky(w, h, horizonY, scrollFrac);
    drawStars(w, horizonY, t);
    drawSkyline(w, horizonY);
    drawGround(w, h, horizonY);
    drawHighway(w, h, horizonY, t + scrollFrac * 4);
    drawPylons(w, h, horizonY, t, scrollFrac);
    drawPackets(w, h, horizonY, t, dt);
    drawScanlines(w, h);

    rafId = requestAnimationFrame(drawFrame);
  }

  function start() {
    if (running) return;
    ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    seedScene();
    size();
    window.addEventListener("resize", size);
    running = true;
    startedAt = performance.now() / 1000;
    rafId = requestAnimationFrame(drawFrame);
    try { console.info("[brainstorm] Procedural Canvas2D fallback running"); } catch (_) {}
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  // Public hook: the WebGL module / watchdog calls this when WebGL is
  // unavailable. Idempotent.
  window.__brainstormStartFallback = start;
  window.__brainstormStopFallback = stop;

  // If html.no-webgl is already set (e.g. server-side hint, prior session),
  // start immediately. Otherwise wait for the WebGL module to call us.
  if (document.documentElement.classList.contains("no-webgl")) {
    start();
  }
})();
