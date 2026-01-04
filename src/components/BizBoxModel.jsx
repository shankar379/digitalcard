import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './BizBoxModel.css';

// Smooth easing functions
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

// Linear interpolation
const lerp = (start, end, t) => start + (end - start) * t;

const BizBoxModel = () => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const modelRef = useRef(null);
  const bizCardRef = useRef(null);
  const bizCardMeshRef = useRef(null);
  const chipMeshRef = useRef(null);
  const originalMaterialsRef = useRef({});
  const innerBoxBoneRef = useRef(null);
  const mixerRef = useRef(null);
  const animationActionRef = useRef(null);
  const animationClipRef = useRef(null);
  const animationFrameRef = useRef(null);
  const clockRef = useRef(new THREE.Clock());

  // Loading state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const loadingProgressRef = useRef({ bizbox: 0, bizcard: 0 });
  const showPreloaderRef = useRef(true); // Ref for animation loop

  // Scroll tracking
  const scrollProgressRef = useRef(0);
  const targetScrollRef = useRef(0);
  const timeRef = useRef(0);

  // Floating animation refs
  const floatPhaseRef = useRef(0);
  const initialModelY = useRef(0);

  // Card initial transform
  const cardInitialPos = useRef(new THREE.Vector3());
  const cardInitialRot = useRef(new THREE.Euler());

  // Scroll indicator ref
  const scrollIndicatorRef = useRef(null);

  // Intro camera animation refs
  const introProgressRef = useRef(0);
  const introCompleteRef = useRef(false);
  const introDuration = 4; // Duration in seconds (slower)

  // Camera positions for intro animation
  const cameraStartPos = { x: 0, y: 12, z: 1 };  // Start from higher top
  const cameraEndPos = { x: 0, y: 1, z: 5.5 };   // Final position

  const handleScroll = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollTop = window.scrollY;
    targetScrollRef.current = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera - starts from top position for intro animation
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    // Start camera at intro position (top)
    camera.position.set(cameraStartPos.x, cameraStartPos.y, cameraStartPos.z);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // === LIGHTING SETUP ===
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa78bfa, 0.4);
    fillLight.position.set(-5, 3, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x8b5cf6, 0.3);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    const bottomLight = new THREE.DirectionalLight(0x3b82f6, 0.2);
    bottomLight.position.set(0, -3, 2);
    scene.add(bottomLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.6);
    frontLight.position.set(0, 2, 10);
    scene.add(frontLight);

    // === STAGE (Concentric rings with center cylinder - sharp edges) ===
    const stageRings = [];
    const ringCount = 4;
    const baseY = -1.2;
    const ringHeight = 0.08;
    const gap = 0.03; // Gap between rings

    // Create white material for all rings
    const whiteMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.4,
      envMapIntensity: 0.8
    });

    // Helper function to create sharp-edged ring using ExtrudeGeometry
    const createSharpRing = (innerRadius, outerRadius, height) => {
      const segments = 128; // High poly count for smooth circular shape
      const shape = new THREE.Shape();
      shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false, segments);
      const hole = new THREE.Path();
      hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true, segments);
      shape.holes.push(hole);

      const extrudeSettings = {
        depth: height,
        bevelEnabled: false,
        curveSegments: segments
      };

      return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    };

    // Center cylinder (innermost)
    const centerRadius = 0.5;
    const centerGeometry = new THREE.CylinderGeometry(centerRadius, centerRadius, ringHeight, 128);
    const centerCylinder = new THREE.Mesh(centerGeometry, whiteMaterial.clone());
    centerCylinder.position.set(0, baseY, 0);
    centerCylinder.receiveShadow = true;
    centerCylinder.castShadow = true;
    centerCylinder.userData = { baseY: baseY, floatOffset: 0, floatSpeed: 0.8 };
    scene.add(centerCylinder);
    stageRings.push(centerCylinder);

    // Blue glow material for inner walls (bright core)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 1,
      side: THREE.BackSide
    });

    // Outer glow layer (soft bloom effect)
    const glowOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.4,
      side: THREE.BackSide
    });

    // Create concentric rings around the center with sharp edges
    // Each outer ring is progressively larger
    const baseRingWidth = 0.35; // Starting width for innermost ring
    const ringWidthGrowth = 0.15; // Each ring grows by this much
    let currentInnerRadius = centerRadius + gap;

    for (let i = 0; i < ringCount; i++) {
      const ringWidth = baseRingWidth + (i * ringWidthGrowth); // Progressive width
      const innerRadius = currentInnerRadius;
      const outerRadius = innerRadius + ringWidth;
      currentInnerRadius = outerRadius + gap; // Next ring starts after this one

      // Use ExtrudeGeometry for sharp-edged rings
      const ringGeometry = createSharpRing(innerRadius, outerRadius, ringHeight);

      const ring = new THREE.Mesh(ringGeometry, whiteMaterial.clone());
      ring.rotation.x = -Math.PI / 2; // Lay flat
      ring.position.set(0, baseY - ringHeight / 2, 0);
      ring.receiveShadow = true;
      ring.castShadow = true;

      // Add blue glow on inner wall of ring (cylinder inside)
      // Core glow layer
      const glowGeometry = new THREE.CylinderGeometry(innerRadius, innerRadius, ringHeight * 1.2, 128, 1, true);
      const glow = new THREE.Mesh(glowGeometry, glowMaterial.clone());
      glow.position.set(0, baseY, 0);
      scene.add(glow);

      // Outer soft glow layer (larger, more transparent)
      const glowOuterGeometry = new THREE.CylinderGeometry(innerRadius - 0.02, innerRadius - 0.02, ringHeight * 1.5, 128, 1, true);
      const glowOuter = new THREE.Mesh(glowOuterGeometry, glowOuterMaterial.clone());
      glowOuter.position.set(0, baseY, 0);
      scene.add(glowOuter);

      // Store animation data - each ring has different speed/offset
      ring.userData = {
        baseY: baseY - ringHeight / 2,
        floatOffset: (i + 1) * 0.8, // Offset for wave effect
        floatSpeed: 0.6 + (i * 0.15), // Slightly different speeds
        glow: glow, // Reference to glow for animation
        glowOuter: glowOuter,
        glowBaseY: baseY
      };

      scene.add(ring);
      stageRings.push(ring);
    }

    // Add glow to center cylinder outer wall
    const centerGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide
    });
    const centerGlowGeometry = new THREE.CylinderGeometry(centerRadius, centerRadius, ringHeight * 1.2, 128, 1, true);
    const centerGlow = new THREE.Mesh(centerGlowGeometry, centerGlowMaterial);
    centerGlow.position.set(0, baseY, 0);
    scene.add(centerGlow);

    // Outer glow for center
    const centerGlowOuterMaterial = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.4,
      side: THREE.FrontSide
    });
    const centerGlowOuterGeometry = new THREE.CylinderGeometry(centerRadius + 0.02, centerRadius + 0.02, ringHeight * 1.5, 128, 1, true);
    const centerGlowOuter = new THREE.Mesh(centerGlowOuterGeometry, centerGlowOuterMaterial);
    centerGlowOuter.position.set(0, baseY, 0);
    scene.add(centerGlowOuter);

    stageRings[0].userData.glow = centerGlow;
    stageRings[0].userData.glowOuter = centerGlowOuter;
    stageRings[0].userData.glowBaseY = baseY;

    // Store reference to animate rings
    const stageRingsRef = stageRings;

    // === PROCEDURAL TERRAIN & MOUNTAINS ===

    // Set scene background to match fog
    scene.background = new THREE.Color(0xd8dce8);

    // Improved Perlin-like noise function with FIXED seed (consistent terrain)
    // Fixed permutation table - always produces same terrain
    const permutation = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
      8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
      35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
      134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
      55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,
      18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,
      250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,
      189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,
      172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,
      228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,
      107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,
      138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];
    const perm = [...permutation, ...permutation];

    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp2 = (a, b, t) => a + t * (b - a);
    const grad = (hash, x, y) => {
      const h = hash & 3;
      const u = h < 2 ? x : y;
      const v = h < 2 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
    };

    const perlin2D = (x, y) => {
      const X = Math.floor(x) & 255;
      const Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x);
      const yf = y - Math.floor(y);
      const u = fade(xf);
      const v = fade(yf);
      const aa = perm[perm[X] + Y];
      const ab = perm[perm[X] + Y + 1];
      const ba = perm[perm[X + 1] + Y];
      const bb = perm[perm[X + 1] + Y + 1];
      return lerp2(
        lerp2(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
        lerp2(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
        v
      );
    };

    // Fractal Brownian Motion for natural terrain
    const fbm = (x, y, octaves = 6, lacunarity = 2, gain = 0.5) => {
      let value = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxValue = 0;

      for (let i = 0; i < octaves; i++) {
        value += amplitude * perlin2D(x * frequency, y * frequency);
        maxValue += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
      }

      return value / maxValue;
    };

    // Add atmospheric fog
    scene.fog = new THREE.FogExp2(0xd8dce8, 0.025);

    // Create 3D terrain mesh
    const terrainSize = 80;
    const terrainSegments = 150;
    const terrainGeometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainSegments, terrainSegments);
    const terrainPositions = terrainGeometry.attributes.position;

    for (let i = 0; i < terrainPositions.count; i++) {
      const x = terrainPositions.getX(i);
      const y = terrainPositions.getY(i);
      const distFromCenter = Math.sqrt(x * x + y * y);

      // Base terrain with multiple noise layers
      let height = 0;

      // Large rolling hills
      height += fbm(x * 0.02 + 5, y * 0.02 + 5, 4, 2, 0.5) * 3;

      // Medium detail
      height += fbm(x * 0.05, y * 0.05, 3, 2, 0.5) * 1;

      // Small bumps
      height += fbm(x * 0.15, y * 0.15, 2, 2, 0.5) * 0.3;

      // Flatten center area (where rings are)
      const flatRadius = 8;
      const flattenFactor = Math.max(0, 1 - Math.pow(Math.max(0, flatRadius - distFromCenter) / flatRadius, 2));
      height *= flattenFactor;

      // Add mountains at the back (negative Y in plane space = negative Z in world)
      if (y < -10) {
        const mountainFactor = Math.pow(Math.abs(y + 10) / 30, 1.5);
        const mountainNoise = fbm(x * 0.03 + 10, y * 0.02, 5, 2.2, 0.55);
        const ridgeNoise = Math.abs(fbm(x * 0.05, y * 0.03 + 20, 4, 2, 0.5));
        height += (mountainNoise * 8 + ridgeNoise * 12) * mountainFactor;
      }

      terrainPositions.setZ(i, height);
    }

    terrainGeometry.computeVertexNormals();

    // Terrain material with vertex colors for snow effect
    const terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0xcdd1dc,
      metalness: 0.1,
      roughness: 0.85,
      flatShading: false,
      envMapIntensity: 0.3
    });

    const terrain = new THREE.Mesh(terrainGeometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.set(0, baseY - 0.35, -10);
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);

    // Add distant mountain backdrop (far layer) - 10x HEIGHT
    const backdropGeometry = new THREE.PlaneGeometry(80, 35, 200, 1);
    const backdropPositions = backdropGeometry.attributes.position;

    for (let i = 0; i < backdropPositions.count; i++) {
      const x = backdropPositions.getX(i);
      const y = backdropPositions.getY(i);

      if (y > 0) {
        // Sharp peaks - DRAMATIC HEIGHT
        const peak1 = Math.exp(-Math.pow((x + 15) * 0.10, 2)) * 320;
        const peak2 = Math.exp(-Math.pow((x - 10) * 0.09, 2)) * 420;
        const peak3 = Math.exp(-Math.pow((x + 25) * 0.12, 2)) * 280;
        const peak4 = Math.exp(-Math.pow((x - 22) * 0.11, 2)) * 300;
        const peak5 = Math.exp(-Math.pow((x + 3) * 0.10, 2)) * 380;
        const peak6 = Math.exp(-Math.pow((x - 30) * 0.11, 2)) * 260;
        const peak7 = Math.exp(-Math.pow((x + 35) * 0.12, 2)) * 240;
        // Sharp noise for jagged edges
        const sharpNoise = fbm(x * 0.3, 0, 5, 2.5, 0.6) * 100;
        const ridgeNoise = Math.abs(fbm(x * 0.5, 0, 4, 2, 0.5)) * 70;

        const mountainHeight = Math.max(peak1, peak2, peak3, peak4, peak5, peak6, peak7) + sharpNoise + ridgeNoise;
        backdropPositions.setY(i, y + mountainHeight);
      }
    }

    backdropGeometry.computeVertexNormals();

    const backdropMaterial = new THREE.MeshStandardMaterial({
      color: 0xc0c4d0,
      metalness: 0,
      roughness: 1,
      side: THREE.DoubleSide
    });

    const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial);
    backdrop.position.set(0, baseY + 1, -35);
    scene.add(backdrop);

    // Second backdrop layer - TALL SHARP MOUNTAINS - 10x HEIGHT
    const backdrop2Geometry = new THREE.PlaneGeometry(100, 50, 250, 1);
    const backdrop2Positions = backdrop2Geometry.attributes.position;

    for (let i = 0; i < backdrop2Positions.count; i++) {
      const x = backdrop2Positions.getX(i);
      const y = backdrop2Positions.getY(i);

      if (y > 0) {
        // Very sharp tall peaks - EPIC DRAMATIC MOUNTAINS
        const peak1 = Math.exp(-Math.pow((x + 15) * 0.12, 2)) * 650;
        const peak2 = Math.exp(-Math.pow((x - 10) * 0.10, 2)) * 900;
        const peak3 = Math.exp(-Math.pow(x * 0.11, 2)) * 800;
        const peak4 = Math.exp(-Math.pow((x - 25) * 0.13, 2)) * 550;
        const peak5 = Math.exp(-Math.pow((x + 30) * 0.12, 2)) * 700;
        const peak6 = Math.exp(-Math.pow((x + 5) * 0.10, 2)) * 850;
        const peak7 = Math.exp(-Math.pow((x - 35) * 0.13, 2)) * 500;
        const peak8 = Math.exp(-Math.pow((x - 45) * 0.14, 2)) * 450;
        const peak9 = Math.exp(-Math.pow((x + 42) * 0.13, 2)) * 480;
        // Sharp jagged noise for dramatic edges
        const sharpNoise = fbm(x * 0.4, 0, 6, 2.5, 0.55) * 150;
        const ridgeNoise = Math.abs(fbm(x * 0.6 + 10, 0, 5, 2, 0.5)) * 120;
        const microDetail = fbm(x * 0.8, 0, 3, 2, 0.5) * 60;

        const mountainHeight = Math.max(peak1, peak2, peak3, peak4, peak5, peak6, peak7, peak8, peak9) + sharpNoise + ridgeNoise + microDetail;
        backdrop2Positions.setY(i, y + mountainHeight);
      }
    }

    backdrop2Geometry.computeVertexNormals();

    const backdrop2Material = new THREE.MeshStandardMaterial({
      color: 0xaeb2be,
      metalness: 0,
      roughness: 1,
      side: THREE.DoubleSide
    });

    const backdrop2 = new THREE.Mesh(backdrop2Geometry, backdrop2Material);
    backdrop2.position.set(0, baseY + 0, -25);
    scene.add(backdrop2);

    // === PARTICLE FOG SYSTEM - Noise-based scattered particles moving left to right ===
    const fogParticleCount = 12000;
    const fogSpreadX = 100; // Width of fog area
    const fogSpreadZ = 50;  // Depth of fog area
    const fogSpeed = 3.5;   // Fast movement speed

    // Create particle geometry
    const fogGeometry = new THREE.BufferGeometry();
    const fogPositions = new Float32Array(fogParticleCount * 3);
    const fogSizes = new Float32Array(fogParticleCount);
    const fogOpacities = new Float32Array(fogParticleCount);

    // Use noise to create patchy fog distribution
    for (let i = 0; i < fogParticleCount; i++) {
      const x = (Math.random() - 0.5) * fogSpreadX;
      const z = -Math.random() * fogSpreadZ - 3; // Behind center, towards mountains

      // Use perlin noise to determine if this area has fog
      const noiseVal = perlin2D(x * 0.08, z * 0.08);
      const noiseVal2 = perlin2D(x * 0.15 + 100, z * 0.15 + 100);
      const combinedNoise = (noiseVal + noiseVal2 * 0.5) / 1.5;

      // Only place particles where noise is above threshold (patchy effect)
      if (combinedNoise > -0.2) {
        // Height varies slightly based on noise
        const y = baseY - 0.2 + Math.random() * 0.4 + combinedNoise * 0.3;

        fogPositions[i * 3] = x;
        fogPositions[i * 3 + 1] = y;
        fogPositions[i * 3 + 2] = z;

        // Particle size - smaller particles, varied by noise
        const distanceFactor = Math.abs(z) / fogSpreadZ;
        fogSizes[i] = (0.08 + Math.random() * 0.15 + distanceFactor * 0.12) * (0.8 + combinedNoise * 0.3);

        // Opacity based on noise and distance
        fogOpacities[i] = (0.15 + Math.random() * 0.25) * (0.6 + combinedNoise * 0.4);
      } else {
        // Place particle far away (effectively hidden)
        fogPositions[i * 3] = -1000;
        fogPositions[i * 3 + 1] = -1000;
        fogPositions[i * 3 + 2] = -1000;
        fogSizes[i] = 0;
        fogOpacities[i] = 0;
      }
    }

    fogGeometry.setAttribute('position', new THREE.BufferAttribute(fogPositions, 3));
    fogGeometry.setAttribute('size', new THREE.BufferAttribute(fogSizes, 1));
    fogGeometry.setAttribute('opacity', new THREE.BufferAttribute(fogOpacities, 1));

    // Custom shader material for fog particles
    const fogMaterial = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xe8ecf4) },
        time: { value: 0 }
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (150.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vOpacity;
        void main() {
          // Soft circular particle
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    const fogParticles = new THREE.Points(fogGeometry, fogMaterial);
    scene.add(fogParticles);

    // Store reference for animation
    const fogParticlesRef = { particles: fogParticles, speed: fogSpeed, spreadX: fogSpreadX };

    const loader = new GLTFLoader();

    // Load BizBox model first
    loader.load(
      '/bizbox.glb',
      (gltf) => {
        const model = gltf.scene;

        // Center and scale the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.2 / maxDim;

        model.scale.multiplyScalar(scale);
        model.position.sub(center.multiplyScalar(scale));

        initialModelY.current = model.position.y;

        // Find bones and meshes
        let allBones = [];
        model.traverse((child) => {
          // Collect all bones
          if (child.isBone) {
            allBones.push(child);
            console.log(`Found Bone: ${child.name}`);
          }

          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                if (mat) {
                  mat.envMapIntensity = 0.8;
                  mat.needsUpdate = true;
                }
              });
            }
          }
        });

        // Log all objects
        console.log('=== BizBox objects ===');
        model.traverse((child) => {
          console.log(`  ${child.name} (${child.type})`);
        });

        // Find the "Bone" bone to parent the card to
        model.traverse((child) => {
          if (child.isBone && child.name === 'Bone') {
            innerBoxBoneRef.current = child;
            console.log('Found Bone for card parenting');
          }
        });

        // === DEBUG SPHERE - RED (follows Bone003) ===
        // To enable for debugging: set debugSphere.visible = true
        const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red color
        const debugSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        debugSphere.name = 'debugSphere';
        debugSphere.visible = false; // Hidden by default - set to true for debugging
        scene.add(debugSphere);

        // Find Bone003 and parent sphere directly to it
        let boneRef = null;
        let skinnedMeshRef = null;

        model.traverse((child) => {
          // Find Bone003 (no dot in name)
          if (child.isBone && child.name === 'Bone003') {
            boneRef = child;
            console.log('Found Bone003 for sphere tracking', child);

            // Parent sphere directly to this bone
            child.add(debugSphere);
            debugSphere.position.set(0, 0, 0);
            console.log('Sphere parented to Bone003');
          }

          // Find SkinnedMesh to get skeleton
          if (child.isSkinnedMesh) {
            skinnedMeshRef = child;
          }
        });

        // Store references for animation loop
        window.debugSphereRef = debugSphere;
        window.boneRef = boneRef;
        window.skinnedMeshRef = skinnedMeshRef;

        // === DEBUG SPHERE - BLUE (follows Bone002) ===
        // To enable for debugging: set blueSphere.visible = true
        const blueSphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const blueSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0066ff }); // Blue color
        const blueSphere = new THREE.Mesh(blueSphereGeometry, blueSphereMaterial);
        blueSphere.name = 'blueSphere';
        blueSphere.visible = false; // Hidden by default - set to true for debugging
        scene.add(blueSphere);

        // Find Bone002 and parent blue sphere to it
        let bone002Ref = null;
        model.traverse((child) => {
          if (child.isBone && child.name === 'Bone002') {
            bone002Ref = child;
            console.log('Found Bone002 for blue sphere tracking', child);

            // Parent blue sphere directly to this bone - centered on bone
            child.add(blueSphere);
            // Position at center of the bone (adjust as needed)
            blueSphere.position.set(0, 0.9, 0);
            console.log('Blue sphere parented to Bone002');
          }
        });

        // Debug: Check if bone was found
        if (!bone002Ref) {
          console.warn('WARNING: Bone002 not found! Blue sphere will not follow animation.');
        }

        // Store reference
        window.blueSphereRef = blueSphere;
        window.bone002Ref = bone002Ref;

        // === ADD TEXT LABEL WITH BENT LINE POINTING TO RED SPHERE ===
        // Create dynamic text sprite with typing animation support
        const createDynamicTextSprite = (fontSize = 48) => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = 512;
          canvas.height = 128;

          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;

          const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            opacity: 1
          });

          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.scale.set(2, 0.5, 1);

          // Store canvas data for updates
          sprite.userData = {
            canvas: canvas,
            context: context,
            texture: texture,
            fontSize: fontSize,
            fullText: '',
            currentText: ''
          };

          return sprite;
        };

        // Function to update text with typing effect
        const updateTextSprite = (sprite, text, progress) => {
          // progress: 0 = no text, 1 = full text
          const { canvas, context, texture, fontSize } = sprite.userData;
          const charCount = Math.floor(text.length * Math.max(0, Math.min(1, progress)));
          const displayText = text.substring(0, charCount);

          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);

          // Draw text
          context.font = `bold ${fontSize}px Arial`;
          context.fillStyle = 'white';
          context.textAlign = 'left';
          context.textBaseline = 'middle';

          // Split text into lines
          const lines = displayText.split('\n');
          lines.forEach((line, index) => {
            context.fillText(line, 10, 40 + index * (fontSize + 5));
          });

          // Add cursor if not fully typed
          if (progress > 0 && progress < 1) {
            const lastLineIndex = lines.length - 1;
            const lastLine = lines[lastLineIndex] || '';
            const cursorX = 10 + context.measureText(lastLine).width + 2;
            const cursorY = 40 + lastLineIndex * (fontSize + 5);
            context.fillRect(cursorX, cursorY - fontSize/2, 3, fontSize);
          }

          texture.needsUpdate = true;
          sprite.userData.currentText = displayText;
        };

        // Create text labels for each sphere
        const redTextLabel = createDynamicTextSprite(48);
        scene.add(redTextLabel);
        redTextLabel.visible = false;

        // Store text animation data and update function
        window.updateTextSprite = updateTextSprite;
        window.textAnimationData = {
          red: {
            sprite: redTextLabel,
            text: 'OUTER_BOX\nBONE_003',
            startFrame: 0,
            typeEndFrame: 5,       // Typing animation over 5 frames
            deleteStartFrame: 25,  // Delete animation over 5 frames
            endFrame: 30,
            visible: false
          },
          blue: {
            sprite: null, // Will be set below
            text: 'OUTER_BOX\nBONE_002',
            startFrame: 70,
            typeEndFrame: 75,      // Typing animation over 5 frames
            deleteStartFrame: 95,  // Delete animation over 5 frames
            endFrame: 100,
            visible: false
          },
          green: {
            sprite: null, // Will be set below
            text: 'BIZCARD\nNFC_CHIP',
            startFrame: 110,
            typeEndFrame: 115,     // Typing animation over 5 frames
            deleteStartFrame: 145, // Delete animation over 5 frames
            endFrame: 150,
            // Alt text (scan qr code) - appears at same position after green text
            altText: 'SCAN THIS\nQR CODE',
            altStartFrame: 150,
            altTypeEndFrame: 155,  // Typing animation over 5 frames
            altDeleteStartFrame: 195, // Delete animation over 5 frames
            altEndFrame: 200,
            visible: false
          },
          nfcChip: {
            sprite: null, // Will be set in bizcard loader
            text: 'THIS NFC\nCHIP',
            startFrame: 200,
            typeEndFrame: 205,     // Typing animation over 5 frames
            deleteStartFrame: 245, // Delete animation over 5 frames
            endFrame: 250,
            visible: false
          }
        };

        // Use redTextLabel as the main reference
        const textLabel = redTextLabel;

        // Create bent line (two segments at 120 degree angle)
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });

        // Line points - will be updated in animation loop
        const linePoints = [
          new THREE.Vector3(0, 0, 0),      // Start (near sphere)
          new THREE.Vector3(0.5, 0.3, 0),  // Bend point
          new THREE.Vector3(1.5, 0.3, 0)   // End (near text)
        ];

        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const pointerLine = new THREE.Line(lineGeometry, lineMaterial);
        scene.add(pointerLine);
        pointerLine.visible = false; // Start hidden

        // Small dot at the start of line (touching sphere)
        const dotGeometry = new THREE.SphereGeometry(0.03, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const lineDot = new THREE.Mesh(dotGeometry, dotMaterial);
        scene.add(lineDot);
        lineDot.visible = false; // Start hidden

        // Store references for animation
        window.textLabelRef = textLabel;
        window.pointerLineRef = pointerLine;
        window.lineDotRef = lineDot;

        console.log('Text label and pointer line added');

        // === ADD TEXT LABEL WITH BENT LINE POINTING TO BLUE SPHERE (BONE002) ===
        const blueTextLabel = createDynamicTextSprite(48);
        scene.add(blueTextLabel);
        blueTextLabel.visible = false;
        window.textAnimationData.blue.sprite = blueTextLabel;

        // Create bent line for blue sphere
        const blueLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
        const blueLinePoints = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.6, 0.4, 0),
          new THREE.Vector3(1.6, 0.4, 0)
        ];
        const blueLineGeometry = new THREE.BufferGeometry().setFromPoints(blueLinePoints);
        const bluePointerLine = new THREE.Line(blueLineGeometry, blueLineMaterial);
        scene.add(bluePointerLine);
        bluePointerLine.visible = false;

        // Small dot at start of line
        const blueDotGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const blueDotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const blueLineDot = new THREE.Mesh(blueDotGeometry, blueDotMaterial);
        scene.add(blueLineDot);
        blueLineDot.visible = false;

        // Store references
        window.blueTextLabelRef = blueTextLabel;
        window.bluePointerLineRef = bluePointerLine;
        window.blueLineDotRef = blueLineDot;

        console.log('Blue sphere text label and pointer line added');

        // Rotate model to face the screen
        model.rotation.y = Math.PI + Math.PI / 2;

        scene.add(model);
        modelRef.current = model;

        // === ANIMATION SETUP ===
        if (gltf.animations && gltf.animations.length > 0) {
          console.log('Found animations:', gltf.animations.length);
          gltf.animations.forEach((clip, index) => {
            console.log(`Animation ${index}: "${clip.name}", Duration: ${clip.duration}s`);
          });

          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          const clip = gltf.animations[0];
          animationClipRef.current = clip;

          const action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce);
          action.clampWhenFinished = true;
          action.paused = true;
          action.play();
          animationActionRef.current = action;

          console.log('Animation clip duration:', clip.duration);
        }

        console.log('BizBox model loaded successfully');

        // Now load the BizCard model (only if not already loaded)
        if (bizCardRef.current) return;

        loader.load(
          '/bizcard_with_nfc_chip.glb',
          (cardGltf) => {
            if (bizCardRef.current) return; // Prevent duplicate loading
            const cardModel = cardGltf.scene;

            // Log card objects
            console.log('=== BizCard objects ===');
            cardModel.traverse((child) => {
              console.log(`  ${child.name} (${child.type})`);
            });

            // Enable shadows on card and store mesh references
            cardModel.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Store references to bizcard and chip meshes
                if (child.name === 'bizcard') {
                  bizCardMeshRef.current = child;
                  // Store original material properties
                  if (child.material) {
                    originalMaterialsRef.current.bizcard = {
                      color: child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff),
                      opacity: child.material.opacity !== undefined ? child.material.opacity : 1,
                      transparent: child.material.transparent || false
                    };
                    // Enable transparency for later animation
                    child.material.transparent = true;
                  }
                  console.log('Found bizcard mesh');
                }

                if (child.name === 'chip') {
                  chipMeshRef.current = child;
                  // Store original material properties
                  if (child.material) {
                    originalMaterialsRef.current.chip = {
                      color: child.material.color ? child.material.color.clone() : new THREE.Color(0xffffff)
                    };
                  }
                  console.log('Found chip mesh');
                }

                if (child.material) {
                  const materials = Array.isArray(child.material) ? child.material : [child.material];
                  materials.forEach((mat) => {
                    if (mat) {
                      mat.envMapIntensity = 1.0;
                      mat.needsUpdate = true;
                    }
                  });
                }
              }
            });

            // Scale card down by 10% (90% of original size)
            cardModel.scale.set(1, 1, 1);

            // Adjust card position and rotation (modify these values as needed)
            cardModel.position.x = -0.02;
            cardModel.position.y = 0.9;
            cardModel.position.z = 0;
            cardModel.rotation.x = 0;
            cardModel.rotation.y = 0;
            cardModel.rotation.z = 1.55;

            // Parent card to "Bone" so it follows the animation
            if (innerBoxBoneRef.current) {
              innerBoxBoneRef.current.add(cardModel);
              console.log('BizCard parented to Bone');
            } else {
              // Fallback: add to scene
              scene.add(cardModel);
              console.log('Warning: Bone not found, BizCard added to scene');
            }

            // Store initial transform for later animation phase
            cardInitialPos.current.copy(cardModel.position);
            cardInitialRot.current.copy(cardModel.rotation);

            bizCardRef.current = cardModel;

            // === DEBUG SPHERE - GREEN (follows BizCard model) ===
            // To enable for debugging: set greenSphere.visible = true
            const greenSphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
            const greenSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green color
            const greenSphere = new THREE.Mesh(greenSphereGeometry, greenSphereMaterial);
            greenSphere.name = 'greenDebugSphere';
            greenSphere.visible = false; // Hidden by default - set to true for debugging

            // Parent green sphere to bizcard model so it follows animation
            cardModel.add(greenSphere);
            greenSphere.position.set(0, 0, 0);
            console.log('Green sphere parented to BizCard');

            // Store reference
            window.greenSphereRef = greenSphere;

            // === ADD TEXT LABEL WITH BENT LINE POINTING TO GREEN SPHERE (BIZCARD) ===
            // Create dynamic text sprite for green sphere
            const createGreenTextSprite = (fontSize = 48) => {
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d');
              canvas.width = 512;
              canvas.height = 128;

              const texture = new THREE.CanvasTexture(canvas);
              texture.needsUpdate = true;

              const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthTest: false,
                opacity: 1
              });

              const sprite = new THREE.Sprite(spriteMaterial);
              sprite.scale.set(2, 0.5, 1);

              sprite.userData = {
                canvas: canvas,
                context: context,
                texture: texture,
                fontSize: fontSize,
                fullText: '',
                currentText: ''
              };

              return sprite;
            };

            // Create text label for bizcard
            const cardTextLabel = createGreenTextSprite(48);
            sceneRef.current.add(cardTextLabel);
            cardTextLabel.visible = false;

            // Set reference in animation data
            if (window.textAnimationData) {
              window.textAnimationData.green.sprite = cardTextLabel;
            }

            // Create bent line for bizcard
            const cardLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
            const cardLinePoints = [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0.6, 0.4, 0),
              new THREE.Vector3(1.6, 0.4, 0)
            ];
            const cardLineGeometry = new THREE.BufferGeometry().setFromPoints(cardLinePoints);
            const cardPointerLine = new THREE.Line(cardLineGeometry, cardLineMaterial);
            sceneRef.current.add(cardPointerLine);
            cardPointerLine.visible = false;

            // Small dot at start of line
            const cardDotGeometry = new THREE.SphereGeometry(0.05, 16, 16);
            const cardDotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const cardLineDot = new THREE.Mesh(cardDotGeometry, cardDotMaterial);
            sceneRef.current.add(cardLineDot);
            cardLineDot.visible = false;

            // Store references
            window.cardTextLabelRef = cardTextLabel;
            window.cardPointerLineRef = cardPointerLine;
            window.cardLineDotRef = cardLineDot;

            console.log('BizCard text label and pointer line added to scene');

            // === ADD TEXT LABEL WITH BENT LINE POINTING TO NFC CHIP (frames 200-250) ===
            // Create text label for NFC chip using same approach as green text
            const nfcTextLabel = createGreenTextSprite(48);
            sceneRef.current.add(nfcTextLabel);
            nfcTextLabel.visible = false;
            nfcTextLabel.scale.set(2.5, 0.7, 1);

            // Draw initial text on the sprite to ensure it works
            if (nfcTextLabel.userData && nfcTextLabel.userData.context) {
              const ctx = nfcTextLabel.userData.context;
              ctx.clearRect(0, 0, 512, 128);
              ctx.font = 'bold 48px Arial';
              ctx.fillStyle = 'white';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText('THIS NFC', 10, 40);
              ctx.fillText('CHIP', 10, 93);
              nfcTextLabel.userData.texture.needsUpdate = true;
              console.log('NFC text drawn on canvas');
            }

            // Set reference in animation data AND also store globally
            window.nfcTextLabelRef = nfcTextLabel;
            if (window.textAnimationData && window.textAnimationData.nfcChip) {
              window.textAnimationData.nfcChip.sprite = nfcTextLabel;
              console.log('NFC chip sprite assigned:', nfcTextLabel);
            } else {
              console.warn('textAnimationData.nfcChip not found!');
            }

            // Create bent line for NFC chip - pointing from RIGHT side (same as green text)
            const nfcLineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
            const nfcLinePoints = [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(0.6, 0.4, 0),
              new THREE.Vector3(1.6, 0.4, 0)
            ];
            const nfcLineGeometry = new THREE.BufferGeometry().setFromPoints(nfcLinePoints);
            const nfcPointerLine = new THREE.Line(nfcLineGeometry, nfcLineMaterial);
            sceneRef.current.add(nfcPointerLine);
            nfcPointerLine.visible = false;

            // Small dot at start of line
            const nfcDotGeometry = new THREE.SphereGeometry(0.05, 16, 16);
            const nfcDotMaterial = new THREE.MeshBasicMaterial({ color: 0xFFD700 }); // Yellow dot to match chip
            const nfcLineDot = new THREE.Mesh(nfcDotGeometry, nfcDotMaterial);
            sceneRef.current.add(nfcLineDot);
            nfcLineDot.visible = false;

            // Store references
            window.nfcTextLabelRef = nfcTextLabel;
            window.nfcPointerLineRef = nfcPointerLine;
            window.nfcLineDotRef = nfcLineDot;

            console.log('NFC chip text label and pointer line added to scene');

            console.log('BizCard loaded and parented successfully');

            // Mark loading complete and hide preloader after a short delay
            setLoadingProgress(100);
            setIsLoaded(true);
            setTimeout(() => {
              setShowPreloader(false);
              showPreloaderRef.current = false; // Update ref for animation loop
            }, 500); // Small delay after 100% before hiding
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total) * 100;
              loadingProgressRef.current.bizcard = percent;
              // BizCard is 50% of total loading
              const totalProgress = (loadingProgressRef.current.bizbox * 0.5) + (loadingProgressRef.current.bizcard * 0.5);
              setLoadingProgress(Math.round(totalProgress));
              console.log('BizCard loading:', percent.toFixed(2) + '%');
            }
          },
          (error) => {
            console.error('Error loading BizCard:', error);
          }
        );
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total) * 100;
          loadingProgressRef.current.bizbox = percent;
          // BizBox is 50% of total loading
          const totalProgress = (loadingProgressRef.current.bizbox * 0.5) + (loadingProgressRef.current.bizcard * 0.5);
          setLoadingProgress(Math.round(totalProgress));
          console.log('BizBox loading:', percent.toFixed(2) + '%');
        }
      },
      (error) => {
        console.error('Error loading BizBox:', error);
      }
    );

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const delta = clockRef.current.getDelta();
      timeRef.current += delta;
      floatPhaseRef.current += delta;

      // === INTRO CAMERA ANIMATION ===
      // Animate camera from top to final position after loading completes
      if (!introCompleteRef.current && !showPreloaderRef.current) {
        introProgressRef.current += delta / introDuration;

        if (introProgressRef.current >= 1) {
          introProgressRef.current = 1;
          introCompleteRef.current = true;
        }

        // Use easeOutQuint for smooth deceleration
        const introEase = easeOutQuint(introProgressRef.current);

        // Interpolate camera position
        camera.position.x = lerp(cameraStartPos.x, cameraEndPos.x, introEase);
        camera.position.y = lerp(cameraStartPos.y, cameraEndPos.y, introEase);
        camera.position.z = lerp(cameraStartPos.z, cameraEndPos.z, introEase);
        camera.lookAt(0, 0, 0);
      }

      // Smooth scroll interpolation
      const scrollSmoothing = 0.06;
      scrollProgressRef.current += (targetScrollRef.current - scrollProgressRef.current) * scrollSmoothing;
      const progress = scrollProgressRef.current;

      // Total frames = 250
      // Frames 0-100: Box animation (card follows via bone parent)
      // Frames 100-150: Card moves towards screen
      // Frames 150-200: Card rotates 180 degrees
      // Frames 200-250: Bizcard becomes glassy/transparent, chip becomes yellow
      const totalFrames = 250;
      const currentFrame = progress * totalFrames;

      // Update scroll indicator
      if (scrollIndicatorRef.current) {
        scrollIndicatorRef.current.textContent = `${Math.round(currentFrame)} / ${totalFrames}`;
      }

      // === BOX ANIMATION (frames 0-100) ===
      if (mixerRef.current && animationActionRef.current && animationClipRef.current) {
        const clip = animationClipRef.current;
        const action = animationActionRef.current;

        // Box animation plays from frame 0 to 100
        const boxFrame = Math.min(currentFrame, 100);
        const animationTime = (boxFrame / 100) * clip.duration;

        action.time = animationTime;
        mixerRef.current.update(0);
      }

      // === UPDATE TEXT LABEL AND POINTER LINE TO FOLLOW RED SPHERE ===
      if (window.debugSphereRef && window.textLabelRef && window.pointerLineRef && window.boneRef) {
        // Get red sphere world position
        const sphereWorldPos = new THREE.Vector3();
        window.debugSphereRef.getWorldPosition(sphereWorldPos);

        // Position line start at sphere edge
        const lineStart = sphereWorldPos.clone();

        // Bend point - offset up and to the right (120 degree bend)
        const bendPoint = new THREE.Vector3(
          sphereWorldPos.x + 0.6,
          sphereWorldPos.y + 0.4,
          sphereWorldPos.z
        );

        // End point - horizontal from bend point
        const lineEnd = new THREE.Vector3(
          bendPoint.x + 1.0,
          bendPoint.y,
          bendPoint.z
        );

        // Update line geometry
        const positions = window.pointerLineRef.geometry.attributes.position.array;
        positions[0] = lineStart.x;
        positions[1] = lineStart.y;
        positions[2] = lineStart.z;
        positions[3] = bendPoint.x;
        positions[4] = bendPoint.y;
        positions[5] = bendPoint.z;
        positions[6] = lineEnd.x;
        positions[7] = lineEnd.y;
        positions[8] = lineEnd.z;
        window.pointerLineRef.geometry.attributes.position.needsUpdate = true;

        // Update dot position (at line start)
        if (window.lineDotRef) {
          window.lineDotRef.position.copy(lineStart);
        }

        // Update text position (at line end)
        window.textLabelRef.position.set(lineEnd.x + 0.8, lineEnd.y, lineEnd.z);
      }

      // === UPDATE TEXT LABEL AND POINTER LINE TO FOLLOW BLUE SPHERE (BONE002) ===
      // Text on LEFT side of blue sphere
      if (window.blueSphereRef && window.blueTextLabelRef && window.bluePointerLineRef) {
        // Get blue sphere world position
        const blueSphereWorldPos = new THREE.Vector3();
        window.blueSphereRef.getWorldPosition(blueSphereWorldPos);

        // Position line start at sphere
        const blueLineStart = blueSphereWorldPos.clone();

        // Bend point - offset up and to the LEFT
        const blueBendPoint = new THREE.Vector3(
          blueSphereWorldPos.x - 0.6,
          blueSphereWorldPos.y + 0.4,
          blueSphereWorldPos.z
        );

        // End point - horizontal from bend point (going left)
        const blueLineEnd = new THREE.Vector3(
          blueBendPoint.x - 1.0,
          blueBendPoint.y,
          blueBendPoint.z
        );

        // Update line geometry
        const bluePositions = window.bluePointerLineRef.geometry.attributes.position.array;
        bluePositions[0] = blueLineStart.x;
        bluePositions[1] = blueLineStart.y;
        bluePositions[2] = blueLineStart.z;
        bluePositions[3] = blueBendPoint.x;
        bluePositions[4] = blueBendPoint.y;
        bluePositions[5] = blueBendPoint.z;
        bluePositions[6] = blueLineEnd.x;
        bluePositions[7] = blueLineEnd.y;
        bluePositions[8] = blueLineEnd.z;
        window.bluePointerLineRef.geometry.attributes.position.needsUpdate = true;

        // Update dot position (at line start)
        if (window.blueLineDotRef) {
          window.blueLineDotRef.position.copy(blueLineStart);
        }

        // Update text position (at line end, offset to the left)
        window.blueTextLabelRef.position.set(blueLineEnd.x - 0.8, blueLineEnd.y, blueLineEnd.z);
      }

      // === UPDATE TEXT LABEL AND POINTER LINE TO FOLLOW GREEN SPHERE (BIZCARD) ===
      if (window.greenSphereRef && window.cardTextLabelRef && window.cardPointerLineRef) {
        // Get green sphere world position
        const greenSphereWorldPos = new THREE.Vector3();
        window.greenSphereRef.getWorldPosition(greenSphereWorldPos);

        // Position line start at sphere
        const cardLineStart = greenSphereWorldPos.clone();

        // Bend point - offset up and to the RIGHT (same direction as red sphere)
        const cardBendPoint = new THREE.Vector3(
          greenSphereWorldPos.x + 0.6,
          greenSphereWorldPos.y + 0.4,
          greenSphereWorldPos.z
        );

        // End point - horizontal from bend point (going right)
        const cardLineEnd = new THREE.Vector3(
          cardBendPoint.x + 1.0,
          cardBendPoint.y,
          cardBendPoint.z
        );

        // Update line geometry
        const cardPositions = window.cardPointerLineRef.geometry.attributes.position.array;
        cardPositions[0] = cardLineStart.x;
        cardPositions[1] = cardLineStart.y;
        cardPositions[2] = cardLineStart.z;
        cardPositions[3] = cardBendPoint.x;
        cardPositions[4] = cardBendPoint.y;
        cardPositions[5] = cardBendPoint.z;
        cardPositions[6] = cardLineEnd.x;
        cardPositions[7] = cardLineEnd.y;
        cardPositions[8] = cardLineEnd.z;
        window.cardPointerLineRef.geometry.attributes.position.needsUpdate = true;

        // Update dot position (at line start)
        if (window.cardLineDotRef) {
          window.cardLineDotRef.position.copy(cardLineStart);
        }

        // Update text position (at line end, offset to the right)
        window.cardTextLabelRef.position.set(cardLineEnd.x + 0.8, cardLineEnd.y, cardLineEnd.z);
      }

      // === UPDATE TEXT LABEL AND POINTER LINE TO FOLLOW NFC CHIP ===
      // Use same positioning as green sphere text (RIGHT side) since that works
      if (chipMeshRef.current && window.nfcTextLabelRef && window.nfcPointerLineRef) {
        // Get chip mesh world position
        const chipWorldPos = new THREE.Vector3();
        chipMeshRef.current.getWorldPosition(chipWorldPos);

        // Position line start at chip
        const nfcLineStart = chipWorldPos.clone();

        // Bend point - offset up and to the RIGHT (same as green text that works)
        const nfcBendPoint = new THREE.Vector3(
          chipWorldPos.x + 0.6,
          chipWorldPos.y + 0.4,
          chipWorldPos.z
        );

        // End point - horizontal from bend point (going right)
        const nfcLineEnd = new THREE.Vector3(
          nfcBendPoint.x + 1.0,
          nfcBendPoint.y,
          nfcBendPoint.z
        );

        // Update line geometry
        const nfcPositions = window.nfcPointerLineRef.geometry.attributes.position.array;
        nfcPositions[0] = nfcLineStart.x;
        nfcPositions[1] = nfcLineStart.y;
        nfcPositions[2] = nfcLineStart.z;
        nfcPositions[3] = nfcBendPoint.x;
        nfcPositions[4] = nfcBendPoint.y;
        nfcPositions[5] = nfcBendPoint.z;
        nfcPositions[6] = nfcLineEnd.x;
        nfcPositions[7] = nfcLineEnd.y;
        nfcPositions[8] = nfcLineEnd.z;
        window.nfcPointerLineRef.geometry.attributes.position.needsUpdate = true;

        // Update dot position (at line start, on chip)
        if (window.nfcLineDotRef) {
          window.nfcLineDotRef.position.copy(nfcLineStart);
        }

        // Update text position (at line end, offset to the right)
        window.nfcTextLabelRef.position.set(nfcLineEnd.x + 0.8, nfcLineEnd.y, nfcLineEnd.z);
      }

      // === TEXT ANIMATION SEQUENCE ===
      // Controls visibility and typing animation based on current frame
      if (window.textAnimationData && window.updateTextSprite) {
        const animData = window.textAnimationData;

        // === RED TEXT (frames 0-30) ===
        const redData = animData.red;
        if (redData.sprite) {
          let redVisible = false;
          let redProgress = 0;

          if (currentFrame >= redData.startFrame && currentFrame < redData.endFrame) {
            redVisible = true;

            if (currentFrame <= redData.typeEndFrame) {
              // Typing in: 0 to 1
              redProgress = (currentFrame - redData.startFrame) / (redData.typeEndFrame - redData.startFrame);
            } else if (currentFrame < redData.deleteStartFrame) {
              // Hold fully typed
              redProgress = 1;
            } else {
              // Deleting: 1 to 0
              redProgress = 1 - (currentFrame - redData.deleteStartFrame) / (redData.endFrame - redData.deleteStartFrame);
            }

            window.updateTextSprite(redData.sprite, redData.text, Math.max(0, Math.min(1, redProgress)));
          }

          redData.sprite.visible = redVisible;
          if (window.pointerLineRef) window.pointerLineRef.visible = redVisible;
          if (window.lineDotRef) window.lineDotRef.visible = redVisible;
        }

        // === BLUE TEXT (frames 70-100) ===
        const blueData = animData.blue;
        if (blueData.sprite) {
          let blueVisible = false;
          let blueProgress = 0;

          // Appearance (frames 70-100)
          if (currentFrame >= blueData.startFrame && currentFrame < blueData.endFrame) {
            blueVisible = true;

            if (currentFrame <= blueData.typeEndFrame) {
              // Typing in
              blueProgress = (currentFrame - blueData.startFrame) / (blueData.typeEndFrame - blueData.startFrame);
            } else if (currentFrame < blueData.deleteStartFrame) {
              // Hold fully typed
              blueProgress = 1;
            } else {
              // Deleting
              blueProgress = 1 - (currentFrame - blueData.deleteStartFrame) / (blueData.endFrame - blueData.deleteStartFrame);
            }

            window.updateTextSprite(blueData.sprite, blueData.text, Math.max(0, Math.min(1, blueProgress)));
          }

          blueData.sprite.visible = blueVisible;
          if (window.bluePointerLineRef) window.bluePointerLineRef.visible = blueVisible;
          if (window.blueLineDotRef) window.blueLineDotRef.visible = blueVisible;
        }

        // === GREEN TEXT (frames 110-150, then 150-200 with alt text "SCAN THIS QR CODE") ===
        const greenData = animData.green;
        if (greenData.sprite) {
          let greenVisible = false;
          let greenProgress = 0;
          let greenText = greenData.text;

          // First appearance (frames 110-150)
          if (currentFrame >= greenData.startFrame && currentFrame < greenData.endFrame) {
            greenVisible = true;
            greenText = greenData.text;

            if (currentFrame <= greenData.typeEndFrame) {
              // Typing in
              greenProgress = (currentFrame - greenData.startFrame) / (greenData.typeEndFrame - greenData.startFrame);
            } else if (currentFrame < greenData.deleteStartFrame) {
              // Hold fully typed
              greenProgress = 1;
            } else {
              // Deleting
              greenProgress = 1 - (currentFrame - greenData.deleteStartFrame) / (greenData.endFrame - greenData.deleteStartFrame);
            }
          }
          // Second appearance with alt text (frames 150-200) - "SCAN THIS QR CODE"
          else if (currentFrame >= greenData.altStartFrame && currentFrame < greenData.altEndFrame) {
            greenVisible = true;
            greenText = greenData.altText;

            if (currentFrame <= greenData.altTypeEndFrame) {
              // Typing in
              greenProgress = (currentFrame - greenData.altStartFrame) / (greenData.altTypeEndFrame - greenData.altStartFrame);
            } else if (currentFrame < greenData.altDeleteStartFrame) {
              // Hold fully typed
              greenProgress = 1;
            } else {
              // Deleting
              greenProgress = 1 - (currentFrame - greenData.altDeleteStartFrame) / (greenData.altEndFrame - greenData.altDeleteStartFrame);
            }
          }

          if (greenVisible) {
            window.updateTextSprite(greenData.sprite, greenText, Math.max(0, Math.min(1, greenProgress)));
          }

          greenData.sprite.visible = greenVisible;
          if (window.cardPointerLineRef) window.cardPointerLineRef.visible = greenVisible;
          if (window.cardLineDotRef) window.cardLineDotRef.visible = greenVisible;
        }

        // === NFC CHIP TEXT (frames 200-250) - "THIS NFC CHIP" ===
        const nfcData = animData.nfcChip;
        if (nfcData && nfcData.sprite) {
          let nfcVisible = false;
          let nfcProgress = 0;

          if (currentFrame >= nfcData.startFrame && currentFrame < nfcData.endFrame) {
            nfcVisible = true;

            if (currentFrame <= nfcData.typeEndFrame) {
              // Typing in
              nfcProgress = (currentFrame - nfcData.startFrame) / (nfcData.typeEndFrame - nfcData.startFrame);
            } else if (currentFrame < nfcData.deleteStartFrame) {
              // Hold fully typed
              nfcProgress = 1;
            } else {
              // Deleting
              nfcProgress = 1 - (currentFrame - nfcData.deleteStartFrame) / (nfcData.endFrame - nfcData.deleteStartFrame);
            }

            window.updateTextSprite(nfcData.sprite, nfcData.text, Math.max(0, Math.min(1, nfcProgress)));
          }

          nfcData.sprite.visible = nfcVisible;
          if (window.nfcPointerLineRef) window.nfcPointerLineRef.visible = nfcVisible;
          if (window.nfcLineDotRef) window.nfcLineDotRef.visible = nfcVisible;
        } else if (currentFrame >= 200 && currentFrame < 250) {
          // Debug: log if nfcData or sprite is missing
          if (!nfcData) console.warn('nfcData is missing');
          else if (!nfcData.sprite) console.warn('nfcData.sprite is missing');
        }
      }

      // === BIZCARD ANIMATION ===
      // Frames 0-100: Card follows bone animation automatically (parented)
      // Frames 100-150: Card moves towards screen
      // Frames 150-200: Card rotates 180 degrees
      if (bizCardRef.current) {
        const card = bizCardRef.current;

        if (currentFrame <= 100) {
          // Card follows bone animation automatically via parenting
          // Just keep at initial position/rotation relative to bone
          card.position.copy(cardInitialPos.current);
          card.rotation.copy(cardInitialRot.current);
        } else if (currentFrame <= 150) {
          // Frames 100-150: Card moves towards screen
          const cardProgress = easeOutQuint((currentFrame - 100) / 50);

          // Movement from initial position
          const moveX = lerp(0, 3, cardProgress);   // towards screen
          const moveY = lerp(0, -2, cardProgress);  // up/down
          const moveZ = lerp(0, 0, cardProgress);   // left/right

          card.position.x = cardInitialPos.current.x + moveX;
          card.position.y = cardInitialPos.current.y + moveY;
          card.position.z = cardInitialPos.current.z + moveZ;

          // Initial rotation during move
          const rotateX = lerp(0, 0, cardProgress);
          const rotateY = lerp(0, 0, cardProgress);
          const rotateZ = lerp(0, -1, cardProgress);

          card.rotation.x = cardInitialRot.current.x + rotateX;
          card.rotation.y = cardInitialRot.current.y + rotateY;
          card.rotation.z = cardInitialRot.current.z + rotateZ;
        } else {
          // Frames 150-200: Card rotates 180 degrees (then stays)
          const rotateProgress = easeOutCubic(Math.min((currentFrame - 150) / 50, 1));

          // Keep final position from frames 100-150
          const finalMoveX = 3;
          const finalMoveY = -2;
          const finalMoveZ = 0;

          card.position.x = cardInitialPos.current.x + finalMoveX;
          card.position.y = cardInitialPos.current.y + finalMoveY;
          card.position.z = cardInitialPos.current.z + finalMoveZ;

          // Rotation: start from -1 (end of previous phase), add 180 degrees (Math.PI)
          const baseRotZ = -1;
          const rotate180 = lerp(0, Math.PI, rotateProgress); // 180 degrees

          card.rotation.x = cardInitialRot.current.x;
          card.rotation.y = cardInitialRot.current.y;
          card.rotation.z = cardInitialRot.current.z + baseRotZ + rotate180;

          // Subtle floating after rotation
          if (rotateProgress > 0.5) {
            const floatIntensity = (rotateProgress - 0.5) / 0.5;
            const cardFloat = Math.sin(floatPhaseRef.current * 2) * 0.025 * floatIntensity;
            card.position.y += cardFloat;
          }
        }
      }

      // === GLASSY EFFECT (frames 200-250) ===
      // Bizcard becomes glassy/transparent, chip becomes yellow
      if (bizCardMeshRef.current && chipMeshRef.current) {
        const bizCardMesh = bizCardMeshRef.current;
        const chipMesh = chipMeshRef.current;

        if (currentFrame > 200) {
          // Progress for glassy effect (0 to 1 for frames 200-250)
          const glassyProgress = easeOutCubic(Math.min((currentFrame - 200) / 50, 1));

          // Make bizcard glassy/transparent
          if (bizCardMesh.material) {
            const origOpacity = originalMaterialsRef.current.bizcard?.opacity || 1;
            bizCardMesh.material.opacity = lerp(origOpacity, 0.3, glassyProgress);
            bizCardMesh.material.needsUpdate = true;
          }

          // Make chip yellow (visible when bizcard becomes transparent)
          if (chipMesh.material && chipMesh.material.color) {
            const origColor = originalMaterialsRef.current.chip?.color || new THREE.Color(0xffffff);
            const yellowColor = new THREE.Color(0xFFD700); // Gold/Yellow color
            chipMesh.material.color.lerpColors(origColor, yellowColor, glassyProgress);
            chipMesh.material.needsUpdate = true;
          }
        } else {
          // Reset to original values when scrolling back
          if (bizCardMesh.material) {
            const origOpacity = originalMaterialsRef.current.bizcard?.opacity || 1;
            bizCardMesh.material.opacity = origOpacity;
            bizCardMesh.material.needsUpdate = true;
          }

          if (chipMesh.material && chipMesh.material.color && originalMaterialsRef.current.chip?.color) {
            chipMesh.material.color.copy(originalMaterialsRef.current.chip.color);
            chipMesh.material.needsUpdate = true;
          }
        }
      }

      // === ANIMATE STAGE RINGS ===
      stageRingsRef.forEach((ring) => {
        const floatAmount = Math.sin(floatPhaseRef.current * ring.userData.floatSpeed + ring.userData.floatOffset) * 0.03;
        ring.position.y = ring.userData.baseY + floatAmount;

        // Animate all glow elements with the ring
        if (ring.userData.glow) {
          ring.userData.glow.position.y = ring.userData.glowBaseY + floatAmount;
        }
        if (ring.userData.glowOuter) {
          ring.userData.glowOuter.position.y = ring.userData.glowBaseY + floatAmount;
        }
      });

      // === ANIMATE PARTICLE FOG - Fast movement left to right ===
      if (fogParticlesRef.particles) {
        const positions = fogParticlesRef.particles.geometry.attributes.position.array;
        const halfSpread = fogParticlesRef.spreadX / 2;

        for (let i = 0; i < positions.length; i += 3) {
          // Skip hidden particles
          if (positions[i] < -500) continue;

          // Move particle to the right
          positions[i] += fogParticlesRef.speed * delta;

          // Wrap around when particle goes too far right
          if (positions[i] > halfSpread) {
            positions[i] = -halfSpread;
          }
        }

        fogParticlesRef.particles.geometry.attributes.position.needsUpdate = true;
      }

      // === FLOATING EFFECT FOR BOX ===
      if (modelRef.current) {
        const model = modelRef.current;

        const float1 = Math.sin(floatPhaseRef.current * 0.8) * 0.08;
        const float2 = Math.sin(floatPhaseRef.current * 1.6) * 0.03;
        const float3 = Math.sin(floatPhaseRef.current * 2.4) * 0.015;
        const totalFloat = float1 + float2 + float3;

        const rotWobbleX = Math.sin(floatPhaseRef.current * 0.5) * 0.012;
        const rotWobbleY = Math.cos(floatPhaseRef.current * 0.7) * 0.058;
        const rotWobbleZ = Math.sin(floatPhaseRef.current * 0.3) * 0.006;

        model.position.y = initialModelY.current + totalFloat;

        const baseTiltX = lerp(-0.25, 0.0, easeInOutQuad(Math.min(progress * 1.5, 1)));

        model.rotation.x = baseTiltX + rotWobbleX;
        model.rotation.y = (Math.PI + Math.PI / 2) + rotWobbleY;
        model.rotation.z = rotWobbleZ;
      }

      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }

      if (renderer && containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      if (renderer) renderer.dispose();
    };
  }, [handleScroll]);

  return (
    <>
      {/* Preloader */}
      {showPreloader && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            transition: 'opacity 0.5s ease-out',
            opacity: isLoaded ? 0 : 1,
            pointerEvents: isLoaded ? 'none' : 'auto'
          }}
        >
          {/* Loading percentage */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: '#ffffff',
              marginBottom: '30px',
              letterSpacing: '4px'
            }}
          >
            {loadingProgress}%
          </div>

          {/* Progress bar container */}
          <div
            style={{
              width: '300px',
              height: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            {/* Progress bar fill */}
            <div
              style={{
                width: `${loadingProgress}%`,
                height: '100%',
                backgroundColor: '#8b5cf6',
                borderRadius: '2px',
                transition: 'width 0.3s ease-out'
              }}
            />
          </div>

          {/* Loading text */}
          <div
            style={{
              marginTop: '20px',
              fontSize: '14px',
              fontFamily: 'monospace',
              color: 'rgba(255, 255, 255, 0.5)',
              letterSpacing: '2px',
              textTransform: 'uppercase'
            }}
          >
            Loading assets...
          </div>
        </div>
      )}

      {/* Main content */}
      <div ref={containerRef} className="bizbox-model-container">
        <div
          ref={scrollIndicatorRef}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            color: 'white',
            fontSize: '14px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            padding: '8px 16px',
            background: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            zIndex: 1000,
            letterSpacing: '1px'
          }}
        >
          0 / 250
        </div>
      </div>
    </>
  );
};

export default BizBoxModel;
