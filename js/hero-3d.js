/**
 * Brainstorm AGI - Hero 3D Neural Network Scene
 * Interactive particle brain/neural network using Three.js
 */

import * as THREE from 'three';

(function() {
  const container = document.getElementById('hero-canvas');
  if (!container) return;

  // --- Configuration ---
  const isMobile = window.innerWidth < 768;
  const PARTICLE_COUNT = isMobile ? 200 : 600;
  const CONNECTION_DISTANCE = isMobile ? 2.5 : 2.2;
  const MAX_CONNECTIONS = isMobile ? 300 : 1200;
  const BRAIN_SCALE = isMobile ? 3.5 : 5;

  // --- Scene Setup ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 12);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // --- Mouse tracking ---
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

  document.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // --- Generate brain-shaped distribution ---
  function generateBrainPosition() {
    // Create a stylized brain/neural network shape using overlapping spheres
    const type = Math.random();
    let x, y, z;

    if (type < 0.35) {
      // Left hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.8 + Math.random() * 0.4;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.1 - 0.5;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.85 + 0.2;
      z = r * Math.cos(phi) * 0.8;
    } else if (type < 0.7) {
      // Right hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.8 + Math.random() * 0.4;
      x = r * Math.sin(phi) * Math.cos(theta) * 1.1 + 0.5;
      y = r * Math.sin(phi) * Math.sin(theta) * 0.85 + 0.2;
      z = r * Math.cos(phi) * 0.8;
    } else if (type < 0.82) {
      // Brain stem
      const theta = Math.random() * Math.PI * 2;
      const r = 0.2 + Math.random() * 0.2;
      x = r * Math.cos(theta);
      y = -0.8 - Math.random() * 0.6;
      z = r * Math.sin(theta);
    } else if (type < 0.92) {
      // Central bridge (corpus callosum area)
      x = (Math.random() - 0.5) * 0.6;
      y = 0.4 + Math.random() * 0.3;
      z = (Math.random() - 0.5) * 0.4;
    } else {
      // Floating particles around
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.5 + Math.random() * 0.8;
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
  const velocities = [];
  const basePositions = [];

  const redColor = new THREE.Color(0xD32F2F);
  const brightRedColor = new THREE.Color(0xFF5252);
  const whiteColor = new THREE.Color(0xFFFFFF);
  const dimWhiteColor = new THREE.Color(0x8899AA);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pos = generateBrainPosition();
    particlePositions[i * 3] = pos.x;
    particlePositions[i * 3 + 1] = pos.y;
    particlePositions[i * 3 + 2] = pos.z;

    basePositions.push(pos.clone());

    // Color: mix of red nodes, bright red, white, and dim white
    const colorRoll = Math.random();
    let color;
    if (colorRoll < 0.25) {
      color = redColor;
      particleSizes[i] = 3 + Math.random() * 4;
    } else if (colorRoll < 0.4) {
      color = brightRedColor;
      particleSizes[i] = 2 + Math.random() * 3;
    } else if (colorRoll < 0.65) {
      color = whiteColor;
      particleSizes[i] = 1.5 + Math.random() * 2.5;
    } else {
      color = dimWhiteColor;
      particleSizes[i] = 1 + Math.random() * 2;
    }

    particleColors[i * 3] = color.r;
    particleColors[i * 3 + 1] = color.g;
    particleColors[i * 3 + 2] = color.b;

    velocities.push({
      x: (Math.random() - 0.5) * 0.003,
      y: (Math.random() - 0.5) * 0.003,
      z: (Math.random() - 0.5) * 0.003
    });
  }

  // Particle geometry
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));

  // Particle shader material for glow effect
  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vSize;
      uniform float uTime;
      void main() {
        vColor = color;
        vSize = size;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (200.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vSize;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
        // Glow effect
        float glow = exp(-dist * 4.0) * 0.6;
        vec3 finalColor = vColor + vColor * glow;
        gl_FragColor = vec4(finalColor, alpha * 0.85);
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
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lines);

  // --- Ambient floating particles (background) ---
  const bgParticleCount = isMobile ? 50 : 150;
  const bgPositions = new Float32Array(bgParticleCount * 3);
  const bgSizes = new Float32Array(bgParticleCount);

  for (let i = 0; i < bgParticleCount; i++) {
    bgPositions[i * 3] = (Math.random() - 0.5) * 30;
    bgPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    bgPositions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;
    bgSizes[i] = 0.5 + Math.random() * 1;
  }

  const bgGeometry = new THREE.BufferGeometry();
  bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));
  bgGeometry.setAttribute('size', new THREE.BufferAttribute(bgSizes, 1));

  const bgMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        pos.y += sin(uTime * 0.3 + position.x * 0.5) * 0.3;
        pos.x += cos(uTime * 0.2 + position.y * 0.3) * 0.2;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (150.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = 0.15 + sin(uTime + position.x + position.y) * 0.1;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = (1.0 - smoothstep(0.1, 0.5, dist)) * vAlpha;
        gl_FragColor = vec4(0.6, 0.65, 0.75, alpha);
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

          // Pulsing energy effect
          const pulse = (Math.sin(time * 3 + (i + j) * 0.1) * 0.5 + 0.5) * 0.3 + 0.2;
          const intensity = alpha * pulse;

          // Color: fade from red to white based on distance
          const r = 0.8 + intensity * 0.2;
          const g = 0.2 + (1 - alpha) * 0.4;
          const b = 0.2 + (1 - alpha) * 0.4;

          const li = lineIndex * 6;
          linePositions[li] = ix;
          linePositions[li + 1] = iy;
          linePositions[li + 2] = iz;
          linePositions[li + 3] = jx;
          linePositions[li + 4] = jy;
          linePositions[li + 5] = jz;

          lineColors[li] = r;
          lineColors[li + 1] = g;
          lineColors[li + 2] = b;
          lineColors[li + 3] = r * 0.7;
          lineColors[li + 4] = g * 0.7;
          lineColors[li + 5] = b * 0.7;

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

    // Smooth mouse follow
    mouse.x += (mouse.targetX - mouse.x) * 0.05;
    mouse.y += (mouse.targetY - mouse.y) * 0.05;

    // Update particle positions (gentle breathing motion)
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = basePositions[i];
      const vel = velocities[i];

      // Organic movement
      posArray[i * 3] = base.x + Math.sin(time * 0.5 + i * 0.1) * 0.15 + vel.x * Math.sin(time);
      posArray[i * 3 + 1] = base.y + Math.cos(time * 0.4 + i * 0.15) * 0.15 + vel.y * Math.cos(time);
      posArray[i * 3 + 2] = base.z + Math.sin(time * 0.3 + i * 0.2) * 0.1 + vel.z * Math.sin(time * 0.7);
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Update connections
    updateConnections();

    // Scene rotation following mouse
    particles.rotation.y = mouse.x * 0.3;
    particles.rotation.x = mouse.y * 0.15;
    lines.rotation.y = mouse.x * 0.3;
    lines.rotation.x = mouse.y * 0.15;

    // Gentle auto-rotation
    const autoRotY = time * 0.05;
    particles.rotation.y += autoRotY;
    lines.rotation.y += autoRotY;

    // Update shader time
    particleMaterial.uniforms.uTime.value = time;
    bgMaterial.uniforms.uTime.value = time;

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
