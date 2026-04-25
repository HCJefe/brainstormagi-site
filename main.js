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

scene.add(new THREE.AmbientLight(0x334466, 0.55));
const key = new THREE.DirectionalLight(0xffd0c0, 0.8); key.position.set(300, 400, 200); scene.add(key);
const rim = new THREE.DirectionalLight(0xff3344, 0.55); rim.position.set(-300, 200, -400); scene.add(rim);

// ---------- CIRCUIT BOARD FLOOR ----------
const BOARD = 1800;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD, BOARD),
  new THREE.MeshStandardMaterial({ color: 0x061018, roughness: 0.7, metalness: 0.4 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const gridFine = new THREE.GridHelper(BOARD, 180, 0x112034, 0x0b1626);
gridFine.material.transparent = true; gridFine.material.opacity = 0.45; scene.add(gridFine);
const gridCoarse = new THREE.GridHelper(BOARD, 22, 0xff2a2a, 0x661010);
gridCoarse.material.transparent = true; gridCoarse.material.opacity = 0.55; gridCoarse.position.y = 0.02; scene.add(gridCoarse);

// PCB traces spire -> each district
function addTrace(from, to, color = 0xff2a2a) {
  const pts = [
    new THREE.Vector3(from[0], 0.1, from[2]),
    new THREE.Vector3(to[0],   0.1, from[2]),
    new THREE.Vector3(to[0],   0.1, to[2])
  ];
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })));
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.6, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }));
  scene.add(tube);
  return pts;
}
DISTRICTS.filter(d => d.id !== "spire").forEach(d => addTrace([0,0,0], d.pos, d.color));
function addPad(x, z, r = 8, c = 0xff2a2a) {
  const pad = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: c }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(x, 0.05, z); scene.add(pad);
}
DISTRICTS.forEach(d => addPad(d.pos[0], d.pos[2], 9, d.color));

// ---------- DATA PACKETS (flowing along traces) ----------
const packetGeo = new THREE.SphereGeometry(0.8, 8, 8);
const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const packets = [];
const PACKET_COUNT = lowPower ? 80 : 220;
for (let i = 0; i < PACKET_COUNT; i++) {
  const d = DISTRICTS[1 + (i % (DISTRICTS.length - 1))];
  const p = new THREE.Mesh(packetGeo, packetMat);
  p.userData = { target: d, t: Math.random(), speed: 0.08 + Math.random() * 0.1 };
  scene.add(p); packets.push(p);
}
function updatePackets(dt) {
  for (const p of packets) {
    p.userData.t += dt * p.userData.speed;
    if (p.userData.t > 1) p.userData.t = 0;
    const d = p.userData.target;
    const t = p.userData.t;
    let x, z;
    if (t < 0.5) { x = THREE.MathUtils.lerp(0, d.pos[0], t / 0.5); z = 0; }
    else          { x = d.pos[0]; z = THREE.MathUtils.lerp(0, d.pos[2], (t - 0.5) / 0.5); }
    p.position.set(x, 0.6, z);
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
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  // smooth scroll progress
  scrollProgress += (targetProgress - scrollProgress) * 0.08;
  // camera follows full path across 0..1
  posCurve.getPointAt(scrollProgress, tmpPos);
  lookCurve.getPointAt(scrollProgress, tmpLook);
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);

  // progress rail
  progressFill.style.height = (scrollProgress * 100).toFixed(1) + "%";

  updatePackets(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
