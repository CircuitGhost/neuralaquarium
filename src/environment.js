import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    // 2.5D Aquarium Tank Bounds: Wide (X), Tall (Y), Thin Depth (Z)
    this.bounds = new THREE.Vector3(50, 28, 7);

    // Food Particle Data
    this.maxFood = 90;
    this.foodItems = [];

    // Plants / Kelp stalks
    this.kelpStalks = [];

    this.initLighting();
    this.initTankGeometry();
    this.initProceduralKelp();
    this.initSubstrateAndRocks();
    this.initCausticGodRays();
    this.initMarineSnow();
    this.initFoodSystem();
    this.initFeedingEffects();
  }

  initLighting() {
    // Deep Ocean Ambient Light (rich dark navy base)
    this.ambientLight = new THREE.AmbientLight(0x051b30, 0.85);
    this.scene.add(this.ambientLight);

    // Front View Fill Light (soft illumination without glare)
    this.frontLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
    this.frontLight.position.set(0, 5, 50);
    this.scene.add(this.frontLight);

    // Overhead Sunlight penetrating the water surface (subtle cyan/sky tint)
    this.sunLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    this.sunLight.position.set(10, 45, 20);
    this.scene.add(this.sunLight);

    // Bottom Ambient bounce light from substrate
    this.sandBounce = new THREE.DirectionalLight(0x0284c7, 0.35);
    this.sandBounce.position.set(0, -35, 15);
    this.scene.add(this.sandBounce);
  }

  initTankGeometry() {
    const b = this.bounds;

    // 1. Back Wall Backdrop with Deep Aquatic Gradient (Generously fills viewing frustum)
    const backGeo = new THREE.PlaneGeometry(b.x * 2 + 60, b.y * 2 + 40);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0369a1');    // Surface ocean cerulean
    grad.addColorStop(0.25, '#075985'); // Midwater deep blue
    grad.addColorStop(0.65, '#082f49'); // Abyssal navy
    grad.addColorStop(1.0, '#021226');  // Deep trench midnight
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const backTex = new THREE.CanvasTexture(canvas);
    backTex.needsUpdate = true;
    const backMat = new THREE.MeshBasicMaterial({ map: backTex, depthWrite: false });
    this.backdrop = new THREE.Mesh(backGeo, backMat);
    this.backdrop.position.set(0, 0, -b.z - 2.5);
    this.scene.add(this.backdrop);

    // 2. Tank Frame & Edge Outlines
    const boxGeo = new THREE.BoxGeometry(b.x * 2, b.y * 2, b.z * 2);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending
    });
    this.boundaryBox = new THREE.LineSegments(edges, lineMat);
    this.scene.add(this.boundaryBox);

    // 3. Water Surface Meniscus (Shimmering Top Plane)
    const surfGeo = new THREE.PlaneGeometry(b.x * 2, b.z * 2);
    this.surfMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.12,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide
    });
    const surface = new THREE.Mesh(surfGeo, this.surfMat);
    surface.position.set(0, b.y, 0);
    surface.rotation.x = Math.PI * 0.5;
    this.scene.add(surface);
  }

  initSubstrateAndRocks() {
    const b = this.bounds;

    // Sandy Sea Floor Substrate
    const floorGeo = new THREE.BoxGeometry(b.x * 2 + 8, 4.0, b.z * 2 + 6, 32, 1, 8);
    // Displace floor vertices for organic sandy dunes
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const dune = Math.sin(x * 0.12) * 0.8 + Math.cos(z * 0.3) * 0.4;
        pos.setY(i, pos.getY(i) + dune);
      }
    }
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x051b2c,
      roughness: 0.88,
      metalness: 0.05
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -b.y - 1.5, 0);
    this.scene.add(floorMesh);

    // Decorative Sea Rocks & Pebbles along substrate
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x031422,
      roughness: 0.8,
      metalness: 0.1
    });

    const rockGeos = [
      new THREE.DodecahedronGeometry(2.5, 1),
      new THREE.DodecahedronGeometry(1.8, 1),
      new THREE.DodecahedronGeometry(3.2, 1)
    ];

    // Seed 14 rocks across floor
    for (let i = 0; i < 14; i++) {
      const geo = rockGeos[i % rockGeos.length];
      const rock = new THREE.Mesh(geo, rockMat);
      const rx = (Math.random() * 2 - 1) * (b.x - 6);
      const rz = (Math.random() * 2 - 1) * (b.z - 2);
      const scaleY = 0.5 + Math.random() * 0.6;
      rock.scale.set(1.0 + Math.random() * 0.5, scaleY, 1.0 + Math.random() * 0.5);
      rock.position.set(rx, -b.y + 0.5, rz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      this.scene.add(rock);
    }
  }

  initProceduralKelp() {
    const b = this.bounds;
    const numStalks = 28;

    for (let i = 0; i < numStalks; i++) {
      const x = ((i / (numStalks - 1)) * 2 - 1) * (b.x - 5) + (Math.random() - 0.5) * 4.0;
      // Stalk depths: some in background (Z < 0), some midground (Z ~ 0), some foreground (Z > 0)
      const z = (Math.random() * 2 - 1) * (b.z - 2.5);
      const height = 18.0 + Math.random() * 26.0; // Stalk height
      const segments = Math.floor(height / 2.2);

      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(x, -b.y, z);

      // Create linked segmented stalk nodes
      const nodes = [];
      let parentObj = stalkGroup;

      const kelpColor = new THREE.Color().setHSL(0.42 + Math.random() * 0.08, 0.72, 0.22 + (z + b.z) * 0.012);
      const kelpMat = new THREE.MeshStandardMaterial({
        color: kelpColor,
        roughness: 0.5,
        metalness: 0.05,
        side: THREE.DoubleSide
      });

      for (let s = 0; s < segments; s++) {
        const segGroup = new THREE.Group();
        segGroup.position.set(0, s === 0 ? 0 : 2.2, 0);

        // Stalk stem cylinder
        const stemGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.2, 6);
        stemGeo.translate(0, 1.1, 0);
        const stemMesh = new THREE.Mesh(stemGeo, kelpMat);
        segGroup.add(stemMesh);

        // Alternating leafy ribbons
        if (s > 1 && s % 2 === 0) {
          const leafShape = new THREE.Shape();
          const leafLen = 2.5 + Math.random() * 2.0;
          const leafWidth = 0.6 + Math.random() * 0.4;
          const side = (s % 4 === 0) ? 1 : -1;

          leafShape.moveTo(0, 0);
          leafShape.quadraticCurveTo(side * leafWidth, leafLen * 0.5, side * 0.2, leafLen);
          leafShape.quadraticCurveTo(0, leafLen * 0.4, 0, 0);

          const leafGeo = new THREE.ShapeGeometry(leafShape);
          const leafMesh = new THREE.Mesh(leafGeo, kelpMat);
          leafMesh.position.set(0, 1.1, 0);
          leafMesh.rotation.z = side * 0.3;
          segGroup.add(leafMesh);
        }

        parentObj.add(segGroup);
        nodes.push(segGroup);
        parentObj = segGroup;
      }

      // Bioluminescent tip bulb on taller stalks
      if (height > 30.0) {
        const bulbGeo = new THREE.SphereGeometry(0.3, 10, 8);
        const bulbMat = new THREE.MeshBasicMaterial({
          color: (i % 2 === 0) ? 0x00ffcc : 0x38bdf8,
          transparent: true,
          opacity: 0.75
        });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(0, 2.2, 0);
        nodes[nodes.length - 1].add(bulb);
      }

      this.scene.add(stalkGroup);

      this.kelpStalks.push({
        group: stalkGroup,
        nodes,
        height,
        phase: Math.random() * Math.PI * 2,
        swaySpeed: 0.28 + Math.random() * 0.14,
        amp: 0.08 + Math.random() * 0.05
      });
    }
  }

  initCausticGodRays() {
    const b = this.bounds;
    // Volumetric angled light beam ribbons
    const rayGeo = new THREE.PlaneGeometry(16, b.y * 2 + 10);
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.012,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.godRays = [];
    for (let i = 0; i < 6; i++) {
      const ray = new THREE.Mesh(rayGeo, rayMat);
      const rx = (i / 5 - 0.5) * (b.x * 1.4);
      ray.position.set(rx, 0, -2.0 + Math.random() * 4.0);
      ray.rotation.z = -0.25 + (Math.random() - 0.5) * 0.1;
      this.scene.add(ray);
      this.godRays.push({ mesh: ray, speed: 0.18 + Math.random() * 0.12, phase: Math.random() * Math.PI });
    }
  }

  initMarineSnow() {
    const b = this.bounds;
    this.snowCount = 340;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.snowCount * 3);
    const speeds = new Float32Array(this.snowCount);

    for (let i = 0; i < this.snowCount; i++) {
      positions[i * 3 + 0] = (Math.random() * 2 - 1) * b.x;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * b.y;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * b.z;
      speeds[i] = 0.2 + Math.random() * 0.4;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.18,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.marineSnow = new THREE.Points(geo, mat);
    this.snowSpeeds = speeds;
    this.scene.add(this.marineSnow);
  }

  initFeedingEffects() {
    this.feedEffects = [];
    const ringGeo = new THREE.RingGeometry(0.1, 0.45, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.feedEffectGroup = new THREE.Group();
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
      mesh.visible = false;
      this.feedEffectGroup.add(mesh);
      this.feedEffects.push({ mesh, active: false, scale: 0.2, alpha: 0.0 });
    }
    this.scene.add(this.feedEffectGroup);
  }

  triggerFeedingBurst(pos) {
    const fx = this.feedEffects.find(e => !e.active);
    if (!fx) return;
    fx.active = true;
    fx.scale = 0.35;
    fx.alpha = 0.95;
    fx.mesh.position.copy(pos);
    fx.mesh.scale.set(fx.scale, fx.scale, fx.scale);
    fx.mesh.material.opacity = fx.alpha;
    fx.mesh.visible = true;
  }

  initFoodSystem() {
    const foodGeo = new THREE.DodecahedronGeometry(0.34, 1);
    this.foodMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      emissive: 0x00ff88,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.1
    });

    this.foodMesh = new THREE.InstancedMesh(foodGeo, this.foodMat, this.maxFood);
    this.foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.foodMesh);

    // Seed initial food items inside the 2.5D tank volume
    for (let i = 0; i < this.maxFood * 0.65; i++) {
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
        (Math.random() * 2 - 1) * (b.z - 2.5) // Thin tank depth
      ),
      phase: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.4,
      absorbing: false,
      absorbTarget: null,
      absorbProgress: 0.0,
      currentScale: 1.0
    });
  }

  spawnFoodCluster(center, count = 8) {
    const b = this.bounds;
    for (let i = 0; i < count; i++) {
      if (this.foodItems.length >= this.maxFood) {
        this.foodItems.shift();
      }
      this.foodItems.push({
        position: new THREE.Vector3(
          Math.max(-b.x + 3, Math.min(b.x - 3, center.x + (Math.random() - 0.5) * 6.0)),
          Math.max(-b.y + 3, Math.min(b.y - 3, center.y + (Math.random() - 0.5) * 5.0)),
          Math.max(-b.z + 1, Math.min(b.z - 1, (Math.random() - 0.5) * 4.0))
        ),
        phase: Math.random() * Math.PI * 2,
        scale: 0.85 + Math.random() * 0.4,
        absorbing: false,
        absorbTarget: null,
        absorbProgress: 0.0,
        currentScale: 1.0
      });
    }
  }

  getNearestFood(pos) {
    if (this.foodItems.length === 0) return null;
    let closest = null;
    let minDistSq = Infinity;

    for (let i = 0; i < this.foodItems.length; i++) {
      const f = this.foodItems[i];
      if (f.absorbing) continue; // Skip food currently being digested
      const distSq = pos.distanceToSquared(f.position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = f;
      }
    }
    return closest;
  }

  /**
   * Attracts nearby plankton into mouth via hydrodynamic suction and digests upon contact
   */
  attractAndConsumeFood(mouthPos, suctionRadius = 3.6, consumeRadius = 1.35, dt = 0.016) {
    const suctionSq = suctionRadius * suctionRadius;
    const consumeSq = consumeRadius * consumeRadius;
    let count = 0;

    for (let i = 0; i < this.foodItems.length; i++) {
      const f = this.foodItems[i];
      if (f.absorbing) continue;

      const distSq = mouthPos.distanceToSquared(f.position);
      if (distSq < consumeSq) {
        // Immediate consumption initiation!
        f.absorbing = true;
        f.absorbTarget = mouthPos.clone();
        f.absorbProgress = 0.0;
        this.triggerFeedingBurst(mouthPos);
        count++;
      } else if (distSq < suctionSq) {
        // Hydrodynamic vacuum suction pulling plankton directly into mouth
        const dist = Math.sqrt(distSq);
        const pull = (1.0 - dist / suctionRadius) * 14.0 * dt;
        f.position.x += (mouthPos.x - f.position.x) * pull;
        f.position.y += (mouthPos.y - f.position.y) * pull;
        f.position.z += (mouthPos.z - f.position.z) * pull;
      }
    }
    return count;
  }

  consumeFoodNear(pos, radius = 2.0) {
    return this.attractAndConsumeFood(pos, radius * 1.5, radius, 0.016);
  }

  update(dt, elapsed) {
    // 1. Maintain Minimum Food Density
    if (this.foodItems.length < this.maxFood * 0.45 && Math.random() < 0.25) {
      this.spawnFoodRandom();
    }

    // 2. Animate Food Particles (smooth drift, suction lerping & scale shrink dissolution)
    const dummy = new THREE.Object3D();
    const b = this.bounds;

    for (let i = this.foodItems.length - 1; i >= 0; i--) {
      const f = this.foodItems[i];
      if (f.absorbing) {
        f.absorbProgress += dt * 8.0; // ~125ms rapid suction snap
        if (f.absorbTarget) {
          f.position.lerp(f.absorbTarget, Math.min(1.0, dt * 22.0));
        }
        f.currentScale = Math.max(0, f.scale * (1.0 - f.absorbProgress));
        if (f.absorbProgress >= 1.0) {
          this.foodItems.splice(i, 1);
        }
      } else {
        f.currentScale = f.scale * (1.0 + Math.sin(elapsed * 1.5 + f.phase) * 0.14);
      }
    }

    for (let i = 0; i < this.maxFood; i++) {
      if (i < this.foodItems.length) {
        const f = this.foodItems[i];
        if (!f.absorbing) {
          // Organic tranquil drift
          f.position.x += Math.sin(elapsed * 0.3 + f.phase) * dt * 0.25;
          f.position.y += Math.cos(elapsed * 0.25 + f.phase * 1.2) * dt * 0.18;
          f.position.z += Math.sin(elapsed * 0.2 + f.phase) * dt * 0.1;

          if (f.position.x > b.x - 2) f.position.x = -b.x + 2;
          if (f.position.x < -b.x + 2) f.position.x = b.x - 2;
          if (f.position.y > b.y - 2) f.position.y = -b.y + 2;
          if (f.position.y < -b.y + 2) f.position.y = b.y - 2;
          if (f.position.z > b.z - 1) f.position.z = -b.z + 1;
          if (f.position.z < -b.z + 1) f.position.z = b.z - 1;
        }

        dummy.position.copy(f.position);
        dummy.rotation.x = elapsed * 0.4 + f.phase;
        dummy.rotation.y = elapsed * 0.3;
        const s = f.currentScale !== undefined ? f.currentScale : f.scale;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        this.foodMesh.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.foodMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    this.foodMesh.instanceMatrix.needsUpdate = true;

    // 2b. Animate Feeding Absorption Rings
    this.feedEffects.forEach(fx => {
      if (fx.active) {
        fx.scale += dt * 5.2;
        fx.alpha = Math.max(0, fx.alpha - dt * 4.2);
        fx.mesh.scale.set(fx.scale, fx.scale, fx.scale);
        fx.mesh.material.opacity = fx.alpha;
        if (fx.alpha <= 0) {
          fx.active = false;
          fx.mesh.visible = false;
        }
      }
    });

    // 3. Animate Procedural Kelp Swaying in Ocean Current (Slow, hypnotic underwater surge)
    this.kelpStalks.forEach(stalk => {
      const swayTime = elapsed * stalk.swaySpeed + stalk.phase;
      const numNodes = stalk.nodes.length;
      stalk.nodes.forEach((node, idx) => {
        // Nodes higher up bend gracefully with traveling tidal wave
        const heightFactor = (idx + 1) / numNodes;
        const waveZ = Math.sin(swayTime - idx * 0.14) * (stalk.amp * heightFactor);
        const waveX = Math.cos(swayTime * 0.65 - idx * 0.1) * (stalk.amp * 0.25 * heightFactor);
        node.rotation.z = waveZ;
        node.rotation.x = waveX;
      });
    });

    // 4. Animate Volumetric God Rays (Slow, tranquil shafts of sunlight)
    this.godRays.forEach(ray => {
      ray.mesh.position.x += Math.sin(elapsed * ray.speed + ray.phase) * dt * 0.25;
      ray.mesh.material.opacity = 0.01 + Math.sin(elapsed * 0.5 + ray.phase) * 0.004;
    });

    // 5. Animate Marine Snow Particulates (Gentle, slow suspension)
    const positions = this.marineSnow.geometry.attributes.position.array;
    for (let i = 0; i < this.snowCount; i++) {
      const idx = i * 3;
      positions[idx + 1] -= this.snowSpeeds[i] * dt * 0.5;
      positions[idx + 0] += Math.sin(elapsed * 0.3 + i) * dt * 0.08;

      if (positions[idx + 1] < -b.y) {
        positions[idx + 1] = b.y;
        positions[idx + 0] = (Math.random() * 2 - 1) * b.x;
        positions[idx + 2] = (Math.random() * 2 - 1) * b.z;
      }
    }
    this.marineSnow.geometry.attributes.position.needsUpdate = true;
  }
}
