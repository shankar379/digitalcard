import { useEffect, useRef, useCallback } from 'react';
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

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 5.5);
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
    const ringWidth = 0.45; // Width of each ring
    for (let i = 0; i < ringCount; i++) {
      const innerRadius = centerRadius + gap + (i * (ringWidth + gap));
      const outerRadius = innerRadius + ringWidth;

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
            console.log('BizCard loaded and parented successfully');
          },
          (progress) => {
            if (progress.total > 0) {
              const percent = (progress.loaded / progress.total) * 100;
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
        const floatAmount = Math.sin(floatPhaseRef.current * ring.userData.floatSpeed + ring.userData.floatOffset) * 0.08;
        ring.position.y = ring.userData.baseY + floatAmount;

        // Animate all glow elements with the ring
        if (ring.userData.glow) {
          ring.userData.glow.position.y = ring.userData.glowBaseY + floatAmount;
        }
        if (ring.userData.glowOuter) {
          ring.userData.glowOuter.position.y = ring.userData.glowBaseY + floatAmount;
        }
      });

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

  return <div ref={containerRef} className="bizbox-model-container" />;
};

export default BizBoxModel;
