import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.bounds = new THREE.Vector3(48, 30, 48);

    // Food Particle Data
    this.maxFood = 120;
    this.foodItems = []; // Array of { position, velocity, phase }

    // Marine snow particulate count
    this.snowCount = 1400;

    this.initLighting();
    this.initAquariumBoundary();
    this.initMarineSnow();
    this.initFoodSystem();
  }

  initLighting() {
    // Deep Ocean Ambient
    this.ambientLight = new THREE.AmbientLight(0x06152b, 1.8);
    this.scene.add(this.ambientLight);

    // Key Caustic Sunlight Shaft
    this.sunLight = new THREE.DirectionalLight(0x73d2ff, 2.8);
    this.sunLight.position.set(20, 60, 30);
    this.sunLight.castShadow = true;
    this.scene.add(this.sunLight);

    // Bioluminescent Depth Rim Light
    this.rimLight = new THREE.DirectionalLight(0x7000ff, 1.6);
    this.rimLight.position.set(-30, -20, -40);
    this.scene.add(this.rimLight);

    // Warm Accent Spotlight
    this.spotLight = new THREE.SpotLight(0x00ffcc, 3.5, 90, Math.PI * 0.35, 0.4);
    this.spotLight.position.set(0, 45, 0);
    this.scene.add(this.spotLight);
  }

  initAquariumBoundary() {
    const b = this.bounds;

    // Outer subtle boundary frame
    const boxGeo = new THREE.BoxGeometry(b.x * 2, b.y * 2, b.z * 2);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x1a4575,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.boundaryBox = new THREE.LineSegments(edges, lineMat);
    this.scene.add(this.boundaryBox);

    // Subtle bottom grid (abyssal substrate grid)
    const gridHelper = new THREE.GridHelper(b.x * 2, 24, 0x00e5ff, 0x0a2544);
    gridHelper.position.y = -b.y;
    this.scene.add(gridHelper);

    // Glowing boundary corner brackets
    const bracketGeo = new THREE.BoxGeometry(2, 2, 2);
    const bracketMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });

    [-b.x, b.x].forEach(x => {
      [-b.y, b.y].forEach(y => {
        [-b.z, b.z].forEach(z => {
          const m = new THREE.Mesh(bracketGeo, bracketMat);
          m.position.set(x, y, z);
          this.scene.add(m);
        });
      });
    });
  }

  initMarineSnow() {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.snowCount * 3);
    const speeds = new Float32Array(this.snowCount);

    const b = this.bounds;
    for (let i = 0; i < this.snowCount; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * b.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * b.y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * b.z;
      speeds[i] = 0.2 + Math.random() * 0.6;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x73d2ff,
      size: 0.35,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.marineSnow = new THREE.Points(geo, mat);
    this.snowSpeeds = speeds;
    this.scene.add(this.marineSnow);
  }

  initFoodSystem() {
    const foodGeo = new THREE.DodecahedronGeometry(0.3, 1);
    this.foodMat = new THREE.MeshBasicMaterial({
      color: 0x1db968, // Soft organic bioluminescent green instead of harsh neon
      transparent: true,
      opacity: 0.75,
      wireframe: false
    });

    this.foodMesh = new THREE.InstancedMesh(foodGeo, this.foodMat, this.maxFood);
    this.foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.foodMesh);

    // Seed initial food items
    for (let i = 0; i < this.maxFood * 0.7; i++) {
      this.spawnFoodRandom();
    }
  }

  spawnFoodRandom() {
    if (this.foodItems.length >= this.maxFood) return;
    const b = this.bounds;
    this.foodItems.push({
      position: new THREE.Vector3(
        (Math.random() * 2 - 1) * (b.x - 4),
        (Math.random() * 2 - 1) * (b.y - 4),
        (Math.random() * 2 - 1) * (b.z - 4)
      ),
      phase: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.5
    });
  }

  spawnFoodCluster(center, count = 8) {
    for (let i = 0; i < count; i++) {
      if (this.foodItems.length >= this.maxFood) {
        this.foodItems.shift(); // remove oldest if at max
      }
      this.foodItems.push({
        position: center.clone().add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 5.0,
            (Math.random() - 0.5) * 3.0,
            (Math.random() - 0.5) * 5.0
          )
        ),
        phase: Math.random() * Math.PI * 2,
        scale: 0.9 + Math.random() * 0.4
      });
    }
  }

  getNearestFood(pos) {
    if (this.foodItems.length === 0) return null;
    let closest = null;
    let minDistSq = Infinity;

    for (let i = 0; i < this.foodItems.length; i++) {
      const f = this.foodItems[i];
      const distSq = pos.distanceToSquared(f.position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = f;
      }
    }
    return closest;
  }

  consumeFoodNear(pos, radius = 1.8) {
    const rSq = radius * radius;
    let count = 0;

    for (let i = this.foodItems.length - 1; i >= 0; i--) {
      if (pos.distanceToSquared(this.foodItems[i].position) < rSq) {
        this.foodItems.splice(i, 1);
        count++;
      }
    }
    return count;
  }

  update(dt, elapsed) {
    // 1. Maintain Minimum Food Density
    if (this.foodItems.length < this.maxFood * 0.45 && Math.random() < 0.25) {
      this.spawnFoodRandom();
    }

    // 2. Animate Food Particles (gentle floating drift & pulsation)
    const dummy = new THREE.Object3D();
    const b = this.bounds;

    for (let i = 0; i < this.maxFood; i++) {
      if (i < this.foodItems.length) {
        const f = this.foodItems[i];
        // Organic drift
        f.position.x += Math.sin(elapsed * 0.8 + f.phase) * dt * 0.6;
        f.position.y += Math.cos(elapsed * 0.6 + f.phase * 1.5) * dt * 0.5;
        f.position.z += Math.sin(elapsed * 0.7 + f.phase * 2.0) * dt * 0.6;

        // Keep inside bounds
        if (f.position.x > b.x) f.position.x = -b.x;
        if (f.position.x < -b.x) f.position.x = b.x;
        if (f.position.y > b.y) f.position.y = -b.y;
        if (f.position.y < -b.y) f.position.y = b.y;
        if (f.position.z > b.z) f.position.z = -b.z;
        if (f.position.z < -b.z) f.position.z = b.z;

        dummy.position.copy(f.position);
        dummy.rotation.x = elapsed + f.phase;
        dummy.rotation.y = elapsed * 1.2;
        const pulse = f.scale * (1.0 + Math.sin(elapsed * 3.0 + f.phase) * 0.2);
        dummy.scale.set(pulse, pulse, pulse);
        dummy.updateMatrix();
        this.foodMesh.setMatrixAt(i, dummy.matrix);
      } else {
        // Hide unused instances
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.foodMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    this.foodMesh.instanceMatrix.needsUpdate = true;

    // 3. Animate Marine Snow Particulates
    const positions = this.marineSnow.geometry.attributes.position.array;
    for (let i = 0; i < this.snowCount; i++) {
      const idx = i * 3;
      positions[idx + 1] -= this.snowSpeeds[i] * dt * 2.5; // Drift downwards
      positions[idx + 0] += Math.sin(elapsed * 0.5 + i) * dt * 0.3;

      if (positions[idx + 1] < -b.y) {
        positions[idx + 1] = b.y;
        positions[idx + 0] = (Math.random() * 2 - 1) * b.x;
        positions[idx + 2] = (Math.random() * 2 - 1) * b.z;
      }
    }
    this.marineSnow.geometry.attributes.position.needsUpdate = true;

    // 4. Subtle shimmer on caustic light
    this.spotLight.position.x = Math.sin(elapsed * 0.5) * 8.0;
    this.spotLight.position.z = Math.cos(elapsed * 0.4) * 8.0;
  }
}
