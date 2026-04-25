import * as THREE from "three";
import { DISTRICTS, AGENT_SAMPLE } from "./districts.js";

// ---------- SCENE ----------
const isMobile = window.matchMedia("(max-width: 640px)").matches;
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = isMobile || isCoarsePointer;

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = lowPower ? 0.85 : 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.FogExp2(0x04060a, 0.0016);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 400, 600);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x334466, 0.5));
const key = new THREE.DirectionalLight(0xffd0c0, 0.7); key.position.set(300, 400, 200); scene.add(key);
const rim = new THREE.DirectionalLight(0xff3344, 0.5); rim.position.set(-300, 200, -400); scene.add(rim);
const cyanLight = new THREE.DirectionalLight(0x4ff3ff, 0.35); cyanLight.position.set(0, 200, 400); scene.add(cyanLight);

// ---------- CIRCUIT BOARD FLOOR ----------
const BOARD = 1800;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD, BOARD),
  new THREE.MeshStandardMaterial({ color: 0x040810, roughness: 0.85, metalness: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const gridFine = new THREE.GridHelper(BOARD, 180, 0x0e1a2c, 0x070d18);
gridFine.material.transparent = true; gridFine.material.opacity = 0.35; scene.add(gridFine);
const gridCoarse = new THREE.GridHelper(BOARD, 22, 0xff2a2a, 0x4a0c0c);
gridCoarse.material.transparent = true; gridCoarse.material.opacity = 0.42; gridCoarse.position.y = 0.02; scene.add(gridCoarse);

// ---------- ELECTRIFIED ROAD ----------
// Replace simple traces with a multi-layer "road":
//   - dark asphalt strip (the road surface)
//   - twin neon edge lines (cyan/red), the electrified rails
//   - a glowing center spine (pulses of current)
//   - dashed lane markers
//   - energy nodes at corners and endpoints
const ROAD_HALF_WIDTH = 7;          // road width = 14 world units
const ROAD_Y = 0.12;                // slightly above floor to avoid z-fighting
const RAIL_OFFSET = ROAD_HALF_WIDTH; // rails sit at the edges
const ROAD_EDGE_COLOR = 0x5cf2ff;   // electric cyan rails — the "electrified" structure
const energyNodes = [];             // pulsing markers at corners/endpoints

function addRoadSegment(ax, az, bx, bz, color) {
  // axis-aligned segment from (ax,az) to (bx,bz) — exactly one of x/z changes
  const horizontal = Math.abs(bx - ax) > Math.abs(bz - az);
  const length = horizontal ? Math.abs(bx - ax) : Math.abs(bz - az);
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;

  // 1. Asphalt strip
  const widthX = horizontal ? length : ROAD_HALF_WIDTH * 2;
  const widthZ = horizontal ? ROAD_HALF_WIDTH * 2 : length;
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(widthX, widthZ),
    new THREE.MeshStandardMaterial({ color: 0x0a121e, roughness: 0.65, metalness: 0.35 })
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(cx, ROAD_Y, cz);
  scene.add(asphalt);

  // 2. Twin electrified rails — cyan core, brand-red secondary (cross district color)
  const railColors = [ROAD_EDGE_COLOR, color];
  for (let r = 0; r < 2; r++) {
    const rcol = railColors[r];
    // Use thin emissive boxes for the rails so they catch the eye
    const rw = horizontal ? length : 0.8;
    const rd = horizontal ? 0.8 : length;
    for (const sign of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(rw, 0.6, rd),
        new THREE.MeshBasicMaterial({ color: rcol, transparent: true, opacity: r === 0 ? 0.9 : 0.6 })
      );
      const ox = horizontal ? 0 : sign * (RAIL_OFFSET - r * 1.2);
      const oz = horizontal ? sign * (RAIL_OFFSET - r * 1.2) : 0;
      rail.position.set(cx + ox, ROAD_Y + 0.3 + r * 0.05, cz + oz);
      scene.add(rail);
    }
  }

  // 3. Center spine — solid emissive line (white/red mix) — the live wire
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(horizontal ? length : 0.5, 0.4, horizontal ? 0.5 : length),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
  );
  spine.position.set(cx, ROAD_Y + 0.2, cz);
  scene.add(spine);

  // 4. Dashed lane markers — short emissive dashes alternating along the spine
  const dashCount = Math.floor(length / 14);
  for (let i = 0; i < dashCount; i++) {
    const t = (i + 0.5) / dashCount;
    const dx = ax + (bx - ax) * t;
    const dz = az + (bz - az) * t;
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(horizontal ? 5 : 0.7, 0.3, horizontal ? 0.7 : 5),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.85 })
    );
    dash.position.set(dx, ROAD_Y + 0.35, dz);
    scene.add(dash);
  }
}

function addEnergyNode(x, z, color, size = 6) {
  // A glowing pad with a pulsing ring — placed at corners and endpoints
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(size, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(x, ROAD_Y + 0.4, z);
  scene.add(pad);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(size + 1, size + 1.6, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, ROAD_Y + 0.5, z);
  scene.add(ring);

  // Vertical light shaft at the node — adds a "data uplink" feel
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 36, 8, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  shaft.position.set(x, 18, z);
  scene.add(shaft);

  energyNodes.push({ ring, baseR: size + 1, baseR2: size + 1.6, phase: Math.random() * Math.PI * 2 });
}

// Build the road network: spire (0,0) -> each district, L-shaped, with corner nodes
const roadPaths = []; // for packet routing: each entry is array of points
DISTRICTS.filter(d => d.id !== "spire").forEach(d => {
  const ax = 0, az = 0;
  const bx = d.pos[0], bz = d.pos[2];
  const cornerX = bx, cornerZ = az; // L-shape: go x first, then z
  // Avoid zero-length segments when district is on an axis
  if (Math.abs(bx - ax) > 1) addRoadSegment(ax, az, cornerX, cornerZ, d.color);
  if (Math.abs(bz - az) > 1) addRoadSegment(cornerX, cornerZ, bx, bz, d.color);
  // Energy nodes at corner and endpoint
  addEnergyNode(cornerX, cornerZ, d.color, 5);
  addEnergyNode(bx, bz, d.color, 9);

  roadPaths.push({
    color: d.color,
    points: [
      new THREE.Vector3(ax, ROAD_Y + 0.6, az),
      new THREE.Vector3(cornerX, ROAD_Y + 0.6, cornerZ),
      new THREE.Vector3(bx, ROAD_Y + 0.6, bz)
    ]
  });
});
// Central hub node at origin (the spire)
addEnergyNode(0, 0, 0xff2a2a, 12);

// ---------- DATA PULSES (electric current flowing along the roads) ----------
// Brighter, larger packets that visually read as electric current
const packetGeo = new THREE.SphereGeometry(1.4, 10, 10);
const packetMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const packets = [];
const PACKET_COUNT = lowPower ? 90 : 240;
for (let i = 0; i < PACKET_COUNT; i++) {
  const route = roadPaths[i % roadPaths.length];
  // Mix white-hot and tinted packets so the current reads as electricity, not just lights
  const tinted = i % 3 === 0;
  const mat = tinted
    ? new THREE.MeshBasicMaterial({ color: route.color })
    : packetMatWhite;
  const p = new THREE.Mesh(packetGeo, mat);
  p.userData = {
    route,
    t: Math.random(),
    speed: 0.07 + Math.random() * 0.13
  };
  scene.add(p);
  packets.push(p);
}
function updatePackets(dt) {
  for (const p of packets) {
    p.userData.t += dt * p.userData.speed;
    if (p.userData.t > 1) p.userData.t = 0;
    const t = p.userData.t;
    const pts = p.userData.route.points;
    // Two segments per route: 0..0.5 = pts[0]->pts[1], 0.5..1 = pts[1]->pts[2]
    let from, to, lt;
    if (t < 0.5) { from = pts[0]; to = pts[1]; lt = t / 0.5; }
    else         { from = pts[1]; to = pts[2]; lt = (t - 0.5) / 0.5; }
    p.position.set(
      THREE.MathUtils.lerp(from.x, to.x, lt),
      ROAD_Y + 0.7,
      THREE.MathUtils.lerp(from.z, to.z, lt)
    );
  }
}

// ---------- BUILDINGS ----------
function makeTower(d) {
  const g = new THREE.Group(); const count = d.kind === "plaza" ? 6 : d.kind === "chip" ? 4 : 3; const col = new THREE.Color(d.color);
  for (let i = 0; i < count; i++) {
    const w = 10 + Math.random() * 10, h = d.tall * (0.5 + Math.random() * 0.8);
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.5, metalness: 0.6, emissive: col, emissiveIntensity: 0.12 }));
    box.position.set((Math.random() - 0.5) * 60, h / 2, (Math.random() - 0.5) * 60); g.add(box);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 1.2, w * 0.6), new THREE.MeshBasicMaterial({ color: d.color }));
    cap.position.set(box.position.x, h + 0.6, box.position.z); g.add(cap);
    const stripes = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, h * 0.9, 0.2), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35 }));
    stripes.position.set(box.position.x, h / 2, box.position.z + w / 2 + 0.1); g.add(stripes);
  }
  return g;
}
function makeAntenna(d) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 14, d.tall, 6), new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: new THREE.Color(d.color), emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.4 }));
  cone.position.y = d.tall / 2; g.add(cone);
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(10 + i * 4, 0.25, 8, 48), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.55 - i * 0.1 }));
    r.rotation.x = Math.PI / 2; r.position.y = 6 + i * 6; g.add(r);
  } return g;
}
function makePlaza(d) {
  const g = makeTower(d);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 14, 48, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  wall.position.set(0, 7, -14); g.add(wall); return g;
}
function makeVault(d) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(22, 24, 14, 8), new THREE.MeshStandardMaterial({ color: 0x141a0b, emissive: new THREE.Color(d.color), emissiveIntensity: 0.25, metalness: 0.7, roughness: 0.4 }));
  base.position.y = 7; g.add(base);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 32), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35 }));
  orb.position.y = 22; g.add(orb); return g;
}
function makeChip(d) {
  const g = new THREE.Group();
  const chip = new THREE.Mesh(new THREE.BoxGeometry(46, 6, 46), new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.7, roughness: 0.3, emissive: new THREE.Color(d.color), emissiveIntensity: 0.15 }));
  chip.position.y = 3; g.add(chip);
  for (let i = -5; i <= 5; i++) for (const side of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 3), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 }));
    pin.position.set(i * 3.6, 3, side * 24); g.add(pin);
    const pin2 = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 }));
    pin2.position.set(side * 24, 3, i * 3.6); g.add(pin2);
  }
  const logo = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.55 }));
  logo.position.y = 14; g.add(logo); return g;
}
function makeBridge(d) {
  const g = makeTower(d);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(28, 1.2, 12, 48, Math.PI), new THREE.MeshBasicMaterial({ color: d.color }));
  arch.rotation.z = Math.PI; arch.position.y = 28; g.add(arch); return g;
}
function makePad(d) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 1.4, 32), new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: new THREE.Color(d.color), emissiveIntensity: 0.3 }));
  g.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 0.6, 12, 64), new THREE.MeshBasicMaterial({ color: d.color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 1.2; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  beam.position.y = 40; g.add(beam); return g;
}
function makeSpire(d) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(80, 4, 80), new THREE.MeshStandardMaterial({ color: 0x0a1424, metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(d.color), emissiveIntensity: 0.1 }));
  base.position.y = 2; g.add(base);
  const sections = 7;
  for (let i = 0; i < sections; i++) {
    const w = 42 - i * 4, h = 13;
    const sec = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.8, roughness: 0.25, emissive: new THREE.Color(d.color), emissiveIntensity: 0.15 }));
    sec.position.y = 4 + i * h + h / 2; g.add(sec);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.5, w + 0.1), new THREE.MeshBasicMaterial({ color: d.color }));
    seam.position.y = 4 + i * h + h; g.add(seam);
  }
  const tip = new THREE.Mesh(new THREE.ConeGeometry(1.4, 16, 6), new THREE.MeshBasicMaterial({ color: d.color }));
  tip.position.y = 4 + sections * 13 + 8; g.add(tip); return g;
}
const builders = { tower: makeTower, antenna: makeAntenna, plaza: makePlaza, vault: makeVault, chip: makeChip, bridge: makeBridge, pad: makePad };

function makeLabelSprite(text, color) {
  const cvs = document.createElement("canvas"); cvs.width = 512; cvs.height = 128;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "rgba(6,10,18,0.7)"; ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = "#" + new THREE.Color(color).getHexString(); ctx.lineWidth = 4; ctx.strokeRect(2, 2, 508, 124);
  ctx.font = "800 48px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff"; ctx.fillText(text.toUpperCase(), 256, 64);
  const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  s.scale.set(52, 13, 1); return s;
}

DISTRICTS.forEach(d => {
  const mesh = d.id === "spire" ? makeSpire(d) : builders[d.kind](d);
  mesh.position.set(d.pos[0], 0, d.pos[2]); scene.add(mesh);
  // World-space labels clip at narrow viewport edges; suppress them on phones
  // and rely on in-page section headings instead.
  if (!lowPower) {
    const label = makeLabelSprite(d.name, d.color);
    label.position.set(d.pos[0], d.tall + 18, d.pos[2]); scene.add(label);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(18, 19.5, 64), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(d.pos[0], 0.1, d.pos[2]); scene.add(ring);
});

// stars
const stars = new THREE.BufferGeometry(); const sp = [];
const STAR_COUNT = lowPower ? 700 : 1800;
for (let i = 0; i < STAR_COUNT; i++) sp.push((Math.random() - 0.5) * 4500, 50 + Math.random() * 1600, (Math.random() - 0.5) * 4500);
stars.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x88aaff, size: 1.5, transparent: true, opacity: 0.7 })));

// ---------- CAMERA PATH (scroll-driven flythrough) ----------
// One keyframe per section (hero + 8 districts). Each frame = { pos, look }.
function districtById(id) { return DISTRICTS.find(d => d.id === id); }
// helper: offset from district for a cinematic camera pose
function poseFor(id, dx, dy, dz, lookY = 20) {
  if (id === "hero") {
    return { pos: new THREE.Vector3(0, 380, 720), look: new THREE.Vector3(0, 40, 0) };
  }
  const d = districtById(id);
  return {
    pos: new THREE.Vector3(d.pos[0] + dx, d.pos[1] + dy, d.pos[2] + dz),
    look: new THREE.Vector3(d.pos[0], lookY, d.pos[2])
  };
}
const KEYS = [
  poseFor("hero"),                                            // 0 hero — high wide shot
  poseFor("spire",      90,  70, 160, 42),                    // 1 Spire — orbit left-high
  poseFor("foundry",   140,  55,  90, 28),                    // 2 Foundry — aerial approach
  poseFor("voice",    -130,  70,  90, 32),                    // 3 Voice — opposite side low-wide
  poseFor("ops",        90,  75, 180, 28),                    // 4 Ops — pull back high
  poseFor("revenue",  -130,  60,  90, 24),                    // 5 Revenue — hero shot
  poseFor("content",   120,  55,  90, 22),                    // 6 Content — chip side view
  poseFor("integration",-130, 70,  60, 22),                   // 7 Integration — arch side
  poseFor("contact",    0,   90, 160, 10)                     // 8 Contact — straight-on pull
];

const posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.pos), false, "catmullrom", 0.25);
const lookCurve = new THREE.CatmullRomCurve3(KEYS.map(k => k.look), false, "catmullrom", 0.25);

// ---------- SCROLL HOOK ----------
const sections = Array.from(document.querySelectorAll(".sec"));
const progressFill = document.getElementById("progressFill");
const navLinks = Array.from(document.querySelectorAll(".hud-nav a"));
const scrollIndicator = document.querySelector(".scroll-indicator");

let scrollProgress = 0;   // 0..1 across entire page
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

// section reveal + active nav
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add("active");
      const id = e.target.id;
      if (id) navLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
    }
  }
}, { threshold: 0.35 });
sections.forEach(s => io.observe(s));

// ---------- AGENT WALL ----------
const wall = document.getElementById("agentWall");
if (wall) {
  wall.innerHTML = AGENT_SAMPLE.map(a => `<div class="a"><b>${a[0]}</b><span>${a[1]}</span></div>`).join("");
  // Mobile: append a "+N more" count summary line outside the scrolling carousel
  const more = document.createElement("div");
  more.className = "agent-wall-more";
  more.innerHTML = `Plus <b>${270 - AGENT_SAMPLE.length}+</b> more across the roster`;
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
  hudToggle.addEventListener("click", () => {
    const open = hudNav.classList.toggle("open");
    hudToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  hudNav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
}

// ---------- LOOP ----------
const clock = new THREE.Clock();
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
let elapsed = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  // smooth scroll progress
  scrollProgress += (targetProgress - scrollProgress) * 0.08;
  // camera follows full path across 0..1
  posCurve.getPointAt(scrollProgress, tmpPos);
  lookCurve.getPointAt(scrollProgress, tmpLook);
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);

  // progress rail
  progressFill.style.height = (scrollProgress * 100).toFixed(1) + "%";

  // Pulsing energy nodes — gentle scale + opacity breathing
  for (const n of energyNodes) {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.4 + n.phase);
    const s = 1 + pulse * 0.18;
    n.ring.scale.set(s, s, 1);
    n.ring.material.opacity = 0.35 + pulse * 0.45;
  }

  updatePackets(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
