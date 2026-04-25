import * as THREE from "three";
import { DISTRICTS, AGENT_SAMPLE } from "./districts.js";

// ---------- SCENE ----------
const isMobile = window.matchMedia("(max-width: 640px)").matches;
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = isMobile || isCoarsePointer;

const canvas = document.getElementById("scene");
window.__brainstormRenderFrames = 0;

function setWebGLStatus(status) {
  document.documentElement.dataset.webglStatus = status;
}

function activateNoWebGL(reason) {
  document.documentElement.classList.add("no-webgl");
  setWebGLStatus(reason || "unavailable");
  if (typeof window.__brainstormStartFallback === "function") {
    try { window.__brainstormStartFallback(); } catch (_) {}
  }
}

// Probe a real WebGL context BEFORE asking Three to construct the renderer.
// If the probe fails we fall back gracefully (no rethrow) so the rest of
// the page JS keeps working and the procedural Canvas2D fallback can run.
setWebGLStatus("probing");
const glAttrs = {
  alpha: true,
  antialias: !lowPower,
  powerPreference: lowPower ? "low-power" : "high-performance",
  preserveDrawingBuffer: false,
  failIfMajorPerformanceCaveat: false,
};
let gl = null;
try {
  gl = canvas.getContext("webgl2", glAttrs) || canvas.getContext("webgl", glAttrs) || canvas.getContext("experimental-webgl", glAttrs);
} catch (probeErr) {
  console.warn("WebGL context probe threw:", probeErr);
}

let renderer = null;
if (gl) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = lowPower ? 1.6 : 1.5;
    setWebGLStatus("starting");
    console.info("[brainstorm] WebGL renderer created");
  } catch (err) {
    console.warn("[brainstorm] WebGL renderer construction failed", err);
    renderer = null;
  }
}

if (!renderer) {
  activateNoWebGL("failed");
  // Stop module execution gracefully. The Canvas2D fallback (loaded
  // separately) takes over the persistent backdrop.
  throw new Error("WebGL unavailable; using procedural fallback");
}

// Recover from rare context-loss events instead of leaving a black canvas.
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  console.warn("[brainstorm] WebGL context lost");
  setWebGLStatus("context-lost");
  activateNoWebGL("context-lost");
}, false);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06101e);
// Very light atmospheric haze so the camera reads buildings, road, and
// stars at every section pose. Rails, pads, traces, beacons, packets are
// flagged fog:false so the electric circuit highway always reads as a
// live trace, never as empty dark space.
scene.fog = new THREE.FogExp2(0x06101e, lowPower ? 0.00018 : 0.00022);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 8000);
// Hero camera is a cinematic aerial pull-back so the entire electric
// circuit-highway corridor and the Spire are framed in shot from the
// first paint. Tilted slightly down toward the highway so the rails
// charge into the foreground.
camera.position.set(0, 320, 620);
camera.lookAt(0, 40, -120);

scene.add(new THREE.AmbientLight(0x7a90c0, lowPower ? 1.7 : 1.6));
const key = new THREE.DirectionalLight(0xffe0d0, lowPower ? 1.9 : 1.7); key.position.set(300, 500, 300); scene.add(key);
const rim = new THREE.DirectionalLight(0xff5566, lowPower ? 1.4 : 1.2); rim.position.set(-400, 240, -600); scene.add(rim);
const cyanLight = new THREE.DirectionalLight(0x6ff5ff, lowPower ? 1.45 : 1.25); cyanLight.position.set(0, 240, -400); scene.add(cyanLight);
const fillLight = new THREE.DirectionalLight(0xaad0ff, 0.95); fillLight.position.set(120, 300, 200); scene.add(fillLight);

// ---------- CIRCUIT-BOARD GROUND ----------
// The ground is a long PCB stretching from the hero (Z=+300) down to past
// the contact pad (Z<-1800). It reads as a printed circuit board with an
// etched copper-and-cyan trace highway running down its spine.
const BOARD_W = 1800;
const BOARD_L = 2600;
const BOARD_OFFSET_Z = -700;  // shift board so it covers the full highway

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_W, BOARD_L),
  new THREE.MeshStandardMaterial({ color: 0x1c3460, roughness: 0.55, metalness: 0.55, emissive: 0x1a2c52, emissiveIntensity: 1.55 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.z = BOARD_OFFSET_Z;
scene.add(floor);

// Etched PCB grid — fine lines that read as the underlying board substrate.
const gridFine = new THREE.GridHelper(Math.max(BOARD_W, BOARD_L), 240, 0x4a7898, 0x1c3a5a);
gridFine.material.transparent = true; gridFine.material.opacity = 0.85;
gridFine.material.fog = false;
gridFine.position.z = BOARD_OFFSET_Z;
scene.add(gridFine);
// Coarser brand-red copper grid overlay
const gridCoarse = new THREE.GridHelper(Math.max(BOARD_W, BOARD_L), 26, 0xff5a5a, 0xa02828);
gridCoarse.material.transparent = true; gridCoarse.material.opacity = 0.65;
gridCoarse.material.fog = false;
gridCoarse.position.set(0, 0.02, BOARD_OFFSET_Z); scene.add(gridCoarse);

// ---------- THE CIRCUIT HIGHWAY ----------
// A straight axial trace on Z that the camera will travel down. Broad dark
// core flanked by cyan + red copper rails, dashed white center spine, and
// glowing solder pads at each district checkpoint.
const HIGHWAY_X = 0;
const HIGHWAY_Z_START =  300;   // behind the hero camera
const HIGHWAY_Z_END   = -1800;  // past the contact pad
const HIGHWAY_LENGTH = HIGHWAY_Z_START - HIGHWAY_Z_END;
const HIGHWAY_HALF_WIDTH = 38;
const ROAD_Y = 0.15;

// Road core — wide dark trace (the "trace metal" of the PCB).
const roadCore = new THREE.Mesh(
  new THREE.PlaneGeometry(HIGHWAY_HALF_WIDTH * 2, HIGHWAY_LENGTH),
  new THREE.MeshStandardMaterial({ color: 0x223a5a, roughness: 0.45, metalness: 0.7, emissive: 0x1c3460, emissiveIntensity: 1.200, fog: false })
);
roadCore.rotation.x = -Math.PI / 2;
roadCore.position.set(HIGHWAY_X, ROAD_Y, (HIGHWAY_Z_START + HIGHWAY_Z_END) / 2);
scene.add(roadCore);

// Inner copper-tone band — the warm tint that reads as PCB copper trace.
const copperBand = new THREE.Mesh(
  new THREE.PlaneGeometry(HIGHWAY_HALF_WIDTH * 1.4, HIGHWAY_LENGTH),
  new THREE.MeshBasicMaterial({ color: 0xc04428, transparent: true, opacity: 0.55, fog: false })
);
copperBand.rotation.x = -Math.PI / 2;
copperBand.position.set(HIGHWAY_X, ROAD_Y + 0.05, (HIGHWAY_Z_START + HIGHWAY_Z_END) / 2);
scene.add(copperBand);

// Twin rails — cyan (left) and red copper (right) glowing edges. Boxes are
// taller and wider so the electric road reads from any cinematic pose.
function addRail(xOffset, color, opacity, width = 2.6, height = 1.8) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, HIGHWAY_LENGTH),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, fog: false })
  );
  rail.position.set(HIGHWAY_X + xOffset, ROAD_Y + 0.7, (HIGHWAY_Z_START + HIGHWAY_Z_END) / 2);
  scene.add(rail);
}
addRail(-HIGHWAY_HALF_WIDTH, 0x8cf8ff, 1.0, 3.0, 2.0);
addRail( HIGHWAY_HALF_WIDTH, 0xff5a5a, 0.98, 3.0, 2.0);
// Secondary inner trace lines
addRail(-HIGHWAY_HALF_WIDTH * 0.55, 0x4abad0, 0.9, 1.6, 1.2);
addRail( HIGHWAY_HALF_WIDTH * 0.55, 0xc83838, 0.9, 1.6, 1.2);

// Center current spine — glowing white live wire.
const spine = new THREE.Mesh(
  new THREE.BoxGeometry(0.9, 0.5, HIGHWAY_LENGTH),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false })
);
spine.position.set(HIGHWAY_X, ROAD_Y + 0.3, (HIGHWAY_Z_START + HIGHWAY_Z_END) / 2);
scene.add(spine);

// Dashed lane markers down the spine — bright emissive dashes that read
// like live current pulses on the trace from any aerial pose.
const DASH_SPACING = 18;
const dashCount = Math.floor(HIGHWAY_LENGTH / DASH_SPACING);
for (let i = 0; i < dashCount; i++) {
  const z = HIGHWAY_Z_START - (i + 0.5) * DASH_SPACING;
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.5, 11),
    new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0xff5a3a : 0xffffff, transparent: true, opacity: 1.0, fog: false })
  );
  dash.position.set(HIGHWAY_X, ROAD_Y + 0.6, z);
  scene.add(dash);
}

// ---------- PCB MICRO-TRACES + SOLDER PADS ----------
// Perpendicular micro-traces branching off the highway, with small circular
// solder pads at their ends. Sells the "circuit board" reading from above.
function addMicroTrace(z, side, length, color = 0x5cf2ff) {
  const trace = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.3, 0.7),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false })
  );
  const sx = HIGHWAY_X + side * (HIGHWAY_HALF_WIDTH + length / 2);
  trace.position.set(sx, ROAD_Y + 0.18, z);
  scene.add(trace);
  // Solder pad at the tip
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 18),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(HIGHWAY_X + side * (HIGHWAY_HALF_WIDTH + length), ROAD_Y + 0.22, z);
  scene.add(pad);
  // Tiny via dot at the junction
  const via = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, fog: false })
  );
  via.rotation.x = -Math.PI / 2;
  via.position.set(HIGHWAY_X + side * HIGHWAY_HALF_WIDTH, ROAD_Y + 0.2, z);
  scene.add(via);
}
const MICRO_TRACE_COUNT = lowPower ? 36 : 84;
for (let i = 0; i < MICRO_TRACE_COUNT; i++) {
  const z = HIGHWAY_Z_START - (i + 0.5) * (HIGHWAY_LENGTH / MICRO_TRACE_COUNT);
  const side = i % 2 === 0 ? -1 : 1;
  const len = 18 + Math.random() * 36;
  const col = i % 5 === 0 ? 0xff5a3a : 0x5cf2ff;
  addMicroTrace(z, side, len, col);
}

// Scattered chip-like base plates and tiny resistor blocks on the board.
const CHIP_COUNT = lowPower ? 14 : 36;
for (let i = 0; i < CHIP_COUNT; i++) {
  const sideSign = Math.random() < 0.5 ? -1 : 1;
  const x = sideSign * (HIGHWAY_HALF_WIDTH + 70 + Math.random() * 380);
  const z = HIGHWAY_Z_START - Math.random() * HIGHWAY_LENGTH;
  const w = 8 + Math.random() * 18;
  const d = 6 + Math.random() * 14;
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(w, 1.2, d),
    new THREE.MeshStandardMaterial({ color: 0x223850, roughness: 0.4, metalness: 0.6, emissive: 0x081826, emissiveIntensity: 1.080 })
  );
  chip.position.set(x, ROAD_Y + 0.6, z);
  scene.add(chip);
  // Tiny LED dot on the chip
  const led = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 12),
    new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x5cf2ff : 0xff3a3a })
  );
  led.rotation.x = -Math.PI / 2;
  led.position.set(x, ROAD_Y + 1.3, z);
  scene.add(led);
}

// ---------- BRANCH TRACES + CHECKPOINT PADS ----------
// Each district sits to one side of the highway. A branch trace runs from
// the highway shoulder to the building's circular solder pad (the chip pad).
const energyNodes = [];        // pulsing markers for animation
const checkpointPads = [];     // for camera waypoints

function addBranchTrace(z, targetX, color) {
  const side = targetX < 0 ? -1 : 1;
  const startX = HIGHWAY_X + side * HIGHWAY_HALF_WIDTH;
  const endX = targetX - side * 60;  // end at edge of building pad
  const length = Math.abs(endX - startX);
  const cx = (startX + endX) / 2;
  // Wide branch road
  const branch = new THREE.Mesh(
    new THREE.PlaneGeometry(length, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.55 })
  );
  branch.rotation.x = -Math.PI / 2;
  branch.position.set(cx, ROAD_Y + 0.04, z);
  scene.add(branch);
  // Twin glowing edge traces
  for (const sign of [-1, 1]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.6, 0.7),
      new THREE.MeshBasicMaterial({ color: sign < 0 ? 0x5cf2ff : color, transparent: true, opacity: 0.85 })
    );
    edge.position.set(cx, ROAD_Y + 0.4, z + sign * 6);
    scene.add(edge);
  }
  // Center white spine on branch
  const bspine = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.3, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
  );
  bspine.position.set(cx, ROAD_Y + 0.3, z);
  scene.add(bspine);
  return { startX, endX, side };
}

function addCircuitPad(x, z, color, radius) {
  // Circular solder/chip pad the building stands on.
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius + 1.6, 1.6, 48),
    new THREE.MeshStandardMaterial({ color: 0x1a2a44, metalness: 0.7, roughness: 0.35, emissive: new THREE.Color(color), emissiveIntensity: 0.825 })
  );
  pad.position.set(x, ROAD_Y + 0.8, z);
  scene.add(pad);
  // Outer glowing ring (the solder ring)
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius + 0.4, radius + 1.6, 64),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, ROAD_Y + 1.7, z);
  scene.add(ring);
  // Inner copper-red ring for circuit-board feel
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(radius - 6, radius - 5.2, 64),
    new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(x, ROAD_Y + 1.72, z);
  scene.add(inner);
  // Four small via dots around the perimeter — chip-mount feel
  for (let a = 0; a < 4; a++) {
    const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
    const vx = x + Math.cos(ang) * (radius + 0.8);
    const vz = z + Math.sin(ang) * (radius + 0.8);
    const via = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.740 })
    );
    via.position.set(vx, ROAD_Y + 1.4, vz);
    scene.add(via);
  }
  energyNodes.push({ ring, basePhase: Math.random() * Math.PI * 2, baseR: radius + 0.4, baseR2: radius + 1.6 });
  return { pad, ring };
}

// ---------- BUILDING BUILDERS ----------
// Graphite/black bodies with emissive cyan/red/white details. Each has
// recognizable architectural silhouette so it reads as a building, not a blob.

function addWindowsBand(parent, w, h, d, color, count = 3) {
  // Thin emissive rectangles wrapping the body — tower window strips.
  for (let i = 0; i < count; i++) {
    const y = (i + 0.5) * (h / count);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.05, 0.7, d + 0.05),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    strip.position.y = y - h / 2;
    parent.add(strip);
  }
}
function vertLightStripes(parent, w, h, d, color) {
  // Vertical glow strips on building corners — "windows lit at night" feel.
  const positions = [
    [ w / 2 + 0.05, 0,  d / 2 + 0.05],
    [-w / 2 - 0.05, 0,  d / 2 + 0.05],
    [ w / 2 + 0.05, 0, -d / 2 - 0.05],
    [-w / 2 - 0.05, 0, -d / 2 - 0.05],
  ];
  for (const p of positions) {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, h * 0.92, 0.4),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    s.position.set(p[0], 0, p[2]);
    parent.add(s);
  }
}

// 01 / Spire — tall command spire with crown, vertical light strips, antenna mast.
function makeSpire(d) {
  const g = new THREE.Group();
  const tall = d.tall;
  const segments = 6;
  const segH = tall / segments;
  const baseW = 50;
  // Wide foundation block
  const found = new THREE.Mesh(
    new THREE.BoxGeometry(baseW + 24, 6, baseW + 24),
    new THREE.MeshStandardMaterial({ color: 0x1c2c44, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.706 })
  );
  found.position.y = 3; g.add(found);
  // Stepped tower body — narrows as it rises
  for (let i = 0; i < segments; i++) {
    const w = baseW - i * 6;
    const sec = new THREE.Mesh(
      new THREE.BoxGeometry(w, segH, w),
      new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 0.604 })
    );
    sec.position.y = 6 + i * segH + segH / 2;
    g.add(sec);
    // Edge seam glow
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.1, 0.5, w + 0.1),
      new THREE.MeshBasicMaterial({ color: d.color })
    );
    seam.position.y = 6 + i * segH + segH;
    g.add(seam);
    // Vertical lit strips on each segment
    vertLightStripes(sec, w, segH, w, 0x5cf2ff);
    sec.children[sec.children.length - 1]; // (no-op, just clarity)
  }
  // Crown — wider glowing ring at top of body
  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(20, 1.6, 10, 48),
    new THREE.MeshBasicMaterial({ color: d.color })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 6 + tall + 4;
  g.add(crown);
  // Antenna mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.4, 38, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.9, roughness: 0.2 })
  );
  mast.position.y = 6 + tall + 19;
  g.add(mast);
  // Mast tip beacon
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  tip.position.y = 6 + tall + 40;
  g.add(tip);
  return g;
}

// 02 / Foundry — connected fabrication towers with skybridge + pods + energy core.
function makeFoundry(d) {
  const g = new THREE.Group();
  // Twin towers
  const tower = (x, h) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(18, h, 18),
      new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.655 })
    );
    body.position.set(x, h / 2, 0);
    g.add(body);
    addWindowsBand(body, 18, h, 18, 0x5cf2ff, 4);
    // Antenna nub
    const nub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.9, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.9, roughness: 0.2 })
    );
    nub.position.set(x, h + 3, 0);
    g.add(nub);
    return body;
  };
  const tA = tower(-22, d.tall);
  const tB = tower( 22, d.tall * 0.78);
  // Skybridge between the two towers
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(44, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a4060, metalness: 0.7, roughness: 0.3, emissive: 0x5cf2ff, emissiveIntensity: 1.080 })
  );
  bridge.position.set(0, d.tall * 0.6, 0);
  g.add(bridge);
  const bridgeGlow = new THREE.Mesh(
    new THREE.BoxGeometry(44, 0.5, 8.2),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff })
  );
  bridgeGlow.position.set(0, d.tall * 0.6 + 2.2, 0);
  g.add(bridgeGlow);
  // Modular pods clustered at the base
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const px = Math.cos(ang) * 30;
    const pz = Math.sin(ang) * 22;
    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(8, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x243a55, metalness: 0.7, roughness: 0.4, emissive: new THREE.Color(d.color), emissiveIntensity: 0.825 })
    );
    pod.position.set(px, 3, pz);
    g.add(pod);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.5, 8.2),
      new THREE.MeshBasicMaterial({ color: d.color })
    );
    cap.position.set(px, 6.4, pz);
    g.add(cap);
  }
  // Energy core — glowing sphere between towers at base
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(5, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95 })
  );
  core.position.set(0, 6, 0);
  g.add(core);
  return g;
}

// 03 / Voice Grid — antenna/transmitter array with signal rings, fins, dish.
function makeAntenna(d) {
  const g = new THREE.Group();
  // Tapered tower base
  const cone = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 14, d.tall, 10),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 0.774 })
  );
  cone.position.y = d.tall / 2;
  g.add(cone);
  // Vertical light strip up the tower
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, d.tall * 0.85, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.9 })
  );
  strip.position.y = d.tall / 2;
  strip.position.z = 6;
  g.add(strip);
  // Signal rings up the tower
  for (let i = 0; i < 4; i++) {
    const r = 12 - i * 2;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.32, 8, 48),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7 - i * 0.1 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 12 + i * 16;
    g.add(ring);
  }
  // Three radial fins/antennas at top
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.9, roughness: 0.2, emissive: new THREE.Color(d.color), emissiveIntensity: 1.080 })
    );
    fin.position.set(Math.cos(ang) * 10, d.tall - 4, Math.sin(ang) * 10);
    fin.rotation.y = ang;
    g.add(fin);
  }
  // Dish at the very top
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(7, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x243a55, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide, emissive: 0x5cf2ff, emissiveIntensity: 0.910 })
  );
  dish.rotation.x = Math.PI;
  dish.position.y = d.tall + 4;
  g.add(dish);
  // Beacon
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  beacon.position.y = d.tall + 12;
  g.add(beacon);
  return g;
}

// 04 / Ops Tower — command/observation tower with ring deck + radar module.
function makeOps(d) {
  const g = new THREE.Group();
  // Wide stepped base
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(22, 26, 8, 12),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.604 })
  );
  base.position.y = 4;
  g.add(base);
  // Tall observation column
  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 10, d.tall * 0.7, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a4060, metalness: 0.85, roughness: 0.25, emissive: 0x5cf2ff, emissiveIntensity: 0.706 })
  );
  col.position.y = 8 + d.tall * 0.35;
  g.add(col);
  // Lit window strips
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(
      new THREE.TorusGeometry(8.2, 0.25, 6, 36),
      new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.9 })
    );
    s.rotation.x = Math.PI / 2;
    s.position.y = 14 + i * 12;
    g.add(s);
  }
  // Ring deck — observation platform
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 3, 24),
    new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.825 })
  );
  deck.position.y = d.tall * 0.78;
  g.add(deck);
  const deckGlow = new THREE.Mesh(
    new THREE.TorusGeometry(20, 0.5, 8, 48),
    new THREE.MeshBasicMaterial({ color: d.color })
  );
  deckGlow.rotation.x = Math.PI / 2;
  deckGlow.position.y = d.tall * 0.78 + 1.7;
  g.add(deckGlow);
  // Radar module on top
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.8, roughness: 0.3 })
  );
  cap.position.y = d.tall * 0.78 + 5;
  g.add(cap);
  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.6, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff })
  );
  radar.position.y = d.tall * 0.78 + 8;
  g.add(radar);
  // Tip beacon
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  tip.position.y = d.tall * 0.78 + 11;
  g.add(tip);
  return g;
}

// 05 / Revenue Engine — reactor/generator with turbine rings and conduits.
function makeReactor(d) {
  const g = new THREE.Group();
  // Squat cylindrical reactor body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 24, d.tall * 0.6, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a4060, metalness: 0.85, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.706 })
  );
  body.position.y = d.tall * 0.3;
  g.add(body);
  // Glowing core slot
  const slot = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, d.tall * 0.4, 16),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
  );
  slot.position.y = d.tall * 0.32;
  g.add(slot);
  // Stacked turbine rings
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(22, 1.2, 10, 36),
      new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.9, roughness: 0.2, emissive: new THREE.Color(d.color), emissiveIntensity: 0.910 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 6 + i * (d.tall * 0.55 / 4);
    g.add(ring);
  }
  // Top cone heat sink
  const heatSink = new THREE.Mesh(
    new THREE.ConeGeometry(14, d.tall * 0.4, 12),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.85, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.740 })
  );
  heatSink.position.y = d.tall * 0.6 + d.tall * 0.2;
  g.add(heatSink);
  // Lateral conduits radiating from the base
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const conduit = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.4, 1.4),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7 })
    );
    conduit.position.set(Math.cos(ang) * 18, 4, Math.sin(ang) * 18);
    conduit.rotation.y = ang;
    g.add(conduit);
  }
  // Top beacon
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  beacon.position.y = d.tall * 0.6 + d.tall * 0.4 + 2;
  g.add(beacon);
  return g;
}

// 06 / Content Forge — studio with holographic facade and light strips.
function makeStudio(d) {
  const g = new THREE.Group();
  // Wide rectangular studio body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(50, d.tall, 30),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.655 })
  );
  body.position.y = d.tall / 2;
  g.add(body);
  // Holographic facade billboard on the front face
  const billboard = new THREE.Mesh(
    new THREE.BoxGeometry(44, d.tall * 0.7, 0.6),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
  );
  billboard.position.set(0, d.tall / 2, 15.4);
  g.add(billboard);
  // Holo grid overlay — thin cyan lines on the billboard
  for (let i = 0; i < 5; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(44.2, 0.3, 0.2),
      new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.85 })
    );
    line.position.set(0, d.tall * 0.18 + i * (d.tall * 0.6 / 4), 15.7);
    g.add(line);
  }
  // Side light strips
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, d.tall * 0.85, 30.1),
      new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.85 })
    );
    strip.position.set(s * 25.1, d.tall / 2, 0);
    g.add(strip);
  }
  // Roof rigging — small antenna pods
  for (let i = -1; i <= 1; i++) {
    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.9, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 1.080 })
    );
    pod.position.set(i * 18, d.tall + 2, -10);
    g.add(pod);
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.9, roughness: 0.2 })
    );
    ant.position.set(i * 18, d.tall + 8, -10);
    g.add(ant);
  }
  return g;
}

// 07 / Integration Hub — central connector with dome, ring, ports, conduits.
function makeHub(d) {
  const g = new THREE.Group();
  // Wide drum base
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(26, 28, d.tall * 0.5, 24),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.706 })
  );
  drum.position.y = d.tall * 0.25;
  g.add(drum);
  // Glass dome on top
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(22, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2a4060, metalness: 0.7, roughness: 0.2, emissive: new THREE.Color(d.color), emissiveIntensity: 0.825, transparent: true, opacity: 0.85 })
  );
  dome.position.y = d.tall * 0.5;
  g.add(dome);
  // Equatorial ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(28, 1.2, 10, 64),
    new THREE.MeshBasicMaterial({ color: d.color })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = d.tall * 0.5;
  g.add(ring);
  // Eight radial ports/conduits around the drum
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const port = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4, 4),
      new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.9, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 1.080 })
    );
    port.position.set(Math.cos(ang) * 28, d.tall * 0.25, Math.sin(ang) * 28);
    port.rotation.y = ang;
    g.add(port);
    // Conduit running outward along the ground
    const conduit = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.6, 1.2),
      new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x5cf2ff : d.color, transparent: true, opacity: 0.8 })
    );
    conduit.position.set(Math.cos(ang) * 38, 1.5, Math.sin(ang) * 38);
    conduit.rotation.y = ang;
    g.add(conduit);
  }
  // Top mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 1.2, 22, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.9, roughness: 0.2 })
  );
  mast.position.y = d.tall * 0.5 + 22;
  g.add(mast);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff })
  );
  tip.position.y = d.tall * 0.5 + 34;
  g.add(tip);
  return g;
}

// 08 / Contact Pad — landing pad with beacon tower and ring platform.
function makePad(d) {
  const g = new THREE.Group();
  // Wide circular landing platform
  const plat = new THREE.Mesh(
    new THREE.CylinderGeometry(28, 30, 4, 32),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.8, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.825 })
  );
  plat.position.y = 2;
  g.add(plat);
  // Glowing landing ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(28, 0.7, 10, 64),
    new THREE.MeshBasicMaterial({ color: d.color })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 4.4;
  g.add(ring);
  // Inner pattern — a cross of light strips on the deck (heliport-style)
  for (let i = 0; i < 2; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.3, 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    bar.position.y = 4.3;
    bar.rotation.y = (i * Math.PI) / 2;
    g.add(bar);
  }
  // Central beacon tower
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, d.tall, 10),
    new THREE.MeshStandardMaterial({ color: 0x2a4060, metalness: 0.85, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 0.910 })
  );
  tower.position.y = 4 + d.tall / 2;
  g.add(tower);
  // Light strip up the tower
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, d.tall * 0.85, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95 })
  );
  strip.position.y = 4 + d.tall / 2;
  g.add(strip);
  // Top beacon sphere with halo ring
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(3, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a })
  );
  beacon.position.y = 4 + d.tall + 3;
  g.add(beacon);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(6, 0.4, 8, 36),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.7 })
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 4 + d.tall + 3;
  g.add(halo);
  // Four corner mooring bollards on the platform edge
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bol = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x304a6a, metalness: 0.9, roughness: 0.25, emissive: 0x5cf2ff, emissiveIntensity: 0.995 })
    );
    bol.position.set(Math.cos(ang) * 26, 6, Math.sin(ang) * 26);
    g.add(bol);
  }
  return g;
}

const builders = {
  spire: makeSpire,
  foundry: makeFoundry,
  antenna: makeAntenna,
  ops: makeOps,
  reactor: makeReactor,
  studio: makeStudio,
  hub: makeHub,
  pad: makePad,
};

// ---------- LABEL SPRITE ----------
function makeLabelSprite(text, color) {
  const W = 1024, H = 220;
  const cvs = document.createElement("canvas"); cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "rgba(4,8,16,0.92)"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#" + new THREE.Color(color).getHexString();
  ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.font = "800 96px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 12;
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.scale.set(96, 21, 1);
  s.userData.textLen = text.length;
  return s;
}

const labelSprites = [];
const telemetryRings = [];
const waypointMarkers = [];

// ---------- PLACE BUILDINGS, PADS, BRANCH TRACES ----------
DISTRICTS.forEach(d => {
  const x = d.pos[0], z = d.pos[2];

  // Branch trace from highway shoulder to building (skip spire, which sits on the highway)
  if (d.id !== "spire") {
    addBranchTrace(z, x, d.color);
  }

  // Solder/chip pad under the building
  const padRadius = d.id === "spire" ? 60 : 40;
  addCircuitPad(x, z, d.color, padRadius);
  checkpointPads.push({ id: d.id, x, z });

  // The building itself
  const mesh = builders[d.kind](d);
  mesh.position.set(x, 1.6, z);
  scene.add(mesh);

  // Floating label sprite (desktop only)
  if (!lowPower) {
    const label = makeLabelSprite(d.name, d.color);
    label.position.set(x, d.tall + 28, z);
    scene.add(label);
    labelSprites.push(label);
  }

  // Telemetry rings — slow orbital tori above each building
  const ringCount = lowPower ? 2 : 3;
  for (let i = 0; i < ringCount; i++) {
    const r = padRadius - 10 + i * 7;
    const tilt = (i - 1) * 0.32;
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.35, 6, 56),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.55 - i * 0.08 })
    );
    const liftY = d.tall + 14 + i * 9;
    tor.position.set(x, liftY, z);
    tor.rotation.x = Math.PI / 2 + tilt;
    tor.rotation.z = i * 0.7;
    scene.add(tor);
    telemetryRings.push({ mesh: tor, baseY: liftY, spin: 0.12 + i * 0.05 + (i % 2 ? -0.04 : 0.04), phase: Math.random() * Math.PI * 2 });
  }

  // Waypoint beacon over each non-spire building
  if (d.id !== "spire") {
    const beaconY = d.tall + 38;
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4, 0),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
    );
    beacon.position.set(x, beaconY, z);
    scene.add(beacon);
    const tether = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, beaconY - d.tall, 4, 1, true),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    tether.position.set(x, (beaconY + d.tall) / 2, z);
    scene.add(tether);
    waypointMarkers.push({ mesh: beacon, baseY: beaconY, phase: Math.random() * Math.PI * 2 });
  }
});

// ---------- ROADSIDE LAMP PYLONS ----------
// Tall glowing lamp pylons spaced along the highway shoulders so the
// camera always frames at least one structure plus the road on every
// section pose. Alternating sides + alternating cyan/red lamps so the
// path always reads as an electrified corridor, not empty space.
function addLampPylon(x, z, color) {
  const g = new THREE.Group();
  const H = 70;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.4, H, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a2436, metalness: 0.9, roughness: 0.25, emissive: color, emissiveIntensity: 0.45 })
  );
  post.position.y = H / 2;
  g.add(post);
  // Vertical lit strip up the post
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, H * 0.86, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.9, fog: false })
  );
  strip.position.set(0, H / 2, 1.6);
  g.add(strip);
  // Crown lamp
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(8, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.9, roughness: 0.25, emissive: color, emissiveIntensity: 1.4 })
  );
  crown.position.y = H + 0.8;
  g.add(crown);
  // Glowing halo above the crown
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 14, 14),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false })
  );
  halo.position.y = H + 3.2;
  g.add(halo);
  // Faint downward light cone (transparent box flanged out)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(10, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, fog: false, side: THREE.DoubleSide })
  );
  cone.position.y = H - 14;
  cone.rotation.x = Math.PI;
  g.add(cone);
  g.position.set(x, 0, z);
  scene.add(g);
}
const LAMP_SPACING = 110;
const LAMP_SHOULDER = HIGHWAY_HALF_WIDTH + 20;
for (let z = HIGHWAY_Z_START - 80; z > HIGHWAY_Z_END + 80; z -= LAMP_SPACING) {
  // Skip lamps that would land directly on a district pad
  const tooClose = DISTRICTS.some(d => Math.abs(d.pos[2] - z) < 80 && Math.abs(d.pos[0]) < 80);
  if (tooClose) continue;
  const side = Math.floor((HIGHWAY_Z_START - z) / LAMP_SPACING) % 2 === 0 ? -1 : 1;
  const lampColor = side < 0 ? 0x5cf2ff : 0xff5a3a;
  addLampPylon(side * LAMP_SHOULDER, z, lampColor);
}

// ---------- HERO FOREGROUND CIRCUITRY ----------
// Hero-only PCB elements close to the camera (z = 120..290) so the first
// viewport always reads as a circuit board, not as plain dark space, no
// matter where the camera waypoint lands. These are large, fog-immune, and
// bright enough to be visible around the hero content card.
function addHeroForeground() {
  // Big bright solder pad on the right shoulder — frames the card without
  // overlapping it. Sits just inside the visible right edge at hero zoom.
  const heroPadR = new THREE.Mesh(
    new THREE.CircleGeometry(34, 48),
    new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.85, fog: false })
  );
  heroPadR.rotation.x = -Math.PI / 2;
  heroPadR.position.set(180, ROAD_Y + 0.3, 200);
  scene.add(heroPadR);
  const heroPadRRing = new THREE.Mesh(
    new THREE.RingGeometry(36, 39, 64),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95, side: THREE.DoubleSide, fog: false })
  );
  heroPadRRing.rotation.x = -Math.PI / 2;
  heroPadRRing.position.set(180, ROAD_Y + 0.4, 200);
  scene.add(heroPadRRing);

  // Big cyan solder pad on the left shoulder
  const heroPadL = new THREE.Mesh(
    new THREE.CircleGeometry(28, 48),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.85, fog: false })
  );
  heroPadL.rotation.x = -Math.PI / 2;
  heroPadL.position.set(-180, ROAD_Y + 0.3, 240);
  scene.add(heroPadL);
  const heroPadLRing = new THREE.Mesh(
    new THREE.RingGeometry(30, 33, 64),
    new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, fog: false })
  );
  heroPadLRing.rotation.x = -Math.PI / 2;
  heroPadLRing.position.set(-180, ROAD_Y + 0.4, 240);
  scene.add(heroPadLRing);

  // Hero foreground branch traces from highway shoulders out to the pads.
  const heroTraceR = new THREE.Mesh(
    new THREE.BoxGeometry(124, 0.4, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95, fog: false })
  );
  heroTraceR.position.set(HIGHWAY_HALF_WIDTH + 62, ROAD_Y + 0.45, 200);
  scene.add(heroTraceR);
  const heroTraceL = new THREE.Mesh(
    new THREE.BoxGeometry(124, 0.4, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.95, fog: false })
  );
  heroTraceL.position.set(-HIGHWAY_HALF_WIDTH - 62, ROAD_Y + 0.45, 240);
  scene.add(heroTraceL);

  // Bright lane-marker pads on the highway in hero view (closer + larger
  // than the regular dashes) so the road clearly reads as a live trace.
  for (let i = 0; i < 5; i++) {
    const z = 280 - i * 28;
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false })
    );
    dash.position.set(0, ROAD_Y + 0.55, z);
    scene.add(dash);
  }

  // Hero-near energy column — short bright structure on the right, behind
  // the right pad, so a "building" reads beside the card without competing
  // with the Spire on the horizon.
  const colHeight = 86;
  const heroCol = new THREE.Mesh(
    new THREE.BoxGeometry(14, colHeight, 14),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.85, roughness: 0.25, emissive: 0xff3a3a, emissiveIntensity: 0.950 })
  );
  heroCol.position.set(180, colHeight / 2 + 1, 200);
  scene.add(heroCol);
  // Vertical cyan light strip up the front face
  const heroColStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, colHeight * 0.92, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95, fog: false })
  );
  heroColStrip.position.set(180, colHeight / 2 + 1, 207.2);
  scene.add(heroColStrip);
  // Window bands wrapping the column
  for (let i = 0; i < 4; i++) {
    const y = (i + 0.5) * (colHeight / 4);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(14.2, 0.6, 14.2),
      new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.85, fog: false })
    );
    band.position.set(180, y, 200);
    scene.add(band);
  }
  // Top beacon
  const heroColTip = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a, fog: false })
  );
  heroColTip.position.set(180, colHeight + 5, 200);
  scene.add(heroColTip);

  // Slimmer cyan pylon on the left
  const pylonH = 64;
  const heroPylon = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 5, pylonH, 12),
    new THREE.MeshStandardMaterial({ color: 0x223852, metalness: 0.85, roughness: 0.3, emissive: 0x5cf2ff, emissiveIntensity: 0.950 })
  );
  heroPylon.position.set(-180, pylonH / 2 + 1, 240);
  scene.add(heroPylon);
  const heroPylonStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, pylonH * 0.85, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, transparent: true, opacity: 0.95, fog: false })
  );
  heroPylonStrip.position.set(-180, pylonH / 2 + 1, 246);
  scene.add(heroPylonStrip);
  const heroPylonTip = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0x5cf2ff, fog: false })
  );
  heroPylonTip.position.set(-180, pylonH + 4, 240);
  scene.add(heroPylonTip);

  // Scattered hero-near solder dots on either side of the road for PCB read.
  for (let i = 0; i < 10; i++) {
    const sideSign = i % 2 === 0 ? -1 : 1;
    const x = sideSign * (HIGHWAY_HALF_WIDTH + 14 + Math.random() * 70);
    const z = 130 + Math.random() * 160;
    const via = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 14),
      new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xff5a3a : 0x5cf2ff, transparent: true, opacity: 0.95, fog: false })
    );
    via.rotation.x = -Math.PI / 2;
    via.position.set(x, ROAD_Y + 0.32, z);
    scene.add(via);
  }
}
addHeroForeground();

// ---------- ELECTRIC PACKETS DOWN THE HIGHWAY ----------
// Pulses that flow north-to-south down the main trace, plus side packets
// that branch off to each district pad. Reads as live electricity on a PCB.
const microGeo = new THREE.SphereGeometry(0.9, 8, 8);
const routeGeo = new THREE.SphereGeometry(1.6, 12, 12);
const commandGeo = new THREE.SphereGeometry(2.6, 14, 14);

const packets = [];

// Highway packets — travel straight down Z
const HIGHWAY_PACKETS = lowPower ? 90 : 220;
for (let i = 0; i < HIGHWAY_PACKETS; i++) {
  const cls = i % 7;
  let geo, mat;
  if (cls === 0) { geo = commandGeo; mat = new THREE.MeshBasicMaterial({ color: 0xff3a3a }); }
  else if (cls === 1 || cls === 2) { geo = routeGeo; mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
  else { geo = microGeo; mat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff }); }
  const p = new THREE.Mesh(geo, mat);
  // Two lanes — left of spine and right of spine, offset slightly
  const lane = (i % 2 === 0) ? -1 : 1;
  p.userData = {
    kind: "highway",
    lane,
    speed: cls === 0 ? 60 + Math.random() * 30 : 110 + Math.random() * 80,
    z: HIGHWAY_Z_START - Math.random() * HIGHWAY_LENGTH,
    isCmd: cls === 0,
  };
  scene.add(p);
  packets.push(p);
}

// Branch packets — short loops that travel from highway out to each district pad and back
const branchRoutes = DISTRICTS.filter(d => d.id !== "spire").map(d => ({
  z: d.pos[2],
  startX: 0,
  endX: d.pos[0] - Math.sign(d.pos[0]) * 50,
  color: d.color
}));
const BRANCH_PACKETS = lowPower ? 24 : 56;
for (let i = 0; i < BRANCH_PACKETS; i++) {
  const route = branchRoutes[i % branchRoutes.length];
  const p = new THREE.Mesh(routeGeo, new THREE.MeshBasicMaterial({ color: route.color }));
  p.userData = {
    kind: "branch",
    route,
    t: Math.random(),
    speed: 0.5 + Math.random() * 0.7,
  };
  scene.add(p);
  packets.push(p);
}

function updatePackets(dt) {
  for (const p of packets) {
    if (p.userData.kind === "highway") {
      p.userData.z -= p.userData.speed * dt;
      if (p.userData.z < HIGHWAY_Z_END) p.userData.z = HIGHWAY_Z_START;
      const lift = p.userData.isCmd ? 2.2 : 1.0;
      p.position.set(p.userData.lane * 1.6, ROAD_Y + lift, p.userData.z);
    } else {
      p.userData.t += dt * p.userData.speed;
      if (p.userData.t > 1) p.userData.t -= 1;
      const r = p.userData.route;
      const t = p.userData.t;
      // Bounce: 0..0.5 outbound, 0.5..1 return
      const lt = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
      const x = THREE.MathUtils.lerp(r.startX, r.endX, lt);
      p.position.set(x, ROAD_Y + 1.0, r.z);
    }
  }
}

// ---------- STARS ----------
const stars = new THREE.BufferGeometry(); const sp = [];
const STAR_COUNT = lowPower ? 700 : 1800;
for (let i = 0; i < STAR_COUNT; i++) sp.push((Math.random() - 0.5) * 5500, 80 + Math.random() * 1800, (Math.random() - 0.5) * 5500);
stars.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x88aaff, size: 1.5, transparent: true, opacity: 0.7 })));

// ---------- SCROLL CAMERA: CINEMATIC AERIAL TRAVEL ----------
// The viewer is carried in a cinematic aerial drone shot from the hero's
// wide pull-back through each checkpoint. Each pose frames the current
// building beside the electric circuit highway, with the road and the
// next checkpoint visible in the distance. Heights stay 90-180 so the
// road, rails, packets, AND the building always read on screen, never
// blank dark space.
function poseAt(id, opts = {}) {
  if (id === "hero") {
    return {
      pos: new THREE.Vector3(0, 320, 620),
      look: new THREE.Vector3(0, 40, -120),
    };
  }
  const d = DISTRICTS.find(x => x.id === id);
  // Place the camera up-and-behind on the OPPOSITE side of the highway
  // from the building, so the road wraps around between camera and
  // structure and the building reads framed by the rails.
  const side = d.pos[0] >= 0 ? -1 : 1;
  const dx = opts.dx ?? side * 150;
  const dy = opts.dy ?? 130;
  const dz = opts.dz ?? 200;
  const lookY = opts.lookY ?? Math.max(d.tall * 0.45, 30);
  return {
    pos:  new THREE.Vector3(d.pos[0] + dx, d.pos[1] + dy, d.pos[2] + dz),
    look: new THREE.Vector3(d.pos[0],      lookY,         d.pos[2] - 30),
  };
}

const KEYS = [
  poseAt("hero"),
  // Spire is on-axis (x=0), so we orbit out to the right and high to see
  // the full crown + the highway falling away toward the next checkpoints.
  poseAt("spire",       { dx:  170, dy: 200, dz: 260, lookY: 110 }),
  poseAt("foundry",     { dx:  240, dy: 140, dz: 180, lookY: 50 }),
  poseAt("voice",       { dx: -240, dy: 160, dz: 180, lookY: 70 }),
  poseAt("ops",         { dx:  250, dy: 170, dz: 200, lookY: 80 }),
  poseAt("revenue",     { dx: -240, dy: 140, dz: 180, lookY: 55 }),
  poseAt("content",     { dx:  240, dy: 140, dz: 180, lookY: 50 }),
  poseAt("integration", { dx: -240, dy: 160, dz: 180, lookY: 60 }),
  // Contact pull-back: high straight-on so the whole road retreats into
  // the distance behind the landing pad.
  poseAt("contact",     { dx:    0, dy: 180, dz: 260, lookY: 30 }),
];

const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.pos), false, "catmullrom", 0.25);
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.look), false, "catmullrom", 0.25);

// ---------- SCROLL HOOK ----------
const sections = Array.from(document.querySelectorAll(".sec"));
const progressFill = document.getElementById("progressFill");
const navLinks = Array.from(document.querySelectorAll(".hud-nav a"));
const scrollIndicator = document.querySelector(".scroll-indicator");

let scrollProgress = 0;
let targetProgress = 0;
function recomputeProgress() {
  const docH = document.documentElement.scrollHeight - window.innerHeight;
  targetProgress = docH > 0 ? Math.max(0, Math.min(1, window.scrollY / docH)) : 0;
  if (window.scrollY > 40) scrollIndicator?.classList.add("gone");
  else scrollIndicator?.classList.remove("gone");
}
window.addEventListener("scroll", recomputeProgress, { passive: true });
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  recomputeProgress();
});
recomputeProgress();

// Section reveal. Sections default to visible in CSS so any JS / observer
// failure cannot leave the page as empty dark space below the hero. We arm
// the fade-in only when IntersectionObserver is available, then immediately
// reveal whatever is already on screen. As a safety net, every section is
// force-revealed after 1.2s regardless of observer state, and any section
// crossed by the scroll position is revealed too.
const supportsIO = "IntersectionObserver" in window;
if (supportsIO) {
  sections.forEach(s => { if (!s.classList.contains("hero")) s.classList.add("armed"); });
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("active");
        const id = e.target.id;
        if (id) navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
      }
    }
  }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });
  sections.forEach(s => io.observe(s));
}
function revealAll() { sections.forEach(s => s.classList.add("active")); }
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

// ---------- AGENT WALL ----------
const wall = document.getElementById("agentWall");
if (wall) {
  wall.innerHTML = AGENT_SAMPLE.map(a => `<div class="a"><b>${a[0]}</b><span>${a[1]}</span></div>`).join("");
  const more = document.createElement("div");
  more.className = "agent-wall-more";
  more.innerHTML = `<span class="agent-wall-swipe">Swipe to browse roster</span> Plus <b>${270 - AGENT_SAMPLE.length}+</b> more.`;
  wall.parentNode.insertBefore(more, wall.nextSibling);
}

// ---------- MOBILE NAV TOGGLE ----------
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
  hudNav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && hudNav.classList.contains("open")) closeNav();
  });
  document.addEventListener("click", (e) => {
    if (!hudNav.classList.contains("open")) return;
    if (hudNav.contains(e.target) || hudToggle.contains(e.target)) return;
    closeNav();
  });
}

// ---------- LABEL EDGE + PANEL SAFETY ----------
const tmpProj = new THREE.Vector3();
const tmpView = new THREE.Vector3();
const EDGE_SAFE_MARGIN_PX = 48;
const PANEL_SAFE_MARGIN_PX = 18;
const panelEls = Array.from(document.querySelectorAll(".sec-inner"));
function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
function updateLabelEdgeSafety() {
  if (labelSprites.length === 0) return;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const halfW = vw * 0.5;
  const halfH = vh * 0.5;
  const panelRects = [];
  for (const el of panelEls) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    panelRects.push({
      left:   r.left   - PANEL_SAFE_MARGIN_PX,
      right:  r.right  + PANEL_SAFE_MARGIN_PX,
      top:    r.top    - PANEL_SAFE_MARGIN_PX,
      bottom: r.bottom + PANEL_SAFE_MARGIN_PX
    });
  }
  for (const s of labelSprites) {
    tmpView.copy(s.position).applyMatrix4(camera.matrixWorldInverse);
    if (tmpView.z >= 0) { s.visible = false; s.material.opacity = 0; continue; }
    tmpProj.copy(s.position).project(camera);
    if (tmpProj.z < -1 || tmpProj.z > 1) { s.visible = false; s.material.opacity = 0; continue; }
    const screenX = tmpProj.x * halfW + halfW;
    const screenY = -tmpProj.y * halfH + halfH;
    const camDist = camera.position.distanceTo(s.position);
    const pxPerWorld = vh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.max(camDist, 1));
    const panelHalfWidthPx = (s.scale.x * 0.5) * pxPerWorld;
    const textHalfWidthPx = (s.userData.textLen || 12) * 11 * 0.5;
    const halfWidthPx  = Math.max(panelHalfWidthPx, textHalfWidthPx);
    const halfHeightPx = Math.max((s.scale.y * 0.5) * pxPerWorld, 16);
    const leftEdge   = screenX - halfWidthPx;
    const rightEdge  = screenX + halfWidthPx;
    const topEdge    = screenY - halfHeightPx;
    const bottomEdge = screenY + halfHeightPx;
    const clipsEdge =
      leftEdge   < EDGE_SAFE_MARGIN_PX ||
      rightEdge  > vw - EDGE_SAFE_MARGIN_PX ||
      topEdge    < EDGE_SAFE_MARGIN_PX ||
      bottomEdge > vh - EDGE_SAFE_MARGIN_PX;
    let overlapsPanel = false;
    if (!clipsEdge && panelRects.length > 0) {
      const labelRect = { left: leftEdge, right: rightEdge, top: topEdge, bottom: bottomEdge };
      for (const pr of panelRects) {
        if (rectsOverlap(labelRect, pr)) { overlapsPanel = true; break; }
      }
    }
    const hide = clipsEdge || overlapsPanel;
    s.visible = !hide;
    s.material.opacity = hide ? 0 : 1;
  }
}

// ---------- LOOP ----------
const clock = new THREE.Clock();
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
let elapsed = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  scrollProgress += (targetProgress - scrollProgress) * 0.08;
  posCurve.getPointAt(scrollProgress, tmpPos);
  lookCurve.getPointAt(scrollProgress, tmpLook);
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);

  progressFill.style.height = (scrollProgress * 100).toFixed(1) + "%";

  // Pulsing pad rings — circuit pads "breathing" with current.
  for (const n of energyNodes) {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.4 + n.basePhase);
    const s = 1 + pulse * 0.10;
    n.ring.scale.set(s, s, 1);
    n.ring.material.opacity = 0.55 + pulse * 0.4;
  }

  // Telemetry rings — slow rotation + slight bob.
  for (const t of telemetryRings) {
    t.mesh.rotation.z += dt * t.spin;
    t.mesh.position.y = t.baseY + Math.sin(elapsed * 0.9 + t.phase) * 1.6;
  }

  // Waypoint beacons — float and softly spin.
  for (const w of waypointMarkers) {
    w.mesh.position.y = w.baseY + Math.sin(elapsed * 1.4 + w.phase) * 2.2;
    w.mesh.rotation.y += dt * 0.9;
    w.mesh.rotation.x += dt * 0.4;
  }

  updatePackets(dt);
  updateLabelEdgeSafety();
  renderer.render(scene, camera);
  window.__brainstormRenderFrames++;
  if (window.__brainstormRenderFrames === 1) {
    setWebGLStatus("running");
    console.info("[brainstorm] First WebGL frame painted");
  }
  requestAnimationFrame(tick);
}
tick();
