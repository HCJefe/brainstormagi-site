/**
 * Brainstorm AGI - Hero 3D Neural Network Scene
 * SUPERCHARGED: Fast, reactive, alive
 * More particles, faster mouse tracking, energy pulses, data streams
 */

import * as THREE from 'three';

(function() {
  const container = document.getElementById('hero-canvas');
  if (!container) return;

  // --- Configuration ---
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 220 : 500;
  const CONNECTION_DISTANCE = isMobile ? 2.6 : 2.5;
  const MAX_CONNECTIONS = isMobile ? 600 : 1800;
  const BRAIN_SCALE = isMobile ? 3.8 : 5.0;

  // --- Scene Setup ---
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050510, 0.015);

  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.3, 14);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  // --- FAST Mouse tracking ---
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0, speed: 0 };
  let prevMouseX = 0, prevMouseY = 0;

  document.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
    // Track speed for reactive effects
    const dx = mouse.targetX - prevMouseX;
    const dy = mouse.targetY - prevMouseY;
    mouse.speed = Math.sqrt(dx * dx + dy * dy);
    prevMouseX = mouse.targetX;
    prevMouseY = mouse.targetY;
  });

  document.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    mouse.targetX = (touch.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (touch.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // --- Animated Grid Floor ---
  if (!isMobile) {
    const gridGeometry = new THREE.PlaneGeometry(50, 50, 30, 30);
    const gridMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uColor1: { value: new THREE.Color(0x00E5FF) },
        uColor2: { value: new THREE.Color(0xD32F2F) }
      },
      vertexShader: `
        uniform float uTime;
        uniform vec2 uMouse;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          vUv = uv;
          vec3 pos = position;
          float dist = length(pos.xy) / 25.0;
          // Multiple wave layers for more organic movement
          float wave = sin(pos.x * 0.4 + uTime * 0.8) * 0.3 
                     + cos(pos.y * 0.35 + uTime * 0.6) * 0.25
                     + sin(pos.x * 0.15 + pos.y * 0.15 + uTime * 1.2) * 0.15;
          // Mouse ripple effect
          vec2 mousePos = uMouse * 10.0;
          float mouseDist = length(pos.xy - mousePos);
          wave += sin(mouseDist * 0.8 - uTime * 3.0) * 0.4 * exp(-mouseDist * 0.15);
          float fade = 1.0 - dist;
          pos.z += wave * fade * 0.5;
          vElevation = fade;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform float uTime;
        varying vec2 vUv;
        varying float vElevation;
        void main() {
          float grid = 0.0;
          float lx = abs(fract(vUv.x * 25.0) - 0.5);
          float ly = abs(fract(vUv.y * 25.0) - 0.5);
          grid = max(step(0.46, lx), step(0.46, ly));
          if (grid < 0.5) discard;
          // Animated color sweep
          float sweep = sin(vUv.x * 3.14 + uTime * 0.5) * 0.5 + 0.5;
          vec3 col = mix(uColor2, uColor1, sweep);
          float alpha = vElevation * 0.2 * grid;
          // Pulse brightness near mouse
          alpha *= 1.0 + sweep * 0.15;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const grid = new THREE.Mesh(gridGeometry, gridMaterial);
    grid.rotation.x = -Math.PI * 0.38;
    grid.position.y = -5.5;
    grid.position.z = -3;
    scene.add(grid);
    scene.userData.grid = grid;
    scene.userData.gridMaterial = gridMaterial;
  }

  // --- Generate brain-shaped distribution ---
  function generateBrainPosition() {
    const type = Math.random();
    let x, y, z;

    if (type < 0.30) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.7 + Math.random() * 0.5;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.2 - 0.55;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.9 + 0.15;
      z = r * Math.cos(phi) * 0.85;
    } else if (type < 0.60) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.7 + Math.random() * 0.5;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.2 + 0.55;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.9 + 0.15;
      z = r * Math.cos(phi) * 0.85;
    } else if (type < 0.72) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.18 + Math.random() * 0.25;
      x = r * Math.cos(theta);
      y = -0.8 - Math.random() * 0.7;
      z = r * Math.sin(theta);
    } else if (type < 0.82) {
      x = (Math.random() - 0.5) * 0.8;
      y = 0.35 + Math.random() * 0.4;
      z = (Math.random() - 0.5) * 0.5;
    } else if (type < 0.90) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.4;
      x = r * Math.cos(theta) * 0.85;
      y = -0.45 + Math.random() * 0.35;
      z = r * Math.sin(theta) - 0.65;
    } else {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.3 + Math.random() * 1.2;
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

  const colors = [
    new THREE.Color(0xD32F2F),
    new THREE.Color(0xFF5252),
    new THREE.Color(0x00E5FF),
    new THREE.Color(0x00B8D4),
    new THREE.Color(0x7C4DFF),
    new THREE.Color(0xE8E8F0),
    new THREE.Color(0xFF8A80),
  ];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pos = generateBrainPosition();
    particlePositions[i * 3] = pos.x;
    particlePositions[i * 3 + 1] = pos.y;
    particlePositions[i * 3 + 2] = pos.z;
    basePositions.push(pos.clone());

    const colorRoll = Math.random();
    let color;
    if (colorRoll < 0.28) {
      color = colors[0]; particleSizes[i] = 2.2 + Math.random() * 3;
    } else if (colorRoll < 0.42) {
      color = colors[1]; particleSizes[i] = 1.8 + Math.random() * 2.5;
    } else if (colorRoll < 0.58) {
      color = colors[2]; particleSizes[i] = 1.8 + Math.random() * 2.5;
    } else if (colorRoll < 0.66) {
      color = colors[3]; particleSizes[i] = 1.2 + Math.random() * 2;
    } else if (colorRoll < 0.74) {
      color = colors[4]; particleSizes[i] = 1.5 + Math.random() * 2;
    } else if (colorRoll < 0.87) {
      color = colors[5]; particleSizes[i] = 1.2 + Math.random() * 2;
    } else {
      color = colors[6]; particleSizes[i] = 1 + Math.random() * 1.8;
    }

    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;
    particlePulse[i] = Math.random() * Math.PI * 2;

    velocities.push({
      x: (Math.random() - 0.5) * 0.008,
      y: (Math.random() - 0.5) * 0.008,
      z: (Math.random() - 0.5) * 0.006
    });
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
  particleGeometry.setAttribute('pulse', new THREE.BufferAttribute(particlePulse, 1));

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouseSpeed: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      attribute float pulse;
      varying vec3 vColor;
      varying float vSize;
      uniform float uTime;
      uniform float uMouseSpeed;

      void main() {
        vColor = color;
        vSize = size;
        // Faster, more energetic pulsing
        float pulseFactor = 1.0 + sin(uTime * 2.8 + pulse) * 0.3;
        // React to mouse speed - particles flare when mouse moves fast
        pulseFactor += uMouseSpeed * 2.0;
        float finalSize = size * pulseFactor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = finalSize * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSize;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.12, dist);
        float glow = exp(-dist * 4.0) * 0.8;
        float halo = exp(-dist * 9.0) * 0.5;
        vec3 finalColor = vColor + vColor * (core * 1.8 + halo);
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * 0.85;
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

  // --- Connection Lines ---
  const linePositions = new Float32Array(MAX_CONNECTIONS * 6);
  const lineColors = new Float32Array(MAX_CONNECTIONS * 6);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));
  lineGeometry.setDrawRange(0, 0);

  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // --- Background ambient particles (more of them, faster drift) ---
  const bgParticleCount = isMobile ? 100 : 280;
  const bgPositions = new Float32Array(bgParticleCount * 3);
  const bgSizes = new Float32Array(bgParticleCount);
  const bgColorArr = new Float32Array(bgParticleCount * 3);

  for (let i = 0; i < bgParticleCount; i++) {
    bgPositions[i * 3] = (Math.random() - 0.5) * 50;
    bgPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    bgPositions[i * 3 + 2] = (Math.random() - 0.5) * 25 - 5;
    bgSizes[i] = 0.3 + Math.random() * 1.5;
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
        // Faster, more noticeable drift
        pos.y += sin(uTime * 0.4 + position.x * 0.5) * 0.6;
        pos.x += cos(uTime * 0.3 + position.y * 0.4) * 0.5;
        pos.z += sin(uTime * 0.2 + position.x * 0.3) * 0.3;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (130.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        // Twinkling effect
        vAlpha = 0.06 + sin(uTime * 1.5 + position.x * 2.0 + position.y) * 0.04 + 0.03;
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

  scene.add(new THREE.Points(bgGeometry, bgMaterial));

  // --- Energy pulse rings (new effect) ---
  const ringCount = 3;
  const rings = [];
  for (let r = 0; r < ringCount; r++) {
    const ringGeo = new THREE.RingGeometry(0.1, 0.15, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: r % 2 === 0 ? 0x00E5FF : 0xD32F2F,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.userData = { phase: r * (Math.PI * 2 / ringCount), speed: 0.8 + r * 0.3 };
    scene.add(ring);
    rings.push(ring);
  }

  // --- Animation Loop ---
  let time = 0;
  let smoothMouseSpeed = 0;
  const clock = new THREE.Clock();

  function updateConnections() {
    let lineIndex = 0;
    const positions = particleGeometry.attributes.position.array;
    const connectionDist2 = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

    for (let i = 0; i < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];

      for (let j = i + 1; j < PARTICLE_COUNT && lineIndex < MAX_CONNECTIONS; j++) {
        const dx = ix - positions[j * 3];
        const dy = iy - positions[j * 3 + 1];
        const dz = iz - positions[j * 3 + 2];
        const dist2 = dx * dx + dy * dy + dz * dz;

        if (dist2 < connectionDist2) {
          const dist = Math.sqrt(dist2);
          const alpha = 1 - (dist / CONNECTION_DISTANCE);

          // Faster, more energetic pulse
          const pulse = (Math.sin(time * 6 + (i + j) * 0.1) * 0.5 + 0.5) * 0.4 + 0.25;
          const intensity = alpha * pulse * (1 + smoothMouseSpeed * 3);

          // Animated color cycling
          const blend = Math.sin((i - j) * 0.04 + time * 0.8) * 0.5 + 0.5;
          const cr = (1 - blend) * 0.9 + blend * 0.0;
          const cg = (1 - blend) * 0.15 + blend * 0.9;
          const cb = (1 - blend) * 0.15 + blend * 1.0;

          const li = lineIndex * 6;
          linePositions[li]     = ix;
          linePositions[li + 1] = iy;
          linePositions[li + 2] = iz;
          linePositions[li + 3] = positions[j * 3];
          linePositions[li + 4] = positions[j * 3 + 1];
          linePositions[li + 5] = positions[j * 3 + 2];

          lineColors[li]     = cr * intensity;
          lineColors[li + 1] = cg * intensity * 0.65;
          lineColors[li + 2] = cb * intensity;
          lineColors[li + 3] = cr * intensity * 0.55;
          lineColors[li + 4] = cg * intensity * 0.35;
          lineColors[li + 5] = cb * intensity * 0.55;

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

    // FAST mouse tracking (much more responsive)
    const mouseEase = 0.15;
    mouse.x += (mouse.targetX - mouse.x) * mouseEase;
    mouse.y += (mouse.targetY - mouse.y) * mouseEase;

    // Smooth mouse speed for reactive effects
    smoothMouseSpeed += (mouse.speed - smoothMouseSpeed) * 0.1;
    smoothMouseSpeed *= 0.95;
    mouse.speed *= 0.9;

    // Update particle positions
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = basePositions[i];
      const vel = velocities[i];

      // More dynamic breathing motion
      const t = time;
      const breathX = Math.sin(t * 0.9 + i * 0.13) * 0.3 + Math.sin(t * 2.1 + i * 0.07) * 0.08;
      const breathY = Math.cos(t * 0.7 + i * 0.19) * 0.25 + Math.cos(t * 1.8 + i * 0.11) * 0.08;
      const breathZ = Math.sin(t * 0.5 + i * 0.23) * 0.18;

      // STRONG mouse influence - particles chase the mouse
      const normX = base.x / (BRAIN_SCALE * 1.2);
      const normY = base.y / (BRAIN_SCALE * 1.2);
      const proximity = Math.exp(-(normX * normX + normY * normY) * 0.8);
      const mouseInfluenceX = mouse.x * 1.2 * proximity;
      const mouseInfluenceY = -mouse.y * 0.8 * proximity;

      // Add turbulence when mouse is moving fast
      const turb = smoothMouseSpeed * 2;
      const turbX = Math.sin(t * 5 + i * 0.5) * turb;
      const turbY = Math.cos(t * 5 + i * 0.7) * turb;

      posArray[i * 3]     = base.x + breathX + vel.x * Math.sin(t * 1.5) * 2 + mouseInfluenceX + turbX;
      posArray[i * 3 + 1] = base.y + breathY + vel.y * Math.cos(t * 1.3) * 2 + mouseInfluenceY + turbY;
      posArray[i * 3 + 2] = base.z + breathZ + vel.z * Math.sin(t * 1.1) * 2;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    updateConnections();

    // FAST scene rotation following mouse
    const targetRotY = mouse.x * 0.5;
    const targetRotX = mouse.y * 0.25;
    particles.rotation.y += (targetRotY - particles.rotation.y) * 0.12;
    particles.rotation.x += (targetRotX - particles.rotation.x) * 0.12;
    lines.rotation.y = particles.rotation.y;
    lines.rotation.x = particles.rotation.x;

    // Visible auto-rotation
    const autoRot = time * 0.12;
    particles.rotation.y += autoRot * delta;
    lines.rotation.y += autoRot * delta;

    // Animate energy pulse rings
    for (const ring of rings) {
      const phase = ring.userData.phase;
      const spd = ring.userData.speed;
      const cycle = (time * spd + phase) % (Math.PI * 2);
      const scale = 0.5 + (cycle / (Math.PI * 2)) * 8;
      ring.scale.set(scale, scale, scale);
      ring.material.opacity = Math.max(0, 0.25 - (cycle / (Math.PI * 2)) * 0.25);
      ring.rotation.x = Math.PI * -0.15;
      ring.position.y = 0.3;
    }

    // Update shader uniforms
    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uMouseSpeed.value = smoothMouseSpeed;
    bgMaterial.uniforms.uTime.value = time;

    if (scene.userData.gridMaterial) {
      scene.userData.gridMaterial.uniforms.uTime.value = time;
      scene.userData.gridMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y);
    }

    renderer.render(scene, camera);
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', onResize);
  animate();

})();
