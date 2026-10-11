import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { Environment } from './environment.js';
import { PopulationManager } from './evolution.js';
import { UIManager } from './ui.js';

class SimulationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // 1. Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020a17);
    this.scene.fog = new THREE.FogExp2(0x020a17, 0.005);

    this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 0.1, 400);
    this.camera.position.set(0, 0, 68);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 2. 2.5D Aquarium Orbit & Pan Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = true;
    this.controls.maxDistance = 140;
    this.controls.minDistance = 6.0;

    // Constrain orbit angles to aquarium front-view window (allows tilt parallax without flipping)
    this.controls.minAzimuthAngle = -0.45;
    this.controls.maxAzimuthAngle = 0.45;
    this.controls.minPolarAngle = Math.PI * 0.38;
    this.controls.maxPolarAngle = Math.PI * 0.62;

    this.cameraController = {
      mode: 'track', // 'track' (Smooth 2.5D Track), 'macro'
      targetLookAt: new THREE.Vector3(),
      targetCamPos: new THREE.Vector3(),
      zoom: (delta) => {
        const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        const dist = dir.length();
        const newDist = Math.max(6.0, Math.min(140, dist + delta));
        dir.normalize().multiplyScalar(newDist);
        this.camera.position.copy(this.controls.target).add(dir);
      }
    };

    // 3. Post-Processing Pipeline (Dreamy Bioluminescent Bloom)
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      1.2,  // strength
      0.45, // radius
      0.35  // threshold
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
      const roots = this.population.creatures.map(c => c.mesh);
      const hits = this.raycaster.intersectObjects(roots, true);

      let currentHit = null;
      if (hits.length > 0) {
        let obj = hits[0].object;
        while (obj && !obj.userData.creature) obj = obj.parent;
        if (obj && obj.userData.creature) currentHit = obj.userData.creature;
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
        const dropPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersectPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(dropPlane, intersectPoint);
        this.environment.spawnFoodCluster(intersectPoint, 10);
        return;
      }

      if (this.hoveredCreature) {
        if (this.population.selectedCreature) {
          this.population.selectedCreature.isSelected = false;
        }
        this.population.selectedCreature = this.hoveredCreature;
        this.hoveredCreature.isSelected = true;

        // Auto trigger bullet-time for observation
        if (!this.ui.bulletTime) {
          this.ui.bulletTime = true;
          this.ui.simSpeed = 0.22;
          const bBtn = document.getElementById('btn-bullet-time');
          if (bBtn) bBtn.classList.add('active');
          const speedBtns = document.querySelectorAll('.btn-speed');
          speedBtns.forEach(b => b.classList.remove('active'));
        }
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        this.population.cycleSpecimen(e.shiftKey ? -1 : 1);
      } else if (e.key === '[' || e.key === '{') {
        this.population.cycleSpecimen(-1);
      } else if (e.key === ']' || e.key === '}') {
        this.population.cycleSpecimen(1);
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
    if (selected && !selected.isDead) {
      if (this.cameraController.mode === 'macro') {
        // Macro studio: lock target to head and maintain close distance
        const targetPt = new THREE.Vector3(selected.position.x, selected.position.y, selected.position.z);
        const targetDelta = new THREE.Vector3().subVectors(targetPt, this.controls.target);
        const step = targetDelta.multiplyScalar(0.08);
        this.controls.target.add(step);
        this.camera.position.add(step);

        const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
        if (offset.length() > 9.0) {
          offset.setLength(9.0);
          this.camera.position.copy(this.controls.target).add(offset);
        }
      } else {
        // 'track' (Default 2.5D Smooth Track): Translates camera smoothly in XY plane with ZERO spin
        const targetPt = new THREE.Vector3(selected.position.x, selected.position.y, 0);
        const targetDelta = new THREE.Vector3().subVectors(targetPt, this.controls.target);
        const step = targetDelta.multiplyScalar(0.08);
        this.controls.target.add(step);
        this.camera.position.add(step);
      }
    }

    this.controls.update();

    // Render Post-Processed Scene
    this.composer.render();

    // Update Telemetry UI
    this.ui.update();
  }
}

// Boot simulator when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new SimulationApp();
});
