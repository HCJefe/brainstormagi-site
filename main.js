import * as THREE from "three";
import { DISTRICTS, AGENT_SAMPLE } from "./districts.js";

// ---------- SCENE ----------
const isMobile = window.matchMedia("(max-width: 640px)").matches;
const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
const lowPower = isMobile || isCoarsePointer;

const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: lowPower ? "low-power" : "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// Mobile gets a noticeable exposure lift so the 3D scene reads strongly through
// (now more transparent) mobile content panels. Desktop unchanged.
renderer.toneMappingExposure = lowPower ? 1.32 : 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
scene.fog = new THREE.FogExp2(0x04060a, lowPower ? 0.0010 : 0.0016);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 400, 600);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0x334466, lowPower ? 0.78 : 0.5));
const key = new THREE.DirectionalLight(0xffd0c0, lowPower ? 1.15 : 0.7); key.position.set(300, 400, 200); scene.add(key);
const rim = new THREE.DirectionalLight(0xff3344, lowPower ? 0.85 : 0.5); rim.position.set(-300, 200, -400); scene.add(rim);
const cyanLight = new THREE.DirectionalLight(0x4ff3ff, lowPower ? 0.85 : 0.35); cyanLight.position.set(0, 200, 400); scene.add(cyanLight);

// ---------- CIRCUIT BOARD FLOOR ----------
const BOARD = 1800;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD, BOARD),
  new THREE.MeshStandardMaterial({ color: 0x040810, roughness: 0.85, metalness: 0.3 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const gridFine = new THREE.GridHelper(BOARD, 180, 0x0e1a2c, 0x070d18);
gridFine.material.transparent = true; gridFine.material.opacity = lowPower ? 0.55 : 0.35; scene.add(gridFine);
const gridCoarse = new THREE.GridHelper(BOARD, 22, 0xff2a2a, 0x4a0c0c);
gridCoarse.material.transparent = true; gridCoarse.material.opacity = lowPower ? 0.65 : 0.42; gridCoarse.position.y = 0.02; scene.add(gridCoarse);

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

function addEnergyNode(x, z, color, size = 6, opts = {}) {
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

  // Vertical energy column — taller, brighter, more "electric uplink" presence.
  // Hero-prominent nodes get a much taller, wider, brighter beam so the electric
  // road reads instantly above the fold. Mobile keeps a shorter column to
  // protect performance and avoid overpowering text.
  const heroBoost = !!opts.heroBoost;
  // Mobile: taller, slightly fatter columns so the electric uplinks read strongly
  // around/through the mobile content panels. Desktop heights unchanged.
  const shaftHeight = heroBoost
    ? (lowPower ? 280 : 320)
    : (lowPower ? 160 : 140);
  const shaftRadius = heroBoost ? (lowPower ? 1.9 : 1.6) : (lowPower ? 1.2 : 0.9);
  const shaftOpacity = heroBoost ? (lowPower ? 0.62 : 0.46) : (lowPower ? 0.46 : 0.32);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftHeight, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: shaftOpacity, side: THREE.DoubleSide })
  );
  shaft.position.set(x, shaftHeight / 2, z);
  scene.add(shaft);

  // Inner white-hot core inside the column for an electrified look
  const coreH = shaftHeight * 0.9;
  const coreR = heroBoost ? (lowPower ? 0.7 : 0.55) : (lowPower ? 0.4 : 0.25);
  const coreOpacity = heroBoost
    ? (lowPower ? 0.92 : 0.78)
    : (lowPower ? 0.75 : 0.55);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(coreR, coreR, coreH, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: coreOpacity, side: THREE.DoubleSide })
  );
  core.position.set(x, coreH / 2, z);
  scene.add(core);

  // Outer halo cylinder for hero-boosted nodes — soft glow that reads as a
  // light shaft from a distance without taxing fillrate too hard.
  // Mobile gets a halo too so the electric uplink reads at a glance.
  let halo = null;
  if (heroBoost) {
    halo = new THREE.Mesh(
      new THREE.CylinderGeometry(lowPower ? 5.0 : 4.2, lowPower ? 5.0 : 4.2, shaftHeight, lowPower ? 10 : 14, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: lowPower ? 0.16 : 0.10, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.position.set(x, shaftHeight / 2, z);
    scene.add(halo);
  }

  energyNodes.push({ ring, shaft, core, halo, baseR: size + 1, baseR2: size + 1.6, phase: Math.random() * Math.PI * 2, heroBoost });
}

// Build the road network: spire (0,0) -> each district, L-shaped, with corner nodes.
// `content` and `integration` flank the spire on opposite x sides at modest z,
// so their endpoint energy columns read above the fold from the hero camera —
// boost them so a distinct vertical light shaft is visible in the first viewport.
const HERO_BOOST_IDS = new Set(["content", "integration"]);
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
  const heroBoost = HERO_BOOST_IDS.has(d.id);
  addEnergyNode(bx, bz, d.color, heroBoost ? 11 : 9, { heroBoost });

  roadPaths.push({
    color: d.color,
    points: [
      new THREE.Vector3(ax, ROAD_Y + 0.6, az),
      new THREE.Vector3(cornerX, ROAD_Y + 0.6, cornerZ),
      new THREE.Vector3(bx, ROAD_Y + 0.6, bz)
    ]
  });
});
// Central hub node at origin (the spire) — hero-boosted so the brand-red
// energy column rises tall and bright behind/around the hero card.
addEnergyNode(0, 0, 0xff2a2a, 14, { heroBoost: true });

// ---------- RACING CURRENT (electric current streaking along the roads) ----------
// Streaks are stretched along the segment direction so the current reads as
// motion lines rather than balls. Three classes:
//   - streak: long stretched bar of light (the racing feel)
//   - pulse: bright white-hot core dot
//   - command: district-tinted larger streak
// All use additive blending so they bloom into each other and read as flowing
// electricity. Speed scales with scroll velocity for a "we're racing" feel.
const streakGeo = new THREE.BoxGeometry(1, 0.4, 1.2);   // unit box, scaled per-frame to stretch along axis
const pulseGeo  = new THREE.SphereGeometry(0.9, 8, 8);
const commandStreakGeo = new THREE.BoxGeometry(1, 0.55, 1.6);
const packetMatWhite    = new THREE.MeshBasicMaterial({ color: 0xffffff,  transparent: true, opacity: lowPower ? 1.0 : 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const packetMatElectric = new THREE.MeshBasicMaterial({ color: 0x9ff8ff,  transparent: true, opacity: lowPower ? 1.0 : 0.9,  blending: THREE.AdditiveBlending, depthWrite: false });
const packets = [];
// Mobile: fewer than desktop but enough to read as a flowing current.
// Desktop unchanged.
const PACKET_COUNT = lowPower ? 180 : 320;
for (let i = 0; i < PACKET_COUNT; i++) {
  const route = roadPaths[i % roadPaths.length];
  let geo, mat;
  const cls = i % 7;
  if (cls === 0) {
    // Command streak — district-tinted, larger, slower
    geo = commandStreakGeo;
    mat = new THREE.MeshBasicMaterial({ color: route.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  } else if (cls === 1 || cls === 2) {
    // Pulse — white-hot dot
    geo = pulseGeo;
    mat = packetMatWhite;
  } else {
    // Streak — electric cyan, stretched, fast
    geo = streakGeo;
    mat = packetMatElectric;
  }
  const p = new THREE.Mesh(geo, mat);
  const isCmd = cls === 0;
  const isStreak = cls >= 3;
  p.userData = {
    route,
    t: Math.random(),
    // Faster baseline so the road feels like current racing along it
    speed: isCmd ? 0.10 + Math.random() * 0.10 : 0.22 + Math.random() * 0.32,
    isCmd,
    isStreak,
    // Mobile: longer streaks so racing current reads clearly through the panels
    streakLen: isCmd
      ? (lowPower ? 14 + Math.random() * 5 : 9 + Math.random() * 4)
      : (lowPower ? 18 + Math.random() * 9 : 12 + Math.random() * 8)
  };
  scene.add(p);
  packets.push(p);
}
function updatePackets(dt, speedBoost) {
  for (const p of packets) {
    p.userData.t += dt * p.userData.speed * speedBoost;
    if (p.userData.t > 1) p.userData.t = 0;
    const t = p.userData.t;
    const pts = p.userData.route.points;
    let from, to, lt;
    if (t < 0.5) { from = pts[0]; to = pts[1]; lt = t / 0.5; }
    else         { from = pts[1]; to = pts[2]; lt = (t - 0.5) / 0.5; }
    const lift = p.userData.isCmd ? 1.6 : (p.userData.isStreak ? 0.55 : 0.8);
    p.position.set(
      THREE.MathUtils.lerp(from.x, to.x, lt),
      ROAD_Y + lift,
      THREE.MathUtils.lerp(from.z, to.z, lt)
    );
    // Stretch the streak along its segment direction so it reads as a motion line
    if (p.userData.isStreak || p.userData.isCmd) {
      const horizontal = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
      const len = p.userData.streakLen * (1 + (speedBoost - 1) * 0.6);
      if (horizontal) { p.scale.set(len, 1, 1); }
      else            { p.scale.set(1, 1, len); }
    }
  }
}

// ---------- BUILDINGS (high-tech architecture) ----------
// Shared helpers that turn any base box into a "high-tech building":
//   - layered base plinth
//   - vertical light strips on all faces (window mullions / light columns)
//   - emissive horizontal floor bands (window rows)
//   - antenna/mast on top with blinking aircraft warning
//   - glowing roof cap and side detail
const BUILDING_BASE_COLOR = 0x0a1424;

function addLightStripsToBox(group, w, h, depth, baseY, color) {
  // Vertical light strips on the four faces — read as window columns
  const stripColor = color;
  const stripCount = 4;
  for (let face = 0; face < 4; face++) {
    const horizontal = face === 0 || face === 2; // facing +z or -z
    const sign = (face === 1 || face === 2) ? -1 : 1;
    for (let i = 1; i <= stripCount; i++) {
      const t = i / (stripCount + 1);
      const offset = (t - 0.5) * (horizontal ? w : depth) * 0.95;
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 0.4 : 0.25, h * 0.85, horizontal ? 0.25 : 0.4),
        new THREE.MeshBasicMaterial({ color: stripColor, transparent: true, opacity: 0.85 })
      );
      if (horizontal) {
        strip.position.set(offset, baseY + h * 0.5, sign * (depth * 0.5 + 0.15));
      } else {
        strip.position.set(sign * (w * 0.5 + 0.15), baseY + h * 0.5, offset);
      }
      group.add(strip);
    }
  }
  // Horizontal floor bands — emissive rings at every "floor", reads as window rows
  const floors = Math.max(3, Math.floor(h / 6));
  for (let f = 1; f < floors; f++) {
    const fy = baseY + (f / floors) * h;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.18, depth + 0.2),
      new THREE.MeshBasicMaterial({ color: stripColor, transparent: true, opacity: 0.42 })
    );
    band.position.set(0, fy, 0);
    group.add(band);
  }
}

function addRooftopGear(group, w, h, depth, baseY, color) {
  // Roof cap — slightly inset, brighter
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.78, 1.4, depth * 0.78),
    new THREE.MeshStandardMaterial({ color: 0x0d1828, metalness: 0.7, roughness: 0.35, emissive: new THREE.Color(color), emissiveIntensity: 0.5 })
  );
  cap.position.set(0, baseY + h + 0.7, 0);
  group.add(cap);
  // HVAC / equipment cube on roof
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.35, 2.2, depth * 0.4),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, metalness: 0.6, roughness: 0.45 })
  );
  box.position.set(-w * 0.18, baseY + h + 2.4, depth * 0.12);
  group.add(box);
  // Antenna mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, h * 0.32, 6),
    new THREE.MeshStandardMaterial({ color: 0x202833, metalness: 0.8, roughness: 0.3 })
  );
  mast.position.set(w * 0.25, baseY + h + 1.4 + h * 0.16, depth * 0.05);
  group.add(mast);
  // Aircraft warning beacon at mast tip
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  );
  beacon.position.set(mast.position.x, mast.position.y + h * 0.16 * 0.5 + 0.6, mast.position.z);
  group.add(beacon);
}

function makeHighTechBuilding(w, h, depth, baseY, color) {
  // Returns a group at origin (0,0,0) representing one high-tech building of
  // given footprint. Caller positions/offsets it. baseY is where the building's
  // base sits (usually 0). Total height including plinth roughly = h + plinth.
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  // Plinth — wider, short layered base
  const plinthH = 2.4;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.18, plinthH, depth * 1.18),
    new THREE.MeshStandardMaterial({ color: 0x081320, metalness: 0.55, roughness: 0.55, emissive: col, emissiveIntensity: 0.18 })
  );
  plinth.position.set(0, baseY + plinthH / 2, 0);
  g.add(plinth);
  // Plinth glowing edge ring
  const plinthEdge = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.22, 0.18, depth * 1.22),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
  );
  plinthEdge.position.set(0, baseY + plinthH, 0);
  g.add(plinthEdge);
  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, depth),
    new THREE.MeshStandardMaterial({ color: BUILDING_BASE_COLOR, roughness: 0.5, metalness: 0.7, emissive: col, emissiveIntensity: 0.18 })
  );
  body.position.set(0, baseY + plinthH + h / 2, 0);
  g.add(body);
  // Light strips + window bands
  addLightStripsToBox(g, w, h, depth, baseY + plinthH, color);
  // Rooftop gear
  addRooftopGear(g, w, h, depth, baseY + plinthH, color);
  return g;
}

function makeTower(d) {
  // High-tech cluster of 3-6 buildings of varying heights. Positions stay
  // within ~60u of the district center to preserve the original composition.
  const g = new THREE.Group();
  const count = d.kind === "plaza" ? 6 : d.kind === "chip" ? 4 : 3;
  // Deterministic spread using a seeded pattern so towers don't shuffle each load
  const slots = [
    [-22, -18], [22, -22], [-18, 22], [22, 24], [0, 0], [-2, 30]
  ];
  for (let i = 0; i < count; i++) {
    const w = 12 + (i % 2) * 5;
    const depth = 12 + ((i + 1) % 2) * 4;
    const h = d.tall * (0.55 + (i / count) * 0.55);
    const slot = slots[i % slots.length];
    const bldg = makeHighTechBuilding(w, h, depth, 0, d.color);
    bldg.position.set(slot[0], 0, slot[1]);
    g.add(bldg);
  }
  return g;
}
function makeAntenna(d) {
  // High-tech comms tower — segmented mast with truss collars, dish, and lit cab
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Hex base building (the cab where techs would work)
  const cab = makeHighTechBuilding(22, d.tall * 0.32, 22, 0, d.color);
  g.add(cab);
  const cabTop = 2.4 + d.tall * 0.32;
  // Segmented mast rising from cab roof
  const mastH = d.tall - cabTop * 0.6;
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 2.4, mastH, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: col, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.35 })
  );
  mast.position.y = cabTop + mastH / 2;
  g.add(mast);
  // Truss collars + transmitter rings climbing the mast
  for (let i = 0; i < 4; i++) {
    const ringY = cabTop + mastH * (0.2 + i * 0.18);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(6 + i * 1.2, 0.45, 8, 24),
      new THREE.MeshStandardMaterial({ color: 0x18222e, metalness: 0.7, roughness: 0.4, emissive: col, emissiveIntensity: 0.4 })
    );
    collar.rotation.x = Math.PI / 2; collar.position.y = ringY; g.add(collar);
  }
  // Dish array near the top
  const dish = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 3, 1.2, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x111923, metalness: 0.7, roughness: 0.45, side: THREE.DoubleSide })
  );
  dish.rotation.x = Math.PI / 2;
  dish.position.set(4.5, cabTop + mastH * 0.78, 0);
  g.add(dish);
  // Tip beacon
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  );
  tip.position.y = cabTop + mastH + 0.7; g.add(tip);
  return g;
}
function makePlaza(d) {
  const g = makeTower(d);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(36, 36, 14, 48, 1, true, -Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.18, side: THREE.DoubleSide }));
  wall.position.set(0, 7, -14); g.add(wall); return g;
}
function makeVault(d) {
  // High-tech vault — octagonal stepped tower, glowing energy core inside,
  // ringed observation deck, glowing seam between layers.
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Stepped octagonal base
  const baseH = 10;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(24, 26, baseH, 8),
    new THREE.MeshStandardMaterial({ color: 0x0c1626, emissive: col, emissiveIntensity: 0.25, metalness: 0.75, roughness: 0.35 })
  );
  base.position.y = baseH / 2; g.add(base);
  // Mid section — narrower drum
  const midH = 14;
  const mid = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 20, midH, 8),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: col, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.4 })
  );
  mid.position.y = baseH + midH / 2; g.add(mid);
  // Vertical seam strips around the drum
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, midH * 0.85, 0.45),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
    );
    seam.position.set(Math.cos(a) * 19, baseH + midH / 2, Math.sin(a) * 19);
    g.add(seam);
  }
  // Glowing seam ring at top of mid
  const ringSeam = new THREE.Mesh(
    new THREE.TorusGeometry(19, 0.5, 8, 32),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
  );
  ringSeam.rotation.x = Math.PI / 2;
  ringSeam.position.y = baseH + midH;
  g.add(ringSeam);
  // Energy core orb
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(7, 24, 24),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7 })
  );
  orb.position.y = baseH + midH + 7; g.add(orb);
  // Containment cage around orb (thin ring)
  const cage = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.25, 6, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  );
  cage.rotation.x = Math.PI / 2;
  cage.position.y = baseH + midH + 7; g.add(cage);
  return g;
}
function makeChip(d) {
  // High-tech data center / chip campus — base chip plate + multiple high-tech
  // building blocks rising from its surface, plus a central glowing data core.
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Base chip pad (the "campus floor")
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(46, 4, 46),
    new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.75, roughness: 0.3, emissive: col, emissiveIntensity: 0.18 })
  );
  chip.position.y = 2; g.add(chip);
  // Chip-edge connector pins (grounding strips)
  for (let i = -5; i <= 5; i++) for (const side of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.4), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 }));
    pin.position.set(i * 3.6, 2, side * 24); g.add(pin);
    const pin2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.4), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 }));
    pin2.position.set(side * 24, 2, i * 3.6); g.add(pin2);
  }
  // Glowing border edge on chip top
  const border = new THREE.Mesh(
    new THREE.BoxGeometry(46.2, 0.3, 46.2),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.65 })
  );
  border.position.y = 4.1; g.add(border);
  // Four tall data-center buildings around a central core
  const slots = [[-12, -12], [12, -12], [-12, 12], [12, 12]];
  slots.forEach(([sx, sz], i) => {
    const w = 9, depth = 9, h = d.tall * (0.7 + (i * 0.12));
    const bldg = makeHighTechBuilding(w, h, depth, 4, d.color);
    bldg.position.set(sx, 0, sz);
    g.add(bldg);
  });
  // Central data core — translucent obelisk with white-hot inner shaft
  const coreOuter = new THREE.Mesh(
    new THREE.BoxGeometry(10, 18, 10),
    new THREE.MeshStandardMaterial({ color: 0x081320, metalness: 0.7, roughness: 0.3, emissive: col, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 })
  );
  coreOuter.position.y = 4 + 9; g.add(coreOuter);
  const coreInner = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 17, 2.2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  coreInner.position.y = 4 + 9; g.add(coreInner);
  return g;
}
function makeBridge(d) {
  // Twin high-tech towers connected by an arched skybridge with running lights
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Two towers
  const left = makeHighTechBuilding(13, d.tall, 13, 0, d.color);
  left.position.set(-22, 0, 0); g.add(left);
  const right = makeHighTechBuilding(13, d.tall, 13, 0, d.color);
  right.position.set(22, 0, 0); g.add(right);
  // Arched skybridge connecting them
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(22, 1.6, 12, 48, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x101a26, metalness: 0.7, roughness: 0.4, emissive: col, emissiveIntensity: 0.35 })
  );
  arch.rotation.z = Math.PI;
  arch.position.y = d.tall * 0.7;
  g.add(arch);
  // Running lights along the arch underside
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI;
    const lx = -22 + Math.cos(Math.PI - a) * 22;
    const ly = d.tall * 0.7 - Math.sin(a) * 22;
    if (ly < 1) continue;
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
    );
    dot.position.set(lx, ly - 1.4, 0); g.add(dot);
  }
  // Bridge platform at midspan
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(46, 1.6, 6),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, metalness: 0.7, roughness: 0.4, emissive: col, emissiveIntensity: 0.3 })
  );
  platform.position.y = d.tall * 0.7 - 0.8;
  g.add(platform);
  return g;
}
function makePad(d) {
  // High-tech docking / launch pad — layered platform, glowing landing ring,
  // clamps around the perimeter, central uplink beam, and small support kiosks.
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Main pad platform
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 22, 2.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, emissive: col, emissiveIntensity: 0.35, metalness: 0.7, roughness: 0.4 })
  );
  pad.position.y = 1.1; g.add(pad);
  // Inner glowing landing ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(16, 0.55, 12, 64),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 2.3; g.add(ring);
  // Outer rim ring
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(22, 0.4, 8, 64),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.7 })
  );
  rim.rotation.x = Math.PI / 2; rim.position.y = 2.3; g.add(rim);
  // 6 docking clamps around perimeter
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const clamp = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 4, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x101a26, metalness: 0.8, roughness: 0.35, emissive: col, emissiveIntensity: 0.4 })
    );
    clamp.position.set(Math.cos(a) * 22, 4.1, Math.sin(a) * 22);
    g.add(clamp);
    const tipLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: d.color })
    );
    tipLight.position.set(Math.cos(a) * 22, 6.3, Math.sin(a) * 22);
    g.add(tipLight);
  }
  // Central uplink beam (taller, brighter)
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 110, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 55; g.add(beam);
  const beamCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 100, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
  );
  beamCore.position.y = 50; g.add(beamCore);
  return g;
}
function makeSpire(d) {
  // High-tech HQ spire — layered tapered tower with vertical light columns,
  // glowing seam rings between sections, observation deck near top, and a
  // bright energy spire tip.
  const g = new THREE.Group();
  const col = new THREE.Color(d.color);
  // Plaza base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(86, 4, 86),
    new THREE.MeshStandardMaterial({ color: 0x081320, metalness: 0.65, roughness: 0.4, emissive: col, emissiveIntensity: 0.16 })
  );
  base.position.y = 2; g.add(base);
  // Glowing base edge
  const baseEdge = new THREE.Mesh(
    new THREE.BoxGeometry(88, 0.3, 88),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
  );
  baseEdge.position.y = 4.1; g.add(baseEdge);
  const sections = 7;
  for (let i = 0; i < sections; i++) {
    const w = 42 - i * 4;
    const h = 13;
    const sec = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, w),
      new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.85, roughness: 0.25, emissive: col, emissiveIntensity: 0.18 })
    );
    sec.position.y = 4 + i * h + h / 2; g.add(sec);
    // Vertical light columns on every face
    for (const sign of [-1, 1]) {
      for (let j = -1; j <= 1; j++) {
        const offset = j * (w * 0.32);
        const sx = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, h * 0.85, 0.25),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
        );
        sx.position.set(offset, 4 + i * h + h / 2, sign * (w * 0.5 + 0.15));
        g.add(sx);
        const sz = new THREE.Mesh(
          new THREE.BoxGeometry(0.25, h * 0.85, 0.35),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.85 })
        );
        sz.position.set(sign * (w * 0.5 + 0.15), 4 + i * h + h / 2, offset);
        g.add(sz);
      }
    }
    // Glowing seam ring at section top
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, 0.5, w + 0.4),
      new THREE.MeshBasicMaterial({ color: d.color })
    );
    seam.position.y = 4 + i * h + h; g.add(seam);
  }
  // Observation deck near top — wider disc
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 20, 2.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x0a1424, metalness: 0.75, roughness: 0.35, emissive: col, emissiveIntensity: 0.45 })
  );
  deck.position.y = 4 + sections * 13 + 1.2; g.add(deck);
  const deckRing = new THREE.Mesh(
    new THREE.TorusGeometry(20, 0.45, 8, 48),
    new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
  );
  deckRing.rotation.x = Math.PI / 2;
  deckRing.position.y = 4 + sections * 13 + 2.4; g.add(deckRing);
  // Energy spire tip
  const tipBase = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 4, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.85, roughness: 0.25, emissive: col, emissiveIntensity: 0.5 })
  );
  tipBase.position.y = 4 + sections * 13 + 6.4; g.add(tipBase);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 18, 8),
    new THREE.MeshBasicMaterial({ color: d.color })
  );
  tip.position.y = 4 + sections * 13 + 19; g.add(tip);
  // Apex beacon
  const apex = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  apex.position.y = 4 + sections * 13 + 28; g.add(apex);
  return g;
}
const builders = { tower: makeTower, antenna: makeAntenna, plaza: makePlaza, vault: makeVault, chip: makeChip, bridge: makeBridge, pad: makePad };

function makeLabelSprite(text, color) {
  // High-DPI canvas so the chip renders crisply at the larger world scale
  const W = 1024, H = 220;
  const cvs = document.createElement("canvas"); cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d");
  // Solid panel background for legibility against the 3D scene
  ctx.fillStyle = "rgba(4,8,16,0.92)"; ctx.fillRect(0, 0, W, H);
  // Brand-color border + inner highlight
  ctx.strokeStyle = "#" + new THREE.Color(color).getHexString();
  ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  // Large, high-contrast text
  ctx.font = "800 96px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 12;
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 8;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  // World-space scale — larger so labels are at least ~14px equivalent on desktop
  s.scale.set(96, 21, 1);
  // Stash the rendered text length so the per-frame edge check can estimate
  // the visible chip width (background panel is full sprite, but the visible
  // text occupies less — we want to detect when the *panel* would clip).
  s.userData.textLen = text.length;
  return s;
}

// Track label sprites so each frame can hide any whose projected bounding box
// would clip the viewport edge. Hard-clipping a label mid-letter at the canvas
// edge looks broken; opacity fade alone still showed partial letters as the
// chip reached the rim. Hide entirely when within a safe margin of any edge.
const labelSprites = [];

// Floating telemetry rings + waypoint halos — the antigravity touch.
// Each district gets a ring of suspended orbital tori at varying tilts that
// drift slowly. Reads as "telemetry / orbit / containment field" without
// blowing the perf budget.
const telemetryRings = [];
const waypointMarkers = [];

DISTRICTS.forEach(d => {
  const mesh = d.id === "spire" ? makeSpire(d) : builders[d.kind](d);
  mesh.position.set(d.pos[0], 0, d.pos[2]); scene.add(mesh);
  // World-space labels clip at narrow viewport edges; suppress them on phones
  // and rely on in-page section headings instead.
  if (!lowPower) {
    const label = makeLabelSprite(d.name, d.color);
    // Position label snug above the building so it stays inside the camera frame
    label.position.set(d.pos[0], d.tall + 26, d.pos[2]);
    scene.add(label);
    labelSprites.push(label);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(18, 19.5, 64), new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(d.pos[0], 0.1, d.pos[2]); scene.add(ring);

  // Suspended telemetry rings — fewer on mobile, more on desktop
  const ringCount = lowPower ? 2 : 3;
  for (let i = 0; i < ringCount; i++) {
    const r = 30 + i * 7;
    const tilt = (i - 1) * 0.32;
    const tor = new THREE.Mesh(
      new THREE.TorusGeometry(r, lowPower ? 0.5 : 0.35, 6, 64),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: (lowPower ? 0.78 : 0.55) - i * 0.08 })
    );
    const liftY = d.tall + 14 + i * 9;
    tor.position.set(d.pos[0], liftY, d.pos[2]);
    tor.rotation.x = Math.PI / 2 + tilt;
    tor.rotation.z = i * 0.7;
    scene.add(tor);
    telemetryRings.push({
      mesh: tor,
      baseY: liftY,
      spin: 0.12 + i * 0.05 + (i % 2 ? -0.04 : 0.04),
      phase: Math.random() * Math.PI * 2
    });
  }

  // Floating waypoint marker — a small suspended diamond above each district
  // that bobs gently, giving an "antigravity beacon" feel. Skipped for spire
  // since the spire tip already plays that role.
  if (d.id !== "spire") {
    const beaconY = d.tall + 36;
    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.4, 0),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.95 })
    );
    beacon.position.set(d.pos[0], beaconY, d.pos[2]);
    scene.add(beacon);
    // Thin tether line from beacon down to district top
    const tether = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, beaconY - d.tall, 4, 1, true),
      new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    tether.position.set(d.pos[0], (beaconY + d.tall) / 2, d.pos[2]);
    scene.add(tether);
    waypointMarkers.push({ mesh: beacon, baseY: beaconY, phase: Math.random() * Math.PI * 2 });
  }
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
    // Mobile: pull camera closer + lower so buildings/road dominate above the
    // fold. Desktop pose unchanged.
    if (lowPower) {
      return { pos: new THREE.Vector3(0, 300, 540), look: new THREE.Vector3(0, 60, 0) };
    }
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
  hudToggle.addEventListener("click", () => {
    const open = hudNav.classList.toggle("open");
    hudToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  hudNav.querySelectorAll("a").forEach(a => a.addEventListener("click", closeNav));
}

// ---------- LABEL EDGE + PANEL SAFETY ----------
// A label must NEVER render partially clipped by the canvas viewport, AND must
// never visually intersect a foreground content panel (e.g. the hero card or
// any `.sec-inner`). Two failure modes we're guarding against:
//   1. Viewport-edge clip: opacity fade alone leaves a partial chip at the rim.
//   2. Panel overlap: the chip sits behind a content card and the card's edge
//      slices the chip mid-letter (e.g. "INTEGRATION HU" cut by hero panel).
// Each frame we project the sprite to screen space, build its on-screen bbox,
// and hide the sprite entirely if it clips a viewport edge OR overlaps the
// rect of any visible foreground panel (with a small safety margin).
//
// The remaining road, energy nodes, pulses, and 3D buildings are unaffected.
const tmpProj = new THREE.Vector3();
const tmpView = new THREE.Vector3();
const EDGE_SAFE_MARGIN_PX = 48;   // hide if any sprite edge is within this many px of viewport edge
const PANEL_SAFE_MARGIN_PX = 18;  // hide if sprite bbox comes within this many px of any visible panel
// Cache the live list of panels — `.sec-inner` covers every section card,
// including the hero panel that was slicing INTEGRATION HUB.
const panelEls = Array.from(document.querySelectorAll(".sec-inner"));
function rectsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
function updateLabelEdgeSafety() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const halfW = vw * 0.5;
  const halfH = vh * 0.5;
  // Collect bounding rects of panels currently on screen. Only on-screen panels
  // can occlude a label, so off-screen sections are skipped to avoid wasted work.
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
    // View-space Z < 0 is in front of camera in three.js convention.
    tmpView.copy(s.position).applyMatrix4(camera.matrixWorldInverse);
    if (tmpView.z >= 0) { s.visible = false; s.material.opacity = 0; continue; }
    tmpProj.copy(s.position).project(camera);
    if (tmpProj.z < -1 || tmpProj.z > 1) { s.visible = false; s.material.opacity = 0; continue; }
    const screenX = tmpProj.x * halfW + halfW;
    const screenY = -tmpProj.y * halfH + halfH;
    // Convert sprite world-unit scale to pixel size at the sprite's distance.
    const camDist = camera.position.distanceTo(s.position);
    const pxPerWorld = vh / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.max(camDist, 1));
    // Estimate the on-screen width of the visible chip. The sprite background
    // panel spans the full s.scale.x, but the readable text width is shorter;
    // we conservatively use the larger of (panel width) and (text-length * px)
    // so we hide before any letter clips. ~11px per character at 14px font is
    // generous and matches the sprite's rendered text.
    const panelHalfWidthPx = (s.scale.x * 0.5) * pxPerWorld;
    const textHalfWidthPx = (s.userData.textLen || 12) * 11 * 0.5;
    const halfWidthPx  = Math.max(panelHalfWidthPx, textHalfWidthPx);
    const halfHeightPx = Math.max((s.scale.y * 0.5) * pxPerWorld, 16);
    const leftEdge   = screenX - halfWidthPx;
    const rightEdge  = screenX + halfWidthPx;
    const topEdge    = screenY - halfHeightPx;
    const bottomEdge = screenY + halfHeightPx;
    // Rule 1: hide if any edge is within safe margin of viewport edge.
    const clipsEdge =
      leftEdge   < EDGE_SAFE_MARGIN_PX ||
      rightEdge  > vw - EDGE_SAFE_MARGIN_PX ||
      topEdge    < EDGE_SAFE_MARGIN_PX ||
      bottomEdge > vh - EDGE_SAFE_MARGIN_PX;
    // Rule 2: hide if the projected bbox overlaps any visible foreground panel.
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
let lastProgress = 0;
let scrollSpeed = 0; // smoothed |dProgress/dt|
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;
  // smooth scroll progress
  scrollProgress += (targetProgress - scrollProgress) * 0.08;
  // Track scroll velocity to drive the racing-current speed boost. When the
  // user scrolls, electricity along the roads accelerates and streaks stretch
  // longer — selling the "we're racing along the circuit board" feeling.
  const dProg = Math.abs(scrollProgress - lastProgress);
  lastProgress = scrollProgress;
  const instSpeed = dt > 0 ? dProg / dt : 0;
  scrollSpeed += (instSpeed - scrollSpeed) * 0.18;
  const speedBoost = 1 + Math.min(scrollSpeed * 22, 2.6); // 1x..3.6x
  // camera follows full path across 0..1
  posCurve.getPointAt(scrollProgress, tmpPos);
  lookCurve.getPointAt(scrollProgress, tmpLook);
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);

  // progress rail
  progressFill.style.height = (scrollProgress * 100).toFixed(1) + "%";

  // Pulsing energy nodes — gentle scale + opacity breathing, plus column flicker.
  // Hero-boosted columns breathe brighter so the electric uplink reads above the
  // fold from the hero camera position.
  for (const n of energyNodes) {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.4 + n.phase);
    const s = 1 + pulse * 0.18;
    n.ring.scale.set(s, s, 1);
    n.ring.material.opacity = 0.35 + pulse * 0.45;
    if (n.heroBoost) {
      if (n.shaft) n.shaft.material.opacity = 0.32 + pulse * 0.28;
      if (n.core)  n.core.material.opacity  = 0.55 + pulse * 0.35;
      if (n.halo)  n.halo.material.opacity  = 0.07 + pulse * 0.10;
    } else {
      if (n.shaft) n.shaft.material.opacity = 0.18 + pulse * 0.22;
      if (n.core)  n.core.material.opacity  = 0.35 + pulse * 0.35;
    }
  }

  // Telemetry rings — slow rotation + slight bob for antigravity feel
  for (const t of telemetryRings) {
    t.mesh.rotation.z += dt * t.spin;
    t.mesh.position.y = t.baseY + Math.sin(elapsed * 0.9 + t.phase) * 1.6;
  }

  // Waypoint beacons — float and softly spin
  for (const w of waypointMarkers) {
    w.mesh.position.y = w.baseY + Math.sin(elapsed * 1.4 + w.phase) * 2.2;
    w.mesh.rotation.y += dt * 0.9;
    w.mesh.rotation.x += dt * 0.4;
  }

  updatePackets(dt, speedBoost);
  updateLabelEdgeSafety();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
