import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Environment } from './environment.js';
import { PopulationManager } from './evolution.js';
import { UIManager } from './ui.js';

// Scratch objects for camera tracking and raycasting
const _camTargetPt = new THREE.Vector3();
const _camTargetDelta = new THREE.Vector3();
const _camOffset = new THREE.Vector3();
const _dropPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _dropIntersect = new THREE.Vector3();

class SimulationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x010814); // Deep abyssal navy
    this.scene.fog = new THREE.FogExp2(0x010814, 0.0035);

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 400);
    this.camera.position.set(0, 0, 68);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // 2. 2.5D Aquarium Pan & Zoom Controls (Left Click = 2D Pan up/down/left/right)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.maxDistance = 140;
    this.controls.minDistance = 6.0;

    // Direct 2D navigation: Left-drag and touch pan horizontally & vertically
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    // Lock rotation to keep a clean, crisp 2D aquarium viewport without disorienting tilt
    this.controls.enableRotate = false;

    this.cameraController = {
      mode: 'track', // 'track' (Follow Fish), 'free' (Manual 2D Pan), 'macro'
      targetLookAt: new THREE.Vector3(),
      targetCamPos: new THREE.Vector3(),
      setMode: (mode) => this.setCameraMode(mode),
      zoom: (delta) => {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const dist = dir.length();
        const newDist = Math.max(6.0, Math.min(140, dist + delta));
        dir.normalize().multiplyScalar(newDist);
        this.camera.position.copy(this.controls.target).add(dir);
      }
    };

    // Auto-switch to 'free' mode when user clicks & drags to pan so tracking doesn't fight them
    this.controls.addEventListener('start', () => {
      if (this.cameraController.mode === 'track') {
        this.setCameraMode('free');
      }
    });

    // 3. Post-Processing Pipeline (Dreamy Bioluminescent Bloom with high threshold to prevent white wash)
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      0.55, // strength (crisp subtle glow, eliminates white wash)
      0.25, // radius
      0.82  // threshold (only sparks, electric neurons & emissive bulbs bloom)
    );
    this.composer.addPass(this.bloomPass);

    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);

    // 4. Instantiate 2.5D Aquarium Ecosystem & Evolution
    this.environment = new Environment(this.scene);
    this.population = new PopulationManager(this.scene, this.environment, 16);
    this.ui = new UIManager(this.population, this.environment, this.cameraController);

    // 5. Interaction Raycaster & Hover State
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredCreature = null;

    this.prevTime = performance.now();
    this.startTime = performance.now();

    this.bindWindowEvents();
    this.animate();
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      this.composer.setSize(this.width, this.height);
    });

    // Hover Tracking (Highlighting creatures under mouse with targeting bracket)
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hitTargets = [];
      const creatures = this.population.creatures;
      for (let i = 0; i < creatures.length; i++) {
        const c = creatures[i];
        if (!c.isDead && c.headMesh) hitTargets.push(c.headMesh);
      }
      const hits = this.raycaster.intersectObjects(hitTargets, false);

      let currentHit = null;
      if (hits.length > 0) {
        currentHit = hits[0].object.userData.creature || null;
      }

      if (this.hoveredCreature && this.hoveredCreature !== currentHit) {
        this.hoveredCreature.isHovered = false;
      }
      if (currentHit) {
        currentHit.isHovered = true;
        this.renderer.domElement.style.cursor = 'pointer';
      } else {
        this.renderer.domElement.style.cursor = 'default';
      }
      this.hoveredCreature = currentHit;
    });

    // Pointer Down (Select Specimen or Drop Food)
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      // Shift-Click drops food cluster at depth Z = 0 plane
      if (e.shiftKey) {
        this.raycaster.ray.intersectPlane(_dropPlane, _dropIntersect);
        this.environment.spawnFoodCluster(_dropIntersect, 10);
        return;
      }

      if (this.hoveredCreature) {
        if (this.population.selectedCreature) {
          this.population.selectedCreature.isSelected = false;
        }
        this.population.selectedCreature = this.hoveredCreature;
        this.hoveredCreature.isSelected = true;
        this.setCameraMode('track');
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.population.cycleSpecimen(e.shiftKey ? -1 : 1);
        this.setCameraMode('track');
      } else if (e.key === '[' || e.key === '{') {
        this.population.cycleSpecimen(-1);
        this.setCameraMode('track');
      } else if (e.key === ']' || e.key === '}') {
        this.population.cycleSpecimen(1);
        this.setCameraMode('track');
      } else if (e.key === 'f' || e.key === 'F') {
        const center = this.population.selectedCreature ? this.population.selectedCreature.position : new THREE.Vector3();
        this.environment.spawnFoodCluster(center, 10);
      } else if (e.key === 'b' || e.key === 'B') {
        const btnBullet = document.getElementById('btn-bullet-time');
        if (btnBullet) btnBullet.click();
      } else if (e.key === '1') {
        this.setCameraMode('track');
      } else if (e.key === '2') {
        this.setCameraMode('macro');
      } else if (e.key === '3') {
        this.setCameraMode('free');
      } else if (e.key === '+' || e.key === '=') {
        this.cameraController.zoom(-10);
      } else if (e.key === '-' || e.key === '_') {
        this.cameraController.zoom(10);
      } else if (e.key === 'c' || e.key === 'C') {
        this.population.cloneSelected(3);
      } else if (e.code === 'Space') {
        this.ui.isPaused = !this.ui.isPaused;
      }
    });
  }

  setCameraMode(mode) {
    this.cameraController.mode = mode;
    const camBtns = document.querySelectorAll('.btn-cam-mode');
    camBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.prevTime) / 1000, 0.1);
    this.prevTime = now;
    const elapsed = (now - this.startTime) / 1000;

    if (!this.ui.isPaused) {
      const dt = delta * this.ui.simSpeed;
      this.population.update(dt);
      this.environment.update(dt, elapsed);
    }

    // Camera Rig & Tracking Controller (Smooth 2.5D Translation)
    const selected = this.population.selectedCreature;
    if (selected && !selected.isDead && Number.isFinite(selected.position.x) && Number.isFinite(selected.position.y)) {
      if (this.cameraController.mode === 'macro') {
        // Macro studio: lock target to head and maintain close distance
        _camTargetPt.set(selected.position.x, selected.position.y, selected.position.z || 0);
        _camTargetDelta.subVectors(_camTargetPt, this.controls.target).multiplyScalar(0.08);
        this.controls.target.add(_camTargetDelta);
        this.camera.position.add(_camTargetDelta);

        _camOffset.subVectors(this.camera.position, this.controls.target);
        if (_camOffset.length() > 9.0) {
          _camOffset.setLength(9.0);
          this.camera.position.copy(this.controls.target).add(_camOffset);
        }
      } else if (this.cameraController.mode === 'track') {
        // 'track' (Follow Fish): Translates camera smoothly in XY plane with ZERO spin
        _camTargetPt.set(selected.position.x, selected.position.y, 0);
        _camTargetDelta.subVectors(_camTargetPt, this.controls.target).multiplyScalar(0.08);
        this.controls.target.add(_camTargetDelta);
        this.camera.position.add(_camTargetDelta);
      }
      // 'free' mode: camera does not translate toward fish, user pans around freely!
    }

    // Soft pan boundary limits so user stays framed inside the aquarium
    const maxPanX = this.environment.bounds.x + 8;
    const maxPanY = this.environment.bounds.y + 6;
    this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -maxPanX, maxPanX);
    this.controls.target.y = THREE.MathUtils.clamp(this.controls.target.y, -maxPanY, maxPanY);

    // Safety fallback: ensure camera and controls target are always valid
    if (!Number.isFinite(this.camera.position.x) || !Number.isFinite(this.controls.target.x)) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 0, 68);
    }

    this.controls.update();

    // Render Post-Processed Scene with fallback
    try {
      this.composer.render();
    } catch (e) {
      this.renderer.render(this.scene, this.camera);
    }

    // Update Telemetry UI
    this.ui.update();
  }
}

function showErrorBanner(msg) {
  let errBox = document.getElementById('runtime-error-box');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'runtime-error-box';
    errBox.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(180,0,30,0.92);color:white;padding:16px 24px;border-radius:10px;z-index:999999;font-family:monospace;font-size:12px;max-width:90%;box-shadow:0 0 30px rgba(0,0,0,0.8);pointer-events:auto;';
    document.body.appendChild(errBox);
  }
  errBox.innerHTML = `<strong>⚠️ Simulation Error:</strong> ${msg}`;
}

window.addEventListener('error', (e) => {
  console.error('Runtime error:', e.error || e.message);
  showErrorBanner(e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  showErrorBanner(e.reason?.message || String(e.reason));
});

function bootSimulator() {
  try {
    console.log('Booting Synapse-3D Aquarium...');
    new SimulationApp();
    console.log('Synapse-3D Aquarium running successfully!');
  } catch (err) {
    console.error('CRITICAL BOOT ERROR:', err);
    showErrorBanner(`${err.message}\n\n${err.stack}`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSimulator);
} else {
  bootSimulator();
}
