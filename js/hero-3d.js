/**
 * Brainstorm AGI - Hero 3D Neural Network Scene
 * ENHANCED: Futuristic AI Command Center
 * More nodes, red/cyan glow, reactive mouse tracking, animated grid floor
 */

import * as THREE from 'three';

(function() {
  const container = document.getElementById('hero-canvas');
  if (!container) return;

  // --- Configuration ---
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 250 : 700;
  const CONNECTION_DISTANCE = isMobile ? 2.8 : 2.6;
  const MAX_CONNECTIONS = isMobile ? 500 : 2000;
  const BRAIN_SCALE = isMobile ? 3.5 : 5.2;

  // --- Scene Setup ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.018);

  const camera = new THREE.PerspectiveCamera(58, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 13);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // --- Mouse tracking (enhanced responsiveness) ---
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, vx: 0, vy: 0 };

  document.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Touch support
  document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    mouse.targetX = (touch.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (touch.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // --- Animated Grid Floor ---
  if (!isMobile) {
    const gridSize = 40;
    const gridDivisions = 20;
    const gridGeometry = new THREE.PlaneGeometry(gridSize, gridSize, gridDivisions, gridDivisions);
    const gridPositions = gridGeometry.attributes.position;

    // Wave the grid slightly
    const gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0x00E5FF) },
        uColor2: { value: new THREE.Color(0xD32F2F) }
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float dist = length(pos.xy) / 20.0;
          float wave = sin(pos.x * 0.3 + uTime * 0.5) * 0.2 + cos(pos.y * 0.3 + uTime * 0.4) * 0.2;
          float fade = 1.0 - dist;
          pos.z += wave * fade * 0.5;
          vElevation = fade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          float grid = 0.0;
          float lx = abs(fract(vUv.x * 20.0) - 0.5);
          float ly = abs(fract(vUv.y * 20.0) - 0.5);
          grid = max(step(0.45, lx), step(0.45, ly));
          if (grid < 0.5) discard;
          vec3 col = mix(uColor2, uColor1, vUv.x);
          float alpha = vElevation * 0.18 * grid;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    grid.rotation.x = -Math.PI * 0.35;
    grid.position.y = -6;
    grid.position.z = -2;
    scene.add(grid);

    // Store reference for animation
    scene.userData.grid = grid;
    scene.userData.gridMaterial = gridMaterial;
  }

  // --- Generate brain-shaped distribution ---
  function generateBrainPosition() {
    const type = Math.random();
    let x, y, z;

    if (type < 0.32) {
      // Left hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.75 + Math.random() * 0.45;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.15 - 0.55;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.88 + 0.2;
      z = r * Math.cos(phi) * 0.82;
    } else if (type < 0.64) {
      // Right hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.75 + Math.random() * 0.45;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.15 + 0.55;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.88 + 0.2;
      z = r * Math.cos(phi) * 0.82;
    } else if (type < 0.76) {
      // Brain stem
      const theta = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.22;
      x = r * Math.cos(theta);
      y = -0.85 - Math.random() * 0.65;
      z = r * Math.sin(theta);
    } else if (type < 0.86) {
      // Central bridge (corpus callosum)
      x = (Math.random() - 0.5) * 0.7;
      y = 0.38 + Math.random() * 0.35;
      z = (Math.random() - 0.5) * 0.45;
    } else if (type < 0.93) {
      // Cerebellum (rear lower)
      const theta = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.35;
      x = r * Math.cos(theta) * 0.8;
      y = -0.5 + Math.random() * 0.3;
      z = r * Math.sin(theta) - 0.6;
    } else {
      // Floating orbital particles
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.4 + Math.random() * 1.0;
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi);
    }

    return new THREE.Vector3(x * BRAIN_SCALE, y * BRAIN_SCALE, z * BRAIN_SCALE);
  }

  // --- Particles ---
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleColors = new Float32Array(PARTICLE_COUNT * 3);
  const particleSizes = new Float32Array(PARTICLE_COUNT);
  const particlePulse = new Float32Array(PARTICLE_COUNT);
  const velocities = [];
  const basePositions = [];

  // Enhanced color palette: red, cyan, purple, white
  const colors = [
    new THREE.Color(0xD32F2F),   // Deep red
    new THREE.Color(0xFF5252),   // Bright red
    new THREE.Color(0x00E5FF),   // Cyan
    new THREE.Color(0x00B8D4),   // Dark cyan
    new THREE.Color(0x7C4DFF),   // Purple
    new THREE.Color(0xE8E8F0),   // Near white
    new THREE.Color(0xFF8A80),   // Pink red
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pos = generateBrainPosition();
    particlePositions[i * 3] = pos.x;
    particlePositions[i * 3 + 1] = pos.y;
    particlePositions[i * 3 + 2] = pos.z;

    basePositions.push(pos.clone());

    // Color distribution: heavy on red/cyan, some purple, some white
    const colorRoll = Math.random();
    let color;
    if (colorRoll < 0.3) {
      color = colors[0]; // Deep red
      particleSizes[i] = 3 + Math.random() * 5;
    } else if (colorRoll < 0.45) {
      color = colors[1]; // Bright red
      particleSizes[i] = 2 + Math.random() * 4;
    } else if (colorRoll < 0.60) {
      color = colors[2]; // Cyan
      particleSizes[i] = 2.5 + Math.random() * 4;
    } else if (colorRoll < 0.68) {
      color = colors[3]; // Dark cyan
      particleSizes[i] = 1.5 + Math.random() * 3;
    } else if (colorRoll < 0.75) {
      color = colors[4]; // Purple
      particleSizes[i] = 2 + Math.random() * 3;
    } else if (colorRoll < 0.88) {
      color = colors[5]; // Near white
      particleSizes[i] = 1.5 + Math.random() * 3;
    } else {
      color = colors[6]; // Pink red
      particleSizes[i] = 1 + Math.random() * 2.5;
    }

    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;

    // Random pulse offset per particle
    particlePulse[i] = Math.random() * Math.PI * 2;

    velocities.push({
      x: (Math.random() - 0.5) * 0.004,
      y: (Math.random() - 0.5) * 0.004,
      z: (Math.random() - 0.5) * 0.004
    });
  }

  // Particle geometry
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
  particleGeometry.setAttribute('pulse', new THREE.BufferAttribute(particlePulse, 1));

  // Enhanced particle shader with glow and pulse
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float pulse;
      varying vec3 vColor;
      varying float vSize;
      uniform float uTime;

      void main() {
        vColor = color;
        vSize = size;

        // Pulsing size modulation per particle
        float pulseFactor = 1.0 + sin(uTime * 1.8 + pulse) * 0.25;
        float finalSize = size * pulseFactor;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = finalSize * (220.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSize;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        // Core bright center
        float core = 1.0 - smoothstep(0.0, 0.15, dist);
        // Soft glow falloff
        float glow = exp(-dist * 3.5) * 0.7;
        // Outer halo
        float halo = exp(-dist * 8.0) * 0.4;

        vec3 finalColor = vColor + vColor * (core * 1.5 + halo);
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * 0.9;
        // Boost alpha for core
        alpha = max(alpha, core * 0.95);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // --- Connection Lines (enhanced with red/cyan color) ---
  const linePositions = new Float32Array(MAX_CONNECTIONS * 6);
  const lineColors = new Float32Array(MAX_CONNECTIONS * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
  lineGeometry.setDrawRange(0, 0);

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // --- Ambient background particles ---
  const bgParticleCount = isMobile ? 80 : 200;
  const bgPositions = new Float32Array(bgParticleCount * 3);
  const bgSizes = new Float32Array(bgParticleCount);
  const bgColorArr = new Float32Array(bgParticleCount * 3);

  for (let i = 0; i < bgParticleCount; i++) {
    bgPositions[i * 3] = (Math.random() - 0.5) * 40;
    bgPositions[i * 3 + 1] = (Math.random() - 0.5) * 25;
    bgPositions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5;
    bgSizes[i] = 0.3 + Math.random() * 1.2;

    // Alternate between cyan and red tints
    const isCyan = Math.random() > 0.5;
    bgColorArr[i * 3] = isCyan ? 0 : 0.5;
    bgColorArr[i * 3 + 1] = isCyan ? 0.8 : 0.15;
    bgColorArr[i * 3 + 2] = isCyan ? 1.0 : 0.15;
  }

  const bgGeometry = new THREE.BufferGeometry();
  bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
  bgGeometry.setAttribute('size', new THREE.BufferAttribute(bgSizes, 1));
  bgGeometry.setAttribute('color', new THREE.BufferAttribute(bgColorArr, 3));

  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      uniform float uTime;
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        vColor = color;
        vec3 pos = position;
        pos.y += sin(uTime * 0.25 + position.x * 0.4) * 0.4;
        pos.x += cos(uTime * 0.18 + position.y * 0.3) * 0.3;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (130.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = 0.08 + sin(uTime * 0.5 + position.x + position.y) * 0.04;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying vec3 vColor;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.1, 0.5, dist)) * vAlpha;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const bgParticles = new THREE.Points(bgGeometry, bgMaterial);
  scene.add(bgParticles);

  // --- Animation Loop ---
  let time = 0;
  const clock = new THREE.Clock();

  // Spatial hashing for faster connection finding
  function updateConnections() {
    let lineIndex = 0;
    const positions = particleGeometry.attributes.position.array;
    const connectionDist2 = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

    for (let i = 0; i < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];

      for (let j = i + 1; j < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; j++) {
        const jx = positions[j * 3];
        const jy = positions[j * 3 + 1];
        const jz = positions[j * 3 + 2];

        const dx = ix - jx;
        const dy = iy - jy;
        const dz = iz - jz;
        const dist2 = dx * dx + dy * dy + dz * dz;

        if (dist2 < connectionDist2) {
          const dist = Math.sqrt(dist2);
          const alpha = 1 - (dist / CONNECTION_DISTANCE);

          // Pulsing energy with faster oscillation
          const pulse = (Math.sin(time * 4 + (i + j) * 0.12) * 0.5 + 0.5) * 0.35 + 0.2;
          const intensity = alpha * pulse;

          // Color varies: mix of red-to-cyan based on particle index and distance
          const blend = Math.sin((i - j) * 0.05 + time * 0.3) * 0.5 + 0.5;
          const r = (1 - blend) * 0.85 + blend * 0.0;
          const g = (1 - blend) * 0.15 + blend * 0.85;
          const b = (1 - blend) * 0.15 + blend * 1.0;

          const li = lineIndex * 6;
          linePositions[li]     = ix;
          linePositions[li + 1] = iy;
          linePositions[li + 2] = iz;
          linePositions[li + 3] = jx;
          linePositions[li + 4] = jy;
          linePositions[li + 5] = jz;

          const ib = intensity;
          lineColors[li]     = r * ib;
          lineColors[li + 1] = g * ib * 0.6;
          lineColors[li + 2] = b * ib;
          lineColors[li + 3] = r * ib * 0.5;
          lineColors[li + 4] = g * ib * 0.3;
          lineColors[li + 5] = b * ib * 0.5;

          lineIndex++;
        }
      }
    }

    lineGeometry.setDrawRange(0, lineIndex * 2);
    lineGeometry.attributes.position.needsUpdate = true;
    lineGeometry.attributes.color.needsUpdate = true;
  }

  function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    time += delta;

    // Enhanced smooth mouse follow with velocity
    const mouseEase = 0.06;
    mouse.vx += (mouse.targetX - mouse.x) * mouseEase;
    mouse.vy += (mouse.targetY - mouse.y) * mouseEase;
    mouse.vx *= 0.85;
    mouse.vy *= 0.85;
    mouse.x += mouse.vx;
    mouse.y += mouse.vy;

    // Update particle positions (breathing, organic motion)
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = basePositions[i];
      const vel = velocities[i];

      // More energetic movement
      const breathX = Math.sin(time * 0.6 + i * 0.11) * 0.2;
      const breathY = Math.cos(time * 0.45 + i * 0.17) * 0.18;
      const breathZ = Math.sin(time * 0.35 + i * 0.22) * 0.12;

      // Mouse proximity influence: particles near center shift toward mouse
      const normX = base.x / (BRAIN_SCALE * 1.5);
      const normY = base.y / (BRAIN_SCALE * 1.5);
      const mouseInfluenceX = mouse.x * 0.4 * Math.exp(-normX * normX - normY * normY);
      const mouseInfluenceY = -mouse.y * 0.25 * Math.exp(-normX * normX - normY * normY);

      posArray[i * 3]     = base.x + breathX + vel.x * Math.sin(time) + mouseInfluenceX;
      posArray[i * 3 + 1] = base.y + breathY + vel.y * Math.cos(time) + mouseInfluenceY;
      posArray[i * 3 + 2] = base.z + breathZ + vel.z * Math.sin(time * 0.7);
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Update connections
    updateConnections();

    // Scene rotation following mouse (more responsive)
    const targetRotY = mouse.x * 0.35;
    const targetRotX = mouse.y * 0.18;

    particles.rotation.y += (targetRotY - particles.rotation.y) * 0.04;
    particles.rotation.x += (targetRotX - particles.rotation.x) * 0.04;
    lines.rotation.y = particles.rotation.y;
    lines.rotation.x = particles.rotation.x;

    // Gentle auto-rotation
    const autoRotY = time * 0.06;
    particles.rotation.y += autoRotY * delta;
    lines.rotation.y += autoRotY * delta;

    // Update shader time uniforms
    particleMaterial.uniforms.uTime.value = time;
    bgMaterial.uniforms.uTime.value = time;

    // Animate grid if exists
    if (scene.userData.gridMaterial) {
      scene.userData.gridMaterial.uniforms.uTime.value = time;
    }

    renderer.render(scene, camera);
  }

  // --- Resize Handler ---
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', onResize);

  // --- Start ---
  animate();

})();
