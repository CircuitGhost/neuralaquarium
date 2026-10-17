import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;
    // 2.5D Aquarium Tank Bounds: Wide (X), Tall (Y), Thin Depth (Z)
    this.bounds = new THREE.Vector3(50, 28, 7);

    // Food Particle Data (balanced ecological density)
    this.maxFood = 35;
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
    this.initCaustics();
    this.initSubstrateShadows();
    this.initSubstrateAnemones();
    this.initHydrodynamicWakes();
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

    // 1. Water Volume Backdrop (strictly bounded to the aquarium interior: [-b.x, b.x] x [-b.y, b.y])
    const backGeo = new THREE.PlaneGeometry(b.x * 2, b.y * 2);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0284c7');    // Surface ocean cerulean
    grad.addColorStop(0.25, '#0369a1'); // Midwater deep blue
    grad.addColorStop(0.65, '#075985'); // Abyssal navy
    grad.addColorStop(1.0, '#04223d');  // Substrate trench navy
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const backTex = new THREE.CanvasTexture(canvas);
    backTex.needsUpdate = true;
    const backMat = new THREE.MeshBasicMaterial({ map: backTex, depthWrite: false });
    this.backdrop = new THREE.Mesh(backGeo, backMat);
    this.backdrop.position.set(0, 0, -b.z + 0.05);
    this.scene.add(this.backdrop);

    // 2. High-Clarity Front Viewing Glass with Gentle Anti-Reflective Tint
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      transmission: 0.96,
      opacity: 0.12,
      transparent: true,
      roughness: 0.08,
      metalness: 0.05,
      ior: 1.33,
      thickness: 0.5,
      depthWrite: false
    });

    const frontGlassGeo = new THREE.PlaneGeometry(b.x * 2, b.y * 2);
    const frontGlass = new THREE.Mesh(frontGlassGeo, glassMat);
    frontGlass.position.set(0, 0, b.z);
    this.scene.add(frontGlass);

    // 3. Crisp Aquarium Frame Trim (Clean 2D front facade border framing the tank)
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x07111e,
      roughness: 0.4,
      metalness: 0.8
    });

    const borderThickness = 1.0;
    // Top border beam
    const topBarGeo = new THREE.BoxGeometry(b.x * 2 + borderThickness * 2, borderThickness, 1.2);
    const topBar = new THREE.Mesh(topBarGeo, frameMat);
    topBar.position.set(0, b.y + borderThickness * 0.5, b.z + 0.1);
    this.scene.add(topBar);

    // Bottom border beam
    const bottomBarGeo = new THREE.BoxGeometry(b.x * 2 + borderThickness * 2, borderThickness, 1.2);
    const bottomBar = new THREE.Mesh(bottomBarGeo, frameMat);
    bottomBar.position.set(0, -b.y - borderThickness * 0.5, b.z + 0.1);
    this.scene.add(bottomBar);

    // Left border column
    const colGeo = new THREE.BoxGeometry(borderThickness, b.y * 2, 1.2);
    const leftCol = new THREE.Mesh(colGeo, frameMat);
    leftCol.position.set(-b.x - borderThickness * 0.5, 0, b.z + 0.1);
    this.scene.add(leftCol);

    // Right border column
    const rightCol = new THREE.Mesh(colGeo, frameMat);
    rightCol.position.set(b.x + borderThickness * 0.5, 0, b.z + 0.1);
    this.scene.add(rightCol);

    // 4. Subtle Shimmering Water Surface Line (at the top interior)
    const surfGeo = new THREE.PlaneGeometry(b.x * 2, 0.4);
    this.surfMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const surfLine = new THREE.Mesh(surfGeo, this.surfMat);
    surfLine.position.set(0, b.y - 0.2, b.z - 0.1);
    this.scene.add(surfLine);
  }

  initSubstrateAndRocks() {
    const b = this.bounds;

    // 1. Sandy Sea Floor Dune Bed (strictly inside the bottom of the tank: top at ~ -b.y + 1.6)
    const floorGeo = new THREE.BoxGeometry(b.x * 2 - 0.4, 2.6, b.z * 2 - 0.4, 32, 1, 8);
    // Displace upper floor vertices for organic sandy ripples
    const pos = floorGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const dune = Math.sin(x * 0.14) * 0.55 + Math.cos(z * 0.35) * 0.25;
        pos.setY(i, pos.getY(i) + dune);
      }
    }
    floorGeo.computeVertexNormals();

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x061e33,
      roughness: 0.85,
      metalness: 0.05
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -b.y + 1.3, 0);
    this.scene.add(floorMesh);

    // 2. Heavy Architectural Aquarium Base Stand (positioned strictly below the tank: y <= -b.y)
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x050b14,
      roughness: 0.45,
      metalness: 0.8
    });
    const standGeo = new THREE.BoxGeometry(b.x * 2 + 2.0, 7.0, b.z * 2 + 2.0);
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.position.set(0, -b.y - 3.5, 0);
    this.scene.add(standMesh);

    // Substrate Base Trim Line (sleek illuminated accent gap between glass and stand)
    const trimGeo = new THREE.BoxGeometry(b.x * 2 + 0.6, 0.4, b.z * 2 + 0.6);
    const trimMat = new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.4 });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(0, -b.y, 0);
    this.scene.add(trimMesh);

    // 3. Decorative Sea Rocks & Pebbles nestled in sand
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x031422,
      roughness: 0.8,
      metalness: 0.1
    });

    const rockGeos = [
      new THREE.DodecahedronGeometry(2.2, 1),
      new THREE.DodecahedronGeometry(1.6, 1),
      new THREE.DodecahedronGeometry(2.8, 1)
    ];

    // Seed rocks strictly within substrate dunes
    for (let i = 0; i < 14; i++) {
      const geo = rockGeos[i % rockGeos.length];
      const rock = new THREE.Mesh(geo, rockMat);
      const rx = (Math.random() * 2 - 1) * (b.x - 6);
      const rz = (Math.random() * 2 - 1) * (b.z - 2);
      const scaleY = 0.45 + Math.random() * 0.45;
      rock.scale.set(1.0 + Math.random() * 0.4, scaleY, 1.0 + Math.random() * 0.4);
      rock.position.set(rx, -b.y + 2.1, rz);
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

      const dune = Math.sin(x * 0.14) * 0.55 + Math.cos(z * 0.35) * 0.25;
      const stalkGroup = new THREE.Group();
      stalkGroup.position.set(x, -b.y + 1.8 + dune, z);

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
          leafMesh.userData = { isLeaf: true, baseZ: side * 0.3, side };
          segGroup.add(leafMesh);
          segGroup.userData.leaf = leafMesh;
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
        swaySpeed: 0.35 + Math.random() * 0.15,
        baseFlex: 0.035 + Math.random() * 0.015,
        tipFlex: 0.08 + Math.random() * 0.03,
        currentDeflectX: 0,
        currentDeflectZ: 0
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
    const foodGeo = new THREE.DodecahedronGeometry(0.22, 1);
    this.foodMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.1
    });

    this.foodMesh = new THREE.InstancedMesh(foodGeo, this.foodMat, this.maxFood);
    this.foodMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.foodMesh);

    // Seed balanced initial plankton inside the 2.5D tank volume
    for (let i = 0; i < 22; i++) {
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
      scale: 0.75 + Math.random() * 0.35,
      absorbing: false,
      absorbTarget: null,
      absorbProgress: 0.0,
      currentScale: 1.0
    });
  }

  spawnFoodCluster(center, count = 6) {
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

  /**
   * Calculates the gentle dual-cell ocean convection gyres at a 3D position.
   * Convection cells are centered around the left and right kelp groves (x = -24 and x = +24).
   * Left gyre circulates counter-clockwise; Right gyre circulates clockwise.
   * Central region (x ~ 0) exhibits natural upwelling, perimeter downwelling.
   */
  getConvectionCurrent(pos, elapsed = 0) {
    const current = new THREE.Vector3(0, 0, 0);
    const b = this.bounds;

    // Primary Dual Gyres
    // Gyre 1 (Left Grove): Center (-24, 0)
    const dx1 = pos.x - (-24.0);
    const dy1 = pos.y - 0.0;
    const r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) + 1.0;
    const strength1 = Math.exp(-r1 / 22.0) * 1.8;
    // Tangential circulation (counter-clockwise)
    current.x += (-dy1 / r1) * strength1;
    current.y += (dx1 / r1) * strength1;

    // Gyre 2 (Right Grove): Center (+24, 0)
    const dx2 = pos.x - 24.0;
    const dy2 = pos.y - 0.0;
    const r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) + 1.0;
    const strength2 = Math.exp(-r2 / 22.0) * 1.8;
    // Tangential circulation (clockwise)
    current.x += (dy2 / r2) * strength2;
    current.y += (-dx2 / r2) * strength2;

    // Central Upwelling Thermal Column
    const centerDist = Math.abs(pos.x);
    if (centerDist < 16.0) {
      const upwelling = (1.0 - centerDist / 16.0) * 0.75;
      current.y += upwelling;
    }

    // Gentle micro-turbulent oscillation
    if (elapsed > 0) {
      current.x += Math.sin(pos.y * 0.15 + elapsed * 0.4) * 0.25;
      current.y += Math.cos(pos.x * 0.12 + elapsed * 0.35) * 0.20;
      current.z += Math.sin(pos.x * 0.1 + pos.y * 0.1 + elapsed * 0.3) * 0.12;
    }

    // Boundary damping so current does not push objects through the tank glass
    const margin = 3.0;
    if (pos.x > b.x - margin && current.x > 0) current.x *= Math.max(0, (b.x - pos.x) / margin);
    if (pos.x < -b.x + margin && current.x < 0) current.x *= Math.max(0, (pos.x + b.x) / margin);
    if (pos.y > b.y - margin && current.y > 0) current.y *= Math.max(0, (b.y - pos.y) / margin);
    if (pos.y < -b.y + margin && current.y < 0) current.y *= Math.max(0, (pos.y + b.y) / margin);

    return current;
  }

  /**
   * Stimulates and enriches substrate anemones and kelp flora in the vicinity
   * of a senescent elder's dissolution site, boosting their bioluminescent expansion.
   */
  enrichFloraNear(pos, radius = 14.0) {
    const radSq = radius * radius;
    if (this.anemones) {
      this.anemones.forEach(a => {
        const dSq = a.pos.distanceToSquared(pos);
        if (dSq < radSq) {
          // Temporarily blossom and flourish
          a.targetExpansion = 1.35;
          if (a.crown) {
            a.crown.scale.set(1.35, 1.35, 1.35);
          }
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // Graphics Improvement 1: Animated Sunlight Floor Caustics
  // --------------------------------------------------------------------------
  initCaustics() {
    const b = this.bounds;
    this.causticCanvas = document.createElement('canvas');
    this.causticCanvas.width = 128;
    this.causticCanvas.height = 128;
    this.causticCtx = this.causticCanvas.getContext('2d');
    this.causticImageData = this.causticCtx.createImageData(128, 128);
    this.causticTex = new THREE.CanvasTexture(this.causticCanvas);
    this.causticTex.wrapS = THREE.RepeatWrapping;
    this.causticTex.wrapT = THREE.RepeatWrapping;
    this.causticTex.repeat.set(4, 2);

    const causticGeo = new THREE.PlaneGeometry(b.x * 2 - 1.0, b.z * 2 - 1.0, 16, 16);
    this.causticMat = new THREE.MeshBasicMaterial({
      map: this.causticTex,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    this.causticPlane = new THREE.Mesh(causticGeo, this.causticMat);
    this.causticPlane.rotation.x = -Math.PI * 0.5;
    this.causticPlane.position.set(0, -b.y + 2.2, 0);
    this.scene.add(this.causticPlane);
    this.lastCausticUpdate = 0;
  }

  updateCaustics(dt, elapsed) {
    if (elapsed - this.lastCausticUpdate < 0.038) return;
    this.lastCausticUpdate = elapsed;

    const data = this.causticImageData.data;
    const w = 128;
    const h = 128;
    const t = elapsed * 1.5;

    let ptr = 0;
    for (let y = 0; y < h; y++) {
      const ny = y * 0.09;
      for (let x = 0; x < w; x++) {
        const nx = x * 0.09;
        // Superimposed harmonic sine interference creating realistic cellular caustics
        const v1 = Math.sin(nx + t * 0.7);
        const v2 = Math.sin(ny - t * 0.5);
        const v3 = Math.sin((nx + ny) * 0.8 + t * 0.85);
        const v4 = Math.sin(Math.sqrt(nx * nx + ny * ny) * 1.1 - t * 0.75);
        const sum = (v1 + v2 + v3 + v4) * 0.25;
        const intensity = Math.pow(Math.max(0, sum * 0.5 + 0.5), 3.2) * 255;

        data[ptr] = 56;
        data[ptr + 1] = Math.min(255, 180 + intensity * 0.3);
        data[ptr + 2] = 255;
        data[ptr + 3] = intensity;
        ptr += 4;
      }
    }
    this.causticCtx.putImageData(this.causticImageData, 0, 0);
    this.causticTex.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Graphics Improvement 1b: Soft Substrate Contact Shadows
  // --------------------------------------------------------------------------
  initSubstrateShadows() {
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 64;
    shadowCanvas.height = 64;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    grad.addColorStop(0, 'rgba(1, 10, 22, 0.75)');
    grad.addColorStop(0.5, 'rgba(2, 14, 28, 0.45)');
    grad.addColorStop(1, 'rgba(2, 14, 28, 0.0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 64, 64);

    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowGeo = new THREE.PlaneGeometry(3.2, 2.0);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false
    });

    this.maxShadows = 64;
    this.shadowMesh = new THREE.InstancedMesh(shadowGeo, this.shadowMat, this.maxShadows);
    this.shadowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    dummy.position.set(0, -9999, 0);
    dummy.scale.set(0, 0, 0);
    dummy.updateMatrix();
    for (let i = 0; i < this.maxShadows; i++) {
      this.shadowMesh.setMatrixAt(i, dummy.matrix);
    }
    this.shadowMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.shadowMesh);
    this.shadowDummy = dummy;
  }

  updateSubstrateShadows(creatures) {
    if (!this.shadowMesh || !creatures) return;
    const b = this.bounds;
    const dummy = this.shadowDummy;

    for (let i = 0; i < this.maxShadows; i++) {
      if (i < creatures.length && !creatures[i].isDead) {
        const c = creatures[i];
        const dune = Math.sin(c.position.x * 0.14) * 0.55 + Math.cos(c.position.z * 0.35) * 0.25;
        const floorY = -b.y + 1.8 + dune;
        const heightAboveFloor = Math.max(0.1, c.position.y - floorY);

        const scaleSpread = 0.8 + Math.min(heightAboveFloor * 0.07, 1.8);
        const headingAngle = c.headingAngle || 0;

        dummy.position.set(c.position.x, floorY + 0.04, c.position.z);
        dummy.rotation.set(-Math.PI * 0.5, 0, headingAngle);
        dummy.scale.set(scaleSpread * 1.5, scaleSpread * 0.9, 1.0);
        dummy.updateMatrix();
        this.shadowMesh.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -9999, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        this.shadowMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    this.shadowMesh.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Graphics Improvement 3: Responsive Substrate Flora (Sea Anemones)
  // --------------------------------------------------------------------------
  initSubstrateAnemones() {
    const b = this.bounds;
    this.anemones = [];
    this.anemoneGroup = new THREE.Group();
    this.scene.add(this.anemoneGroup);

    const anemoneColors = [
      { base: 0xd946ef, glow: 0xf0abfc }, // Rose amethyst
      { base: 0x06b6d4, glow: 0x67e8f9 }, // Cyan bioluminescent
      { base: 0x10b981, glow: 0x6ee7b7 }, // Emerald polyp
      { base: 0x8b5cf6, glow: 0xc4b5fd }, // Violet deep sea
      { base: 0xf59e0b, glow: 0xfde68a }  // Amber seaflower
    ];

    const numAnemones = 22;
    for (let i = 0; i < numAnemones; i++) {
      const palette = anemoneColors[i % anemoneColors.length];
      const ax = (Math.random() * 2 - 1) * (b.x - 6);
      const az = (Math.random() * 2 - 1) * (b.z - 1.5);
      const dune = Math.sin(ax * 0.14) * 0.55 + Math.cos(az * 0.35) * 0.25;
      const ay = -b.y + 1.8 + dune;

      const singleGroup = new THREE.Group();
      singleGroup.position.set(ax, ay, az);

      const stalkHeight = 0.8 + Math.random() * 0.5;
      const stalkGeo = new THREE.CylinderGeometry(0.22, 0.38, stalkHeight, 10);
      stalkGeo.translate(0, stalkHeight * 0.5, 0);
      const stalkMat = new THREE.MeshStandardMaterial({
        color: palette.base,
        roughness: 0.45,
        metalness: 0.1
      });
      const stalkMesh = new THREE.Mesh(stalkGeo, stalkMat);
      singleGroup.add(stalkMesh);

      const crownGroup = new THREE.Group();
      crownGroup.position.y = stalkHeight;
      singleGroup.add(crownGroup);

      const tentacleCount = 10;
      const tentacles = [];
      const tentGeo = new THREE.ConeGeometry(0.06, 1.1, 5);
      tentGeo.translate(0, 0.55, 0);
      const tentMat = new THREE.MeshStandardMaterial({
        color: palette.glow,
        emissive: palette.glow,
        emissiveIntensity: 0.35,
        roughness: 0.3
      });

      for (let t = 0; t < tentacleCount; t++) {
        const angle = (t / tentacleCount) * Math.PI * 2;
        const tentHolder = new THREE.Group();
        tentHolder.rotation.y = angle;

        const tentMesh = new THREE.Mesh(tentGeo, tentMat);
        tentMesh.rotation.z = 0.55 + Math.random() * 0.18;
        tentHolder.add(tentMesh);
        crownGroup.add(tentHolder);

        tentacles.push({
          holder: tentHolder,
          mesh: tentMesh,
          baseTilt: tentMesh.rotation.z,
          swayOffset: Math.random() * Math.PI * 2
        });
      }

      this.anemoneGroup.add(singleGroup);

      this.anemones.push({
        group: singleGroup,
        crown: crownGroup,
        stalk: stalkMesh,
        stalkHeight,
        tentacles,
        pos: new THREE.Vector3(ax, ay, az),
        expansion: 1.0,
        targetExpansion: 1.0,
        swaySpeed: 0.35 + Math.random() * 0.2,
        palette
      });
    }
  }

  updateSubstrateAnemones(dt, elapsed, creatures) {
    if (!this.anemones) return;

    for (let i = 0; i < this.anemones.length; i++) {
      const a = this.anemones[i];
      let nearestDist = 999.0;

      if (creatures) {
        for (let j = 0; j < creatures.length; j++) {
          const c = creatures[j];
          if (!c.isDead) {
            const dx = c.position.x - a.pos.x;
            const dy = c.position.y - a.pos.y;
            const dz = c.position.z - a.pos.z;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < nearestDist) nearestDist = d;
          }
        }
      }

      // Proximity retraction reflex: retract gently when creature is within 3.8 units
      if (nearestDist < 3.8) {
        a.targetExpansion = 0.16;
      } else {
        a.targetExpansion = 1.0;
      }

      const lerpSpeed = (a.targetExpansion < a.expansion) ? 2.8 : 1.2;
      a.expansion = THREE.MathUtils.lerp(a.expansion, a.targetExpansion, dt * lerpSpeed);

      a.crown.scale.set(a.expansion, a.expansion, a.expansion);
      a.stalk.scale.set(1.0 + (1.0 - a.expansion) * 0.35, 0.55 + a.expansion * 0.45, 1.0 + (1.0 - a.expansion) * 0.35);

      const swayTime = elapsed * a.swaySpeed;
      a.tentacles.forEach(tent => {
        const swayZ = Math.sin(swayTime + tent.swayOffset) * 0.12 * a.expansion;
        const swayX = Math.cos(swayTime * 0.8 + tent.swayOffset) * 0.08 * a.expansion;
        tent.mesh.rotation.z = tent.baseTilt * a.expansion + swayZ;
        tent.mesh.rotation.x = swayX;
      });
    }
  }

  // --------------------------------------------------------------------------
  // Graphics Improvement 5: Hydrodynamic Cavitation & Micro-Wake Particles
  // --------------------------------------------------------------------------
  initHydrodynamicWakes() {
    this.maxWakeParticles = 480;
    this.wakePool = [];
    const positions = new Float32Array(this.maxWakeParticles * 3);
    const colors = new Float32Array(this.maxWakeParticles * 3);

    for (let i = 0; i < this.maxWakeParticles; i++) {
      positions[i * 3 + 0] = 0;
      positions[i * 3 + 1] = -9999;
      positions[i * 3 + 2] = 0;
      colors[i * 3 + 0] = 0.2;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 1.0;

      this.wakePool.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(),
        life: 0,
        maxLife: 1.0
      });
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Circular soft bioluminescent particle glow texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pctx = pCanvas.getContext('2d');
    const pGrad = pctx.createRadialGradient(16, 16, 0, 16, 16, 15);
    pGrad.addColorStop(0, 'rgba(255,255,255,1.0)');
    pGrad.addColorStop(0.35, 'rgba(125,235,255,0.75)');
    pGrad.addColorStop(0.8, 'rgba(10,140,255,0.2)');
    pGrad.addColorStop(1.0, 'rgba(0,40,120,0)');
    pctx.fillStyle = pGrad;
    pctx.fillRect(0, 0, 32, 32);

    const pTex = new THREE.CanvasTexture(pCanvas);

    const mat = new THREE.PointsMaterial({
      map: pTex,
      vertexColors: true,
      size: 0.38,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.wakePoints = new THREE.Points(geo, mat);
    this.scene.add(this.wakePoints);
    this.wakeIndex = 0;
  }

  emitWake(pos, vel, color, maxLife = 1.2) {
    if (!this.wakePool) return;
    const p = this.wakePool[this.wakeIndex];
    this.wakeIndex = (this.wakeIndex + 1) % this.maxWakeParticles;

    p.active = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    if (color) p.color.copy(color);
    else p.color.setRGB(0.2, 0.85, 1.0);
    p.life = maxLife;
    p.maxLife = maxLife;
  }

  updateHydrodynamicWakes(dt) {
    if (!this.wakePoints) return;
    const posAttr = this.wakePoints.geometry.attributes.position;
    const colAttr = this.wakePoints.geometry.attributes.color;
    const pArr = posAttr.array;
    const cArr = colAttr.array;

    for (let i = 0; i < this.maxWakeParticles; i++) {
      const p = this.wakePool[i];
      const idx3 = i * 3;

      if (p.active) {
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          pArr[idx3 + 1] = -9999;
          continue;
        }

        // Hydrodynamic drag & slow buoyant micro-bubble ascension
        p.vel.multiplyScalar(Math.max(0, 1.0 - dt * 2.2));
        p.pos.addScaledVector(p.vel, dt);
        p.pos.y += dt * 0.14;

        pArr[idx3 + 0] = p.pos.x;
        pArr[idx3 + 1] = p.pos.y;
        pArr[idx3 + 2] = p.pos.z;

        // Fading alpha and bioluminescent dimming
        const progress = 1.0 - (p.life / p.maxLife);
        const alpha = Math.sin((1.0 - progress) * Math.PI * 0.5);

        cArr[idx3 + 0] = p.color.r * alpha;
        cArr[idx3 + 1] = p.color.g * alpha;
        cArr[idx3 + 2] = p.color.b * alpha;
      } else {
        pArr[idx3 + 1] = -9999;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // Graphics Improvement 2: Circadian Oceanic Lighting Cycle
  // --------------------------------------------------------------------------
  updateLightingCycle(dt, elapsed) {
    const cycleDuration = 200.0;
    const progress = (elapsed % cycleDuration) / cycleDuration;

    let sunIntensity, ambientIntensity, causticOpacity, godRayOpacity;
    const sunColor = new THREE.Color();
    const ambColor = new THREE.Color();

    if (progress < 0.38) {
      // Midday: crisp sunlight penetration, vibrant cyan water
      sunIntensity = 1.25;
      ambientIntensity = 0.85;
      causticOpacity = 0.32;
      godRayOpacity = 0.014;
      sunColor.setHex(0x38bdf8);
      ambColor.setHex(0x051b30);
    } else if (progress < 0.52) {
      // Twilight: warm amber/indigo sunset glow
      const t = (progress - 0.38) / 0.14;
      sunIntensity = THREE.MathUtils.lerp(1.25, 0.2, t);
      ambientIntensity = THREE.MathUtils.lerp(0.85, 0.35, t);
      causticOpacity = THREE.MathUtils.lerp(0.32, 0.08, t);
      godRayOpacity = THREE.MathUtils.lerp(0.014, 0.003, t);
      sunColor.lerpColors(new THREE.Color(0x38bdf8), new THREE.Color(0xf59e0b), t);
      ambColor.lerpColors(new THREE.Color(0x051b30), new THREE.Color(0x1e1b4b), t);
    } else if (progress < 0.82) {
      // Midnight Abyssal: deep navy darkness, intense bioluminescent contrast
      sunIntensity = 0.08;
      ambientIntensity = 0.22;
      causticOpacity = 0.04;
      godRayOpacity = 0.002;
      sunColor.setHex(0x312e81);
      ambColor.setHex(0x020817);
    } else {
      // Dawn: emerald morning rays breaking through water surface
      const t = (progress - 0.82) / 0.18;
      sunIntensity = THREE.MathUtils.lerp(0.08, 1.25, t);
      ambientIntensity = THREE.MathUtils.lerp(0.22, 0.85, t);
      causticOpacity = THREE.MathUtils.lerp(0.04, 0.32, t);
      godRayOpacity = THREE.MathUtils.lerp(0.002, 0.014, t);
      sunColor.lerpColors(new THREE.Color(0x312e81), new THREE.Color(0x38bdf8), t);
      ambColor.lerpColors(new THREE.Color(0x020817), new THREE.Color(0x051b30), t);
    }

    this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, sunIntensity, dt * 2.0);
    this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, ambientIntensity, dt * 2.0);
    this.sunLight.color.lerp(sunColor, dt * 2.0);
    this.ambientLight.color.lerp(ambColor, dt * 2.0);

    if (this.causticMat) {
      this.causticMat.opacity = causticOpacity;
    }
    if (this.godRays) {
      this.godRays.forEach(r => {
        r.mesh.material.opacity = godRayOpacity;
      });
    }
  }

  // --------------------------------------------------------------------------
  // Ecosystem Main Frame Update Loop
  // --------------------------------------------------------------------------
  update(dt, elapsed, creatures = null) {
    // Circadian Oceanic Lighting Cycle
    this.updateLightingCycle(dt, elapsed);

    // Dynamic Floor Caustics
    this.updateCaustics(dt, elapsed);

    // Substrate Contact Shadows
    this.updateSubstrateShadows(creatures);

    // Responsive Substrate Flora
    this.updateSubstrateAnemones(dt, elapsed, creatures);

    // Hydrodynamic Cavitation Micro-Wake Particles
    this.updateHydrodynamicWakes(dt);

    // 1. Maintain Balanced Plankton Density (avoids screen clutter)
    if (this.foodItems.length < 20 && Math.random() < 0.14) {
      this.spawnFoodRandom();
    }

    // 2. Animate Food Particles (smooth drift, suction lerping & scale shrink dissolution)
    const dummy = new THREE.Object3D();
    const b = this.bounds;

    for (let i = this.foodItems.length - 1; i >= 0; i--) {
      const f = this.foodItems[i];
      if (f.absorbing) {
        f.absorbProgress += dt * 8.0;
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
          // Ocean Convection Gyres & Plankton Drift
          const gyreCurrent = this.getConvectionCurrent(f.position, elapsed);
          f.position.x += gyreCurrent.x * dt * 0.95;
          f.position.y += gyreCurrent.y * dt * 0.95;
          f.position.z += gyreCurrent.z * dt * 0.95;

          // Gentle ambient buoyancy & micro-eddy oscillation
          f.position.y += Math.sin(elapsed * 0.8 + f.phase) * dt * 0.15;
          f.position.z += Math.cos(elapsed * 0.6 + f.phase) * dt * 0.08;

          // Boundary wrapping with generous margins for smooth loopflow
          if (f.position.x > b.x - 2.5) f.position.x = -b.x + 2.5;
          if (f.position.x < -b.x + 2.5) f.position.x = b.x - 2.5;
          if (f.position.y > b.y - 2.5) f.position.y = -b.y + 2.5;
          if (f.position.y < -b.y + 2.5) f.position.y = b.y - 2.5;
          if (f.position.z > b.z - 1.2) f.position.z = -b.z + 1.2;
          if (f.position.z < -b.z + 1.2) f.position.z = b.z - 1.2;
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

    // 3. Animate Procedural Kelp Swaying + Creature Proximity Deflection
    this.kelpStalks.forEach(stalk => {
      const swayTime = elapsed * stalk.swaySpeed + stalk.phase;
      const numNodes = stalk.nodes.length;
      const stalkX = stalk.group.position.x;
      const stalkZ = stalk.group.position.z;

      let deflectX = 0;
      let deflectZ = 0;
      if (creatures) {
        for (let i = 0; i < creatures.length; i++) {
          const c = creatures[i];
          if (!c.isDead) {
            const dx = stalkX - c.position.x;
            const dz = stalkZ - c.position.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < 18.0) {
              const dist = Math.sqrt(distSq) + 0.001;
              const pushStrength = (1.0 - dist / 4.2) * 0.12;
              deflectX += (dx / dist) * pushStrength;
              deflectZ += (dz / dist) * pushStrength;
            }
          }
        }
      }

      // Smooth organic spring relaxation
      const targetDeflectX = THREE.MathUtils.clamp(deflectX, -0.07, 0.07);
      const targetDeflectZ = THREE.MathUtils.clamp(deflectZ, -0.07, 0.07);
      stalk.currentDeflectX = THREE.MathUtils.lerp(stalk.currentDeflectX || 0, targetDeflectX, dt * 2.4);
      stalk.currentDeflectZ = THREE.MathUtils.lerp(stalk.currentDeflectZ || 0, targetDeflectZ, dt * 2.4);

      stalk.nodes.forEach((node, idx) => {
        const heightProgress = (idx + 1) / numNodes; // 0.1 to 1.0

        // Progressive flexibility: base joints are stable (~2°), upper joints flex supplely with current (~4.5°)
        const jointFlex = THREE.MathUtils.lerp(stalk.baseFlex || 0.035, stalk.tipFlex || 0.075, heightProgress);

        // Fluid traveling S-curve wave (notice the progressive phase offset)
        const wavePhase = swayTime - idx * 0.35;
        const waveZ = Math.sin(wavePhase) * jointFlex +
                      Math.sin(swayTime * 1.8 - idx * 0.5) * (jointFlex * 0.15) +
                      (stalk.currentDeflectZ * heightProgress);

        const waveX = Math.cos(swayTime * 0.65 - idx * 0.25) * (jointFlex * 0.35) +
                      (stalk.currentDeflectX * heightProgress);

        node.rotation.z = waveZ;
        node.rotation.x = waveX;

        // Leaf blade ripple
        if (node.userData.leaf) {
          const leaf = node.userData.leaf;
          const leafFlutter = Math.sin(swayTime * 1.5 - idx * 0.4) * 0.12;
          leaf.rotation.z = leaf.userData.baseZ + leafFlutter;
          leaf.rotation.x = Math.cos(swayTime * 1.1 - idx * 0.3) * 0.08;
        }
      });
    });

    // 4. Animate Volumetric God Rays
    this.godRays.forEach(ray => {
      ray.mesh.position.x += Math.sin(elapsed * ray.speed + ray.phase) * dt * 0.25;
    });

    // 5. Animate Marine Snow Particulates
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
