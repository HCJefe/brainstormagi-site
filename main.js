import * as THREE from "three";
import { DISTRICTS, AGENT_SAMPLE } from "./districts.js";

// ---------- SCENE ----------
const isMobile = window.matchMedia("(max-width: 640px)").matches;
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = isMobile || isCoarsePointer;

const canvas = document.getElementById("scene");

// Probe WebGL early. If unavailable, hand off to the Canvas2D fallback so
// the route is still painted instead of leaving a black canvas.
function escalateToFallback(reason) {
  document.documentElement.dataset.sceneEngine = reason || "fallback";
  document.documentElement.classList.add("no-webgl");
  if (typeof window.__brainstormStartFallback === "function") {
    try { window.__brainstormStartFallback(); } catch (_) {}
  }
}

const probe = document.createElement("canvas");
const probeGl = probe.getContext("webgl2") || probe.getContext("webgl") || probe.getContext("experimental-webgl");
if (!probeGl) {
  escalateToFallback("no-webgl-context");
  throw new Error("WebGL unavailable");
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "high-performance" });
} catch (err) {
  escalateToFallback("renderer-throw");
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = lowPower ? 1.35 : 1.3;
canvas.addEventListener("webglcontextlost", function (e) {
  e.preventDefault();
  escalateToFallback("context-lost");
}, false);

document.documentElement.dataset.sceneEngine = "webgl";
window.__brainstormRenderFrames = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1430);
// Much lighter fog so far buildings and the road remain visible from every
// section pose. With the previous density (0.00038) the scene faded to black
// past the hero so every section read as empty dark space. We keep just
// enough atmospheric haze to give depth without erasing the journey.
scene.fog = new THREE.FogExp2(0x0a1430, lowPower ? 0.00010 : 0.00014);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 8000);
// Hero camera sits lower and closer so the circuit highway enters the
// foreground and the Spire silhouette plus Foundry tower read above the fold.
camera.position.set(28, 110, 360);
camera.lookAt(0, 38, -280);

scene.add(new THREE.AmbientLight(0x6276a0, lowPower ? 1.4 : 1.3));
const key = new THREE.DirectionalLight(0xffe0d0, lowPower ? 1.6 : 1.45); key.position.set(300, 500, 300); scene.add(key);
const rim = new THREE.DirectionalLight(0xff5566, lowPower ? 1.15 : 1.0); rim.position.set(-400, 240, -600); scene.add(rim);
const cyanLight = new THREE.DirectionalLight(0x6ff5ff, lowPower ? 1.2 : 1.05); cyanLight.position.set(0, 240, -400); scene.add(cyanLight);
const fillLight = new THREE.DirectionalLight(0xaad0ff, 0.7); fillLight.position.set(120, 300, 200); scene.add(fillLight);

// ---------- CIRCUIT-BOARD GROUND ----------
// The ground is a long PCB stretching from the hero (Z=+300) down to past
// the contact pad (Z<-1800). It reads as a printed circuit board with an
// etched copper-and-cyan trace highway running down its spine.
const BOARD_W = 1800;
const BOARD_L = 2600;
const BOARD_OFFSET_Z = -700;  // shift board so it covers the full highway

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_W, BOARD_L),
  new THREE.MeshStandardMaterial({ color: 0x162a48, roughness: 0.7, metalness: 0.45, emissive: 0x162844, emissiveIntensity: 1.200 })
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
// A snaking PCB trace that twists from district to district. The route
// is built from a Catmull-Rom curve that passes through each checkpoint
// (with strong lateral swings) plus an entry waypoint behind the hero
// and an exit waypoint past the Contact pad. Road geometry, rails, spine,
// dashes, and packets all follow this single curve so the camera always
// has a real road beneath it as it banks around buildings.
const HIGHWAY_HALF_WIDTH = 30;
const ROAD_Y = 0.15;
const HIGHWAY_Z_START =  300;
const HIGHWAY_Z_END   = -1900;
const HIGHWAY_LENGTH = HIGHWAY_Z_START - HIGHWAY_Z_END;
const HIGHWAY_X = 0;

// Build the route from the district list, with tighter S-curves between
// each pair so the road doesn't read as a flat trace.
const ROUTE_PTS = [];
ROUTE_PTS.push(new THREE.Vector3(0, 0, HIGHWAY_Z_START));
for (let i = 0; i < DISTRICTS.length; i++) {
  const d = DISTRICTS[i];
  const next = DISTRICTS[i + 1];
  // Drop the camera target a little before each district so the road
  // arcs in toward the building instead of clipping straight through it.
  ROUTE_PTS.push(new THREE.Vector3(d.pos[0] * 0.55, 0, d.pos[2] + 80));
  ROUTE_PTS.push(new THREE.Vector3(d.pos[0] * 0.92, 0, d.pos[2]));
  if (next) {
    // Mid-segment overshoot toward the opposite shoulder so the route
    // really snakes between buildings instead of a polite zig-zag.
    const overshootX = -Math.sign(d.pos[0]) * 90;
    const midZ = (d.pos[2] + next.pos[2]) * 0.5;
    ROUTE_PTS.push(new THREE.Vector3(overshootX, 0, midZ + 30));
  }
}
ROUTE_PTS.push(new THREE.Vector3(0, 0, HIGHWAY_Z_END));

const routeCurve = new THREE.CatmullRomCurve3(ROUTE_PTS, false, "catmullrom", 0.45);
const HIGHWAY_LENGTH_APPROX = routeCurve.getLength();
const ROUTE_SEGMENTS = lowPower ? 320 : 600;

// --- Road core: extruded ribbon hugging the curve at ground level. ---
function ribbonGeometry(curve, segments, halfWidth, yOffset) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent);
    normal.copy(tangent).cross(up).normalize();
    const left = new THREE.Vector3().copy(p).addScaledVector(normal, -halfWidth);
    const right = new THREE.Vector3().copy(p).addScaledVector(normal, halfWidth);
    left.y = yOffset;
    right.y = yOffset;
    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);
    uvs.push(0, t * 200);
    uvs.push(1, t * 200);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2);
      indices.push(a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

const roadCore = new THREE.Mesh(
  ribbonGeometry(routeCurve, ROUTE_SEGMENTS, HIGHWAY_HALF_WIDTH, ROAD_Y),
  new THREE.MeshStandardMaterial({ color: 0x1f3a64, roughness: 0.45, metalness: 0.75, emissive: 0x1c3460, emissiveIntensity: 1.250, fog: false, side: THREE.DoubleSide })
);
scene.add(roadCore);

// Copper-tone inner band — slightly narrower, riding just above the core.
const copperBand = new THREE.Mesh(
  ribbonGeometry(routeCurve, ROUTE_SEGMENTS, HIGHWAY_HALF_WIDTH * 0.7, ROAD_Y + 0.05),
  new THREE.MeshBasicMaterial({ color: 0xc04428, transparent: true, opacity: 0.55, fog: false, side: THREE.DoubleSide })
);
scene.add(copperBand);

// --- Glowing rails along both edges of the curve. ---
function railGeometry(curve, segments, lateralOffset, height, halfThickness) {
  const positions = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    curve.getTangentAt(t, tangent);
    normal.copy(tangent).cross(up).normalize();
    const cx = p.x + normal.x * lateralOffset;
    const cz = p.z + normal.z * lateralOffset;
    // Build a thin box cross-section: 4 verts (top/bot, inner/outer)
    positions.push(cx + normal.x * -halfThickness, ROAD_Y + height - 0.6, cz + normal.z * -halfThickness);
    positions.push(cx + normal.x *  halfThickness, ROAD_Y + height - 0.6, cz + normal.z *  halfThickness);
    positions.push(cx + normal.x *  halfThickness, ROAD_Y + height + 0.6, cz + normal.z *  halfThickness);
    positions.push(cx + normal.x * -halfThickness, ROAD_Y + height + 0.6, cz + normal.z * -halfThickness);
    if (i < segments) {
      const a = i * 4;
      const b = (i + 1) * 4;
      // Outer + inner side faces
      indices.push(a, a + 3, b + 3); indices.push(a, b + 3, b);
      indices.push(a + 1, b + 1, b + 2); indices.push(a + 1, b + 2, a + 2);
      // Top
      indices.push(a + 3, a + 2, b + 2); indices.push(a + 3, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function addRail(lateralOffset, color, opacity) {
  const rail = new THREE.Mesh(
    railGeometry(routeCurve, ROUTE_SEGMENTS, lateralOffset, 0.5, 0.8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, fog: false, side: THREE.DoubleSide })
  );
  scene.add(rail);
}
addRail(-HIGHWAY_HALF_WIDTH,        0x8cf8ff, 1.0);
addRail( HIGHWAY_HALF_WIDTH,        0xff5a5a, 0.95);
addRail(-HIGHWAY_HALF_WIDTH * 0.55, 0x4abad0, 0.85);
addRail( HIGHWAY_HALF_WIDTH * 0.55, 0xc83838, 0.85);

// Center current spine — glowing white live wire that follows the curve.
const spine = new THREE.Mesh(
  new THREE.TubeGeometry(routeCurve, ROUTE_SEGMENTS, 0.45, 8, false),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false })
);
spine.position.y += 0.3;
scene.add(spine);

// Dashed lane markers along the spine — short emissive copper-red dashes
// placed by sampling the curve at fixed arc-length steps.
const DASH_SPACING = 22;
const dashCount = Math.floor(HIGHWAY_LENGTH_APPROX / DASH_SPACING);
const _dashTangent = new THREE.Vector3();
for (let i = 0; i < dashCount; i++) {
  const t = (i + 0.5) / dashCount;
  const p = routeCurve.getPointAt(t);
  routeCurve.getTangentAt(t, _dashTangent);
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.4, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 1.0, fog: false })
  );
  dash.position.set(p.x, ROAD_Y + 0.4, p.z);
  dash.lookAt(p.x + _dashTangent.x, ROAD_Y + 0.4, p.z + _dashTangent.z);
  scene.add(dash);
}

// ---------- PCB MICRO-TRACES + SOLDER PADS ----------
// Perpendicular micro-traces branching off the highway, with small circular
// solder pads at their ends. Sells the "circuit board" reading from above.
const _microTangent = new THREE.Vector3();
const _microNormal = new THREE.Vector3();
const _microUp = new THREE.Vector3(0, 1, 0);
function addMicroTrace(t, side, length, color = 0x5cf2ff) {
  const p = routeCurve.getPointAt(t);
  routeCurve.getTangentAt(t, _microTangent);
  _microNormal.copy(_microTangent).cross(_microUp).normalize();
  const sx = p.x + _microNormal.x * side * (HIGHWAY_HALF_WIDTH + length / 2);
  const sz = p.z + _microNormal.z * side * (HIGHWAY_HALF_WIDTH + length / 2);
  const trace = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.3, 0.7),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, fog: false })
  );
  trace.position.set(sx, ROAD_Y + 0.18, sz);
  trace.lookAt(sx + _microNormal.x * side, ROAD_Y + 0.18, sz + _microNormal.z * side);
  scene.add(trace);
  // Solder pad at the tip
  const tipX = p.x + _microNormal.x * side * (HIGHWAY_HALF_WIDTH + length);
  const tipZ = p.z + _microNormal.z * side * (HIGHWAY_HALF_WIDTH + length);
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 18),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(tipX, ROAD_Y + 0.22, tipZ);
  scene.add(pad);
  // Tiny via dot at the junction
  const viaX = p.x + _microNormal.x * side * HIGHWAY_HALF_WIDTH;
  const viaZ = p.z + _microNormal.z * side * HIGHWAY_HALF_WIDTH;
  const via = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, fog: false })
  );
  via.rotation.x = -Math.PI / 2;
  via.position.set(viaX, ROAD_Y + 0.2, viaZ);
  scene.add(via);
}
const MICRO_TRACE_COUNT = lowPower ? 48 : 110;
for (let i = 0; i < MICRO_TRACE_COUNT; i++) {
  const t = (i + 0.5) / MICRO_TRACE_COUNT;
  const side = i % 2 === 0 ? -1 : 1;
  const len = 18 + Math.random() * 36;
  const col = i % 5 === 0 ? 0xff5a3a : 0x5cf2ff;
  addMicroTrace(t, side, len, col);
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

// Find the point on the snaking highway closest to a given world XZ.
// Used to anchor branch traces at the actual road shoulder rather than a
// straight-axis approximation that would float in space when the road
// twists laterally.
function nearestRoutePoint(targetX, targetZ) {
  let best = 0;
  let bestD = Infinity;
  const sample = 220;
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= sample; i++) {
    const t = i / sample;
    routeCurve.getPointAt(t, tmp);
    const dx = tmp.x - targetX;
    const dz = tmp.z - targetZ;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) { bestD = d2; best = t; }
  }
  return best;
}

function addBranchTrace(targetX, targetZ, color) {
  const t = nearestRoutePoint(targetX, targetZ);
  const anchor = routeCurve.getPointAt(t);
  // Side normal (perpendicular to tangent, in XZ plane)
  const tangent = new THREE.Vector3();
  routeCurve.getTangentAt(t, tangent);
  const normal = new THREE.Vector3().copy(tangent).cross(new THREE.Vector3(0, 1, 0)).normalize();
  // Choose which side of the road points toward the target
  const dirX = targetX - anchor.x;
  const dirZ = targetZ - anchor.z;
  const sideSign = (dirX * normal.x + dirZ * normal.z) >= 0 ? 1 : -1;
  const startX = anchor.x + normal.x * sideSign * HIGHWAY_HALF_WIDTH;
  const startZ = anchor.z + normal.z * sideSign * HIGHWAY_HALF_WIDTH;
  // End just outside the building's solder pad
  const padOffset = 60;
  const endX = targetX - Math.sign(dirX || 1) * Math.min(padOffset, Math.abs(dirX));
  const endZ = targetZ - Math.sign(dirZ || 0.001) * Math.min(20, Math.abs(dirZ));
  const dx = endX - startX, dz = endZ - startZ;
  const length = Math.sqrt(dx * dx + dz * dz);
  const cx = (startX + endX) / 2;
  const cz = (startZ + endZ) / 2;
  const angle = Math.atan2(dz, dx);
  // Wide branch trace plane
  const branch = new THREE.Mesh(
    new THREE.PlaneGeometry(length, 12),
    new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.5, metalness: 0.55 })
  );
  branch.rotation.x = -Math.PI / 2;
  branch.rotation.z = -angle;
  branch.position.set(cx, ROAD_Y + 0.04, cz);
  scene.add(branch);
  // Twin glowing edge traces
  for (const sign of [-1, 1]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(length, 0.6, 0.7),
      new THREE.MeshBasicMaterial({ color: sign < 0 ? 0x5cf2ff : color, transparent: true, opacity: 0.9 })
    );
    edge.position.set(cx + Math.sin(angle) * sign * 6, ROAD_Y + 0.4, cz - Math.cos(angle) * sign * 6);
    edge.rotation.y = -angle;
    scene.add(edge);
  }
  // Center white spine
  const bspine = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.3, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
  );
  bspine.position.set(cx, ROAD_Y + 0.3, cz);
  bspine.rotation.y = -angle;
  scene.add(bspine);
  return { startX, endX, startZ, endZ };
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
    addBranchTrace(x, z, d.color);
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

// Highway packets — travel along the snaking route curve
const HIGHWAY_PACKETS = lowPower ? 90 : 220;
for (let i = 0; i < HIGHWAY_PACKETS; i++) {
  const cls = i % 7;
  let geo, mat;
  if (cls === 0) { geo = commandGeo; mat = new THREE.MeshBasicMaterial({ color: 0xff3a3a }); }
  else if (cls === 1 || cls === 2) { geo = routeGeo; mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); }
  else { geo = microGeo; mat = new THREE.MeshBasicMaterial({ color: 0x9ff8ff }); }
  const p = new THREE.Mesh(geo, mat);
  // Two lanes — left of spine and right of spine, offset along the curve normal
  const lane = (i % 2 === 0) ? -1 : 1;
  p.userData = {
    kind: "highway",
    lane,
    // tSpeed is fraction of curve traversed per second
    tSpeed: cls === 0 ? 0.025 + Math.random() * 0.015 : 0.05 + Math.random() * 0.04,
    t: Math.random(),
    isCmd: cls === 0,
  };
  scene.add(p);
  packets.push(p);
}

// Branch packets — short loops that travel from highway out to each district pad and back
const branchRoutes = DISTRICTS.filter(d => d.id !== "spire").map(d => {
  const t = nearestRoutePoint(d.pos[0], d.pos[2]);
  const a = routeCurve.getPointAt(t);
  return {
    startX: a.x, startZ: a.z,
    endX: d.pos[0] - Math.sign(d.pos[0]) * 50,
    endZ: d.pos[2],
    color: d.color
  };
});
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

const _packetTangent = new THREE.Vector3();
const _packetNormal = new THREE.Vector3();
const _packetUp = new THREE.Vector3(0, 1, 0);
function updatePackets(dt) {
  for (const p of packets) {
    if (p.userData.kind === "highway") {
      p.userData.t += p.userData.tSpeed * dt;
      if (p.userData.t > 1) p.userData.t -= 1;
      const t = p.userData.t;
      const point = routeCurve.getPointAt(t);
      routeCurve.getTangentAt(t, _packetTangent);
      _packetNormal.copy(_packetTangent).cross(_packetUp).normalize();
      const lift = p.userData.isCmd ? 2.2 : 1.0;
      p.position.set(
        point.x + _packetNormal.x * p.userData.lane * 1.8,
        ROAD_Y + lift,
        point.z + _packetNormal.z * p.userData.lane * 1.8
      );
    } else {
      p.userData.t += dt * p.userData.speed;
      if (p.userData.t > 1) p.userData.t -= 1;
      const r = p.userData.route;
      const t = p.userData.t;
      const lt = t < 0.5 ? (t / 0.5) : (1 - (t - 0.5) / 0.5);
      const x = THREE.MathUtils.lerp(r.startX, r.endX, lt);
      const z = THREE.MathUtils.lerp(r.startZ, r.endZ, lt);
      p.position.set(x, ROAD_Y + 1.0, z);
    }
  }
}

// ---------- STARS ----------
const stars = new THREE.BufferGeometry(); const sp = [];
const STAR_COUNT = lowPower ? 700 : 1800;
for (let i = 0; i < STAR_COUNT; i++) sp.push((Math.random() - 0.5) * 5500, 80 + Math.random() * 1800, (Math.random() - 0.5) * 5500);
stars.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x88aaff, size: 1.5, transparent: true, opacity: 0.7 })));

// ---------- SCROLL CAMERA: BANK + TWIST ALONG THE CIRCUIT HIGHWAY ----------
// The viewer rides a low cinematic drone above the snaking route. For each
// district the camera lifts to an aerial angle, swings to the opposite
// shoulder of the road, and looks at the building with the road continuation
// in frame. Because the route curve itself bends from district to district,
// the camera path inherits real banking and twisting between waypoints.
const _poseTangent = new THREE.Vector3();
const _poseNormal = new THREE.Vector3();
const _poseUp = new THREE.Vector3(0, 1, 0);

function poseAt(id, opts) {
  if (id === "hero") {
    return {
      pos: new THREE.Vector3(38, 130, 380),
      look: new THREE.Vector3(0, 30, -260),
    };
  }
  const d = DISTRICTS.find(x => x.id === id);
  const t = nearestRoutePoint(d.pos[0], d.pos[2]);
  // Place the camera slightly behind this t on the curve.
  const behindT = Math.max(0, t - (opts.behindT ?? 0.045));
  const aheadT  = Math.min(1, t + (opts.aheadT  ?? 0.040));
  const camAnchor = routeCurve.getPointAt(behindT);
  const lookAnchor = routeCurve.getPointAt(aheadT);
  routeCurve.getTangentAt(behindT, _poseTangent);
  _poseNormal.copy(_poseTangent).cross(_poseUp).normalize();
  // Push the camera laterally to the opposite side of the building for a
  // dramatic three-quarter view.
  const dirX = d.pos[0] - camAnchor.x;
  const dirZ = d.pos[2] - camAnchor.z;
  const buildingSide = (dirX * _poseNormal.x + dirZ * _poseNormal.z) >= 0 ? 1 : -1;
  const camLateralSign = -buildingSide;
  const lateral = opts.lateral ?? 95;
  const height = opts.height ?? 95;
  const camPos = new THREE.Vector3(
    camAnchor.x + _poseNormal.x * camLateralSign * lateral,
    height,
    camAnchor.z + _poseNormal.z * camLateralSign * lateral
  );
  // Look target: blend between the road-ahead point and the building.
  const blend = opts.buildingBias ?? 0.55;
  const lookY = opts.lookY ?? 32;
  const look = new THREE.Vector3(
    THREE.MathUtils.lerp(lookAnchor.x, d.pos[0], blend),
    lookY,
    THREE.MathUtils.lerp(lookAnchor.z, d.pos[2], blend)
  );
  return { pos: camPos, look };
}

const KEYS = [
  poseAt("hero"),
  poseAt("spire",       { lateral: 110, height: 150, behindT: 0.025, aheadT: 0.060, lookY: 70, buildingBias: 0.45 }),
  poseAt("foundry",     { lateral:  95, height:  85, behindT: 0.045, aheadT: 0.040, lookY: 30, buildingBias: 0.60 }),
  poseAt("voice",       { lateral: 105, height: 100, behindT: 0.050, aheadT: 0.040, lookY: 45, buildingBias: 0.55 }),
  poseAt("ops",         { lateral: 110, height: 110, behindT: 0.050, aheadT: 0.045, lookY: 50, buildingBias: 0.55 }),
  poseAt("revenue",     { lateral: 100, height:  90, behindT: 0.045, aheadT: 0.040, lookY: 32, buildingBias: 0.60 }),
  poseAt("content",     { lateral: 105, height:  85, behindT: 0.045, aheadT: 0.040, lookY: 28, buildingBias: 0.60 }),
  poseAt("integration", { lateral: 105, height:  95, behindT: 0.050, aheadT: 0.045, lookY: 38, buildingBias: 0.55 }),
  poseAt("contact",     { lateral:   0, height: 110, behindT: 0.040, aheadT: 0.020, lookY: 18, buildingBias: 0.40 }),
];

const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.pos), false, "catmullrom", 0.35);
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.look), false, "catmullrom", 0.35);

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
const tmpAhead = new THREE.Vector3();
let elapsed = 0;
let bankSmooth = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  scrollProgress += (targetProgress - scrollProgress) * 0.08;
  posCurve.getPointAt(scrollProgress, tmpPos);
  lookCurve.getPointAt(scrollProgress, tmpLook);
  // Subtle hover bob so the camera reads as a flying drone, not a stuck sled.
  const bob = Math.sin(elapsed * 0.9) * 1.6 + Math.sin(elapsed * 2.3) * 0.6;
  camera.position.set(tmpPos.x, tmpPos.y + bob, tmpPos.z);
  camera.lookAt(tmpLook);
  // Bank the camera into turns. We compute lateral curvature of the camera
  // path by sampling slightly ahead and projecting onto the camera's right
  // axis, then roll proportionally so corners feel like flight, not a slide.
  const tAhead = Math.min(1, scrollProgress + 0.012);
  posCurve.getPointAt(tAhead, tmpAhead);
  const dx = tmpAhead.x - tmpPos.x;
  const dz = tmpAhead.z - tmpPos.z;
  // Cross with current forward (tmpLook - tmpPos) to estimate sidewise drift
  const fx = tmpLook.x - tmpPos.x;
  const fz = tmpLook.z - tmpPos.z;
  const cross = fx * dz - fz * dx;
  const targetBank = THREE.MathUtils.clamp(cross * 0.0009, -0.18, 0.18);
  bankSmooth += (targetBank - bankSmooth) * Math.min(1, dt * 6);
  camera.rotation.z += bankSmooth;

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
  window.__brainstormRenderFrames = (window.__brainstormRenderFrames || 0) + 1;
  requestAnimationFrame(tick);
}
tick();
