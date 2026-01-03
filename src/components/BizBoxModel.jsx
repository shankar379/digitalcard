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
  const innerBoxMeshRef = useRef(null);
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

        // Find the innerbox mesh to sync card position with it
        model.traverse((child) => {
          if (child.name === 'innerbox' && child.isSkinnedMesh) {
            innerBoxMeshRef.current = child;
            console.log('Found innerbox mesh for position sync');
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

        // Now load the BizCard model
        loader.load(
          '/bizcard_with_nfc_chip.glb',
          (cardGltf) => {
            const cardModel = cardGltf.scene;

            // Log card objects
            console.log('=== BizCard objects ===');
            cardModel.traverse((child) => {
              console.log(`  ${child.name} (${child.type})`);
            });

            // Enable shadows on card
            cardModel.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

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

            // Add card to scene (we'll sync position with innerbox in animation loop)
            scene.add(cardModel);
            console.log('BizCard added to scene, will sync with innerbox mesh');

            // Store card reference - initial position will be set in animation loop
            cardInitialPos.current.set(0, 0, 0);
            cardInitialRot.current.set(0, 0, 0);

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

      // Total frames = 150
      // Frames 0-100: Box animation (card follows via bone parent)
      // Frames 100-150: Card moves towards screen
      const totalFrames = 150;
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
      // Sync with innerbox mesh position during frames 0-100
      // Then animate towards screen during frames 100-150
      if (bizCardRef.current && innerBoxMeshRef.current) {
        const card = bizCardRef.current;
        const innerBox = innerBoxMeshRef.current;

        // Get innerbox world position (after animation update)
        const innerBoxWorldPos = new THREE.Vector3();
        innerBox.getWorldPosition(innerBoxWorldPos);

        // Get innerbox world quaternion for rotation
        const innerBoxWorldQuat = new THREE.Quaternion();
        innerBox.getWorldQuaternion(innerBoxWorldQuat);

        if (currentFrame <= 100) {
          // Card follows innerbox during box animation
          card.position.copy(innerBoxWorldPos);
          card.quaternion.copy(innerBoxWorldQuat);

          // Store position at frame 100 for the next phase
          cardInitialPos.current.copy(innerBoxWorldPos);
          cardInitialRot.current.setFromQuaternion(innerBoxWorldQuat);
        } else {
          // Card animation progress (0 to 1 for frames 100-150)
          const cardProgress = easeOutQuint((currentFrame - 100) / 50);

          // Start from innerbox position, move towards camera
          const towardsCameraDistance = lerp(0, 2.5, cardProgress);
          const upDistance = lerp(0, 0.8, cardProgress);

          card.position.copy(cardInitialPos.current);
          card.position.z += towardsCameraDistance;
          card.position.y += upDistance;

          // Keep rotation from innerbox, add slight Y tilt, and rotate 90 degrees on Z axis
          card.rotation.copy(cardInitialRot.current);
          card.rotation.y += lerp(0, 0.15, cardProgress);
          card.rotation.z += lerp(0, Math.PI / 2, cardProgress); // 90 degrees Z rotation

          // Subtle floating when card is fully out
          if (cardProgress > 0.8) {
            const floatIntensity = (cardProgress - 0.8) / 0.2;
            const cardFloat = Math.sin(floatPhaseRef.current * 2) * 0.025 * floatIntensity;
            const cardTilt = Math.sin(floatPhaseRef.current * 1.5) * 0.01 * floatIntensity;
            card.position.y += cardFloat;
            card.rotation.z += cardTilt;
          }
        }
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

  return <div ref={containerRef} className="bizbox-model-container" />;
};

export default BizBoxModel;
