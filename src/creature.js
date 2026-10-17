import * as THREE from 'three';
import { Connectome, NUM_SENSORY, NUM_HIDDEN, NUM_MOTOR } from './neural.js';
import { soundEngine } from './audio.js';

let nextCreatureId = 1;

// Reusable scratch objects to eliminate GC pressure in animation loop
const _scratchVec3A = new THREE.Vector3();
const _scratchVec3B = new THREE.Vector3();
const _scratchVec3C = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();

export class Creature {
  constructor(position, genome = null, generation = 1) {
    this.id = nextCreatureId++;
    this.generation = generation;
    this.connectome = new Connectome(genome);
    const traits = this.connectome.genome.traits;

    // Physiological state
    this.energy = 100.0;
    this.maxEnergy = 220.0;
    this.age = 0.0;
    this.foodEaten = 0;
    this.fitness = 0.0;
    this.isDead = false;
    this.fadeAlpha = 1.0;
    this.isHovered = false;
    this.isSelected = false;
    this.highlightedNeuron = null;
    this.sensoryInputs = new Float32Array(NUM_SENSORY);

    // Kinematics & Spatial Orientation
    this.position = position ? position.clone() : new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.quaternion = new THREE.Quaternion();
    this.speed = 0.0;
    this.maxSpeed = (traits && traits.maxSpeed) ? traits.maxSpeed : 10.0;
    this.headingAngle = Math.random() * Math.PI * 2;
    this.heading = new THREE.Vector3(Math.cos(this.headingAngle), Math.sin(this.headingAngle), 0);
    this.pitch = 0.0;
    this.yaw = 0.0;
    this.roll = 0.0;

    // Internal biological clock & continuous wave phases
    this.clock = Math.random() * 100.0;
    this.tailPhase = Math.random() * Math.PI * 2;
    this.finPhase = Math.random() * Math.PI * 2;

    // Primary 3D Group
    this.mesh = new THREE.Group();
    this.mesh.position.copy(this.position);
    this.mesh.userData = { creature: this };

    // Primary Colors
    this.color = new THREE.Color().setHSL(traits.hue, 0.9, 0.6);
    this.emissiveColor = new THREE.Color().setHSL(traits.hue, 1.0, 0.4);

    this.buildBody();
    this.buildConnectome3D();
  }

  buildBody() {
    const traits = this.connectome.genome.traits;

    // 1. Translucent Head / Main Body Pod (Subsurface scattering style)
    const headGeo = new THREE.SphereGeometry(1.2, 24, 20);
    headGeo.scale(0.85, 0.7, 1.4); // Streamlined teardrop pod

    this.headMat = new THREE.MeshPhysicalMaterial({
      color: this.color,
      emissive: this.emissiveColor,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.85,
      roughness: 0.35,
      metalness: 0.05,
      transmission: 0.2,
      ior: 1.33,
      thickness: 1.0
    });

    this.headMesh = new THREE.Mesh(headGeo, this.headMat);
    this.headMesh.position.set(0, 0, 0.2);
    this.headMesh.userData = { creature: this };
    this.mesh.add(this.headMesh);

    // 2. Sensory Antennae (Left & Right) with receptor tips
    const antLen = 1.2 * traits.antennaLength;
    const antGeo = new THREE.CylinderGeometry(0.03, 0.08, antLen, 8);
    const antMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      roughness: 0.3,
      metalness: 0.5
    });

    // Left Antenna
    this.antennaL = new THREE.Group();
    const antMeshL = new THREE.Mesh(antGeo, antMat);
    antMeshL.position.y = antLen * 0.5;
    this.antennaL.add(antMeshL);
    this.antennaL.position.set(-0.6, 0.3, 1.3);
    this.antennaL.rotation.set(0.4, -0.3, 0.4);

    // Tip Receptor Bulb Left
    const bulbGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.bulbMatL = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const bulbL = new THREE.Mesh(bulbGeo, this.bulbMatL);
    bulbL.position.y = antLen;
    this.antennaL.add(bulbL);
    this.mesh.add(this.antennaL);

    // Right Antenna
    this.antennaR = new THREE.Group();
    const antMeshR = new THREE.Mesh(antGeo, antMat);
    antMeshR.position.y = antLen * 0.5;
    this.antennaR.add(antMeshR);
    this.antennaR.position.set(0.6, 0.3, 1.3);
    this.antennaR.rotation.set(0.4, 0.3, -0.4);

    // Tip Receptor Bulb Right
    this.bulbMatR = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const bulbR = new THREE.Mesh(bulbGeo, this.bulbMatR);
    bulbR.position.y = antLen;
    this.antennaR.add(bulbR);
    this.mesh.add(this.antennaR);

    // 3. Pectoral Fins (Left & Right)
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.quadraticCurveTo(0.4, 0.8, 1.2 * traits.finSize, 0.3);
    finShape.quadraticCurveTo(0.6, -0.2, 0, 0);

    const finGeo = new THREE.ShapeGeometry(finShape);
    this.finMat = new THREE.MeshStandardMaterial({
      color: this.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      roughness: 0.3
    });

    this.finL = new THREE.Mesh(finGeo, this.finMat);
    this.finL.position.set(-0.8, -0.1, 0.2);
    this.finL.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.75);
    this.mesh.add(this.finL);

    this.finR = new THREE.Mesh(finGeo, this.finMat);
    this.finR.position.set(0.8, -0.1, 0.2);
    this.finR.rotation.set(Math.PI * 0.5, 0, -Math.PI * 0.75);
    this.finR.scale.set(-1, 1, 1);
    this.mesh.add(this.finR);

    // 4. Segmented Undulating Tail Spine (4 linked segments)
    this.tailSegments = [];
    let parentGroup = this.mesh;
    const numSegments = 5;

    for (let i = 0; i < numSegments; i++) {
      const segGroup = new THREE.Group();
      segGroup.position.set(0, 0, i === 0 ? -0.8 : -0.7);

      const radius = Math.max(0.15, 0.65 * (1.0 - (i / numSegments) * 0.75));
      const segGeo = new THREE.SphereGeometry(radius, 12, 10);
      segGeo.scale(1.0, 0.8, 1.3);

      const segMat = new THREE.MeshStandardMaterial({
        color: this.color,
        roughness: 0.3,
        transparent: true,
        opacity: 0.7 - i * 0.08
      });
      const segMesh = new THREE.Mesh(segGeo, segMat);
      segGroup.add(segMesh);

      parentGroup.add(segGroup);
      this.tailSegments.push(segGroup);
      parentGroup = segGroup;
    }

    // Caudal Fluke / Tail Fin at final segment
    const flukeShape = new THREE.Shape();
    flukeShape.moveTo(0, 0);
    flukeShape.lineTo(-0.8, -0.9);
    flukeShape.quadraticCurveTo(0, -0.6, 0.8, -0.9);
    flukeShape.closePath();

    const flukeGeo = new THREE.ShapeGeometry(flukeShape);
    const flukeMesh = new THREE.Mesh(flukeGeo, this.finMat);
    flukeMesh.rotation.set(0, 0, 0);
    flukeMesh.position.set(0, 0, -0.4);
    this.tailSegments[numSegments - 1].add(flukeMesh);

    // Targeting Reticle (holographic bracket ring)
    const ringGeo = new THREE.RingGeometry(1.6, 1.8, 32);
    this.reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });
    this.reticle = new THREE.Mesh(ringGeo, this.reticleMat);
    this.reticle.rotation.x = Math.PI * 0.5;
    this.mesh.add(this.reticle);

    // 5. Internal Digestive Stomach Pouch & Nutrient Bolus
    const stomachGeo = new THREE.SphereGeometry(0.48, 14, 10);
    stomachGeo.scale(0.85, 0.7, 1.15);
    this.stomachMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.65,
      roughness: 0.25,
      transmission: 0.35,
      ior: 1.3
    });
    this.stomachMesh = new THREE.Mesh(stomachGeo, this.stomachMat);
    this.stomachMesh.position.set(0, -0.15, -0.15);
    this.mesh.add(this.stomachMesh);

    // Glowing food bolus that pulses and dissolves over time
    const bolusGeo = new THREE.SphereGeometry(0.28, 12, 10);
    this.bolusMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.0
    });
    this.bolusMesh = new THREE.Mesh(bolusGeo, this.bolusMat);
    this.bolusMesh.scale.set(0.001, 0.001, 0.001);
    this.stomachMesh.add(this.bolusMesh);
    this.bolusScale = 0.0;

    // 6. Ventral Spinal Canal running down tail vertebrae
    this.spinalNodes = [];
    for (let i = 0; i < this.tailSegments.length; i++) {
      const canalGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.55, 6);
      canalGeo.rotateX(Math.PI * 0.5);
      const canalMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
      });
      const canalMesh = new THREE.Mesh(canalGeo, canalMat);
      canalMesh.position.set(0, 0.06, -0.1);
      this.tailSegments[i].add(canalMesh);
      this.spinalNodes.push(canalMesh);
    }
  }

  /**
   * Constructs the internal 3D suspended neural network inside the head pod
   */
  buildConnectome3D() {
    this.neuralGroup = new THREE.Group();
    this.neuralGroup.position.set(0, 0, 0.2);
    this.mesh.add(this.neuralGroup);

    // Node Positions in Local Head Coordinates
    this.nodePositions = {
      sensory: [],
      hidden: [],
      motor: []
    };

    // 8 Sensory Nodes (front arc)
    for (let i = 0; i < NUM_SENSORY; i++) {
      const angle = ((i / (NUM_SENSORY - 1)) - 0.5) * Math.PI * 0.9;
      const x = Math.sin(angle) * 0.55;
      const y = ((i % 2 === 0) ? 0.15 : -0.15);
      const z = Math.cos(angle) * 0.4 + 0.45;
      this.nodePositions.sensory.push(new THREE.Vector3(x, y, z));
    }

    // 4 Hidden Nodes (center cluster)
    const hiddenCoords = [
      new THREE.Vector3(-0.25, 0.15, 0.1),
      new THREE.Vector3(0.25, 0.15, 0.1),
      new THREE.Vector3(-0.25, -0.15, 0.0),
      new THREE.Vector3(0.25, -0.15, 0.0)
    ];
    this.nodePositions.hidden = hiddenCoords;

    // 4 Motor Nodes (posterior ring)
    const motorCoords = [
      new THREE.Vector3(-0.4, 0.0, -0.35),  // Thrust Left
      new THREE.Vector3(0.4, 0.0, -0.35),   // Thrust Right
      new THREE.Vector3(0.0, 0.25, -0.4),   // Pitch
      new THREE.Vector3(0.0, -0.25, -0.4)   // Tail Burst
    ];
    this.nodePositions.motor = motorCoords;

    // 3D Spheres for Neurons
    this.neuronMeshes = { sensory: [], hidden: [], motor: [] };

    const createNeuronMesh = (pos, baseColor) => {
      const geo = new THREE.SphereGeometry(0.07, 10, 8);
      const mat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      this.neuralGroup.add(mesh);
      return mesh;
    };

    // Sensory: Cyan (0x00e5ff)
    this.nodePositions.sensory.forEach(p => {
      this.neuronMeshes.sensory.push(createNeuronMesh(p, 0x00e5ff));
    });

    // Hidden: Violet / Magenta (0xd500f9)
    this.nodePositions.hidden.forEach(p => {
      this.neuronMeshes.hidden.push(createNeuronMesh(p, 0xd500f9));
    });

    // Motor: Golden Amber (0xffd600)
    this.nodePositions.motor.forEach(p => {
      this.neuronMeshes.motor.push(createNeuronMesh(p, 0xffd600));
    });

    // 3D Synaptic Connections (Lines)
    this.buildSynapticLines();

    // Action potential pulse particle pool (instanced 3D glowing sparks)
    const pulseGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.pulseMeshPool = [];
    for (let i = 0; i < 24; i++) {
      const pMesh = new THREE.Mesh(pulseGeo, pulseMat);
      pMesh.visible = false;
      this.neuralGroup.add(pMesh);
      this.pulseMeshPool.push(pMesh);
    }
  }

  buildSynapticLines() {
    const linePositions = [];
    const lineColors = [];
    const genome = this.connectome.genome;

    const addSynapse = (p1, p2, weight) => {
      if (Math.abs(weight) < 0.3) return; // Threshold for visual clarity
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      // Excitatory = golden/cyan, Inhibitory = scarlet/purple
      if (weight > 0) {
        lineColors.push(0.0, 0.9, 1.0, 0.0, 0.9, 1.0);
      } else {
        lineColors.push(1.0, 0.2, 0.4, 1.0, 0.2, 0.4);
      }
    };

    // Sensory to Hidden
    for (let h = 0; h < NUM_HIDDEN; h++) {
      for (let s = 0; s < NUM_SENSORY; s++) {
        addSynapse(this.nodePositions.sensory[s], this.nodePositions.hidden[h], genome.wSensoryHidden[h][s]);
      }
    }

    // Hidden to Hidden (Recurrent)
    for (let h1 = 0; h1 < NUM_HIDDEN; h1++) {
      for (let h2 = 0; h2 < NUM_HIDDEN; h2++) {
        if (h1 !== h2) {
          addSynapse(this.nodePositions.hidden[h1], this.nodePositions.hidden[h2], genome.wRecurrent[h1][h2]);
        }
      }
    }

    // Hidden to Motor
    for (let m = 0; m < NUM_MOTOR; m++) {
      for (let h = 0; h < NUM_HIDDEN; h++) {
        addSynapse(this.nodePositions.hidden[h], this.nodePositions.motor[m], genome.wHiddenMotor[m][h]);
      }
    }

    // Direct Reflexes (Sensory to Motor)
    for (let m = 0; m < NUM_MOTOR; m++) {
      for (let s = 0; s < NUM_SENSORY; s++) {
        addSynapse(this.nodePositions.sensory[s], this.nodePositions.motor[m], genome.wDirect[m][s]);
      }
    }

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    this.synapseLines = new THREE.LineSegments(lineGeo, lineMat);
    this.neuralGroup.add(this.synapseLines);
  }

  /**
   * Main per-frame simulation update
   */
  update(dt, environment) {
    if (this.isDead) {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - dt * 1.5);
      this.mesh.scale.multiplyScalar(0.97);
      return;
    }

    this.age += dt;
    this.clock += dt * 2.2;

    // 1. Gather Sensory Inputs from Environment
    const sensoryInputs = this.gatherSensoryInputs(environment);

    // 2. Step Neural Connectome Forward
    const motor = this.connectome.step(sensoryInputs, dt);

    // Motor outputs: [0: thrustL, 1: thrustR, 2: pitch, 3: tailBurst]
    const thrustL = motor[0];
    const thrustR = motor[1];
    const pitchCmd = motor[2];
    const tailBurst = motor[3];

    // 3. 2.5D Tank Swimming Kinematics
    const forwardThrust = Math.max(0.12, (thrustL + thrustR) * 0.5 + tailBurst * 0.7);
    const steerRate = (thrustL - thrustR) * 3.2; // Steer left / right in XY plane
    const pitchRate = pitchCmd * 2.2;            // Pitch up / down in XY plane

    this.headingAngle += steerRate * dt;

    // Heading vector predominantly in XY plane with subtle organic Z depth drift
    const zDrift = Math.sin(this.clock * 0.7) * 0.2;
    _scratchVec3A.set(
      Math.cos(this.headingAngle),
      Math.sin(this.headingAngle) + pitchRate * 0.45,
      zDrift
    ).normalize();

    this.heading.lerp(_scratchVec3A, dt * 5.5).normalize();

    if (this.heading.lengthSq() > 0.0001) {
      this.heading.normalize();
      _scratchVec3B.copy(this.position).add(this.heading);
      this.mesh.lookAt(_scratchVec3B);
      this.quaternion.copy(this.mesh.quaternion);
    }

    // Accelerate along heading
    const targetSpeed = forwardThrust * (this.maxSpeed || 10.0);
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 3.8);
    if (!Number.isFinite(this.speed)) this.speed = 0.0;

    // 2.5D Tank Boundary Repulsion & Active Heading Steering
    const bounds = environment.bounds;
    _scratchVec3C.set(0, 0, 0);
    if (Math.abs(this.position.x) > bounds.x - 3.5) {
      _scratchVec3C.x = -Math.sign(this.position.x) * (Math.abs(this.position.x) - (bounds.x - 3.5)) * 8.0;
    }
    if (Math.abs(this.position.y) > bounds.y - 3.5) {
      _scratchVec3C.y = -Math.sign(this.position.y) * (Math.abs(this.position.y) - (bounds.y - 3.5)) * 8.0;
    }
    // Stronger Z containment so they stay within the cross-section
    if (Math.abs(this.position.z) > bounds.z - 1.5) {
      _scratchVec3C.z = -Math.sign(this.position.z) * (Math.abs(this.position.z) - (bounds.z - 1.5)) * 12.0;
    }
    // Continuous gentle spring toward Z = 0
    _scratchVec3C.z -= this.position.z * 2.0;

    // Smoothly turn headingAngle away from walls so creatures don't get trapped against tank boundaries
    if (Math.abs(_scratchVec3C.x) > 0.1 || Math.abs(_scratchVec3C.y) > 0.1) {
      const awayAngle = Math.atan2(_scratchVec3C.y, _scratchVec3C.x);
      const diff = Math.atan2(Math.sin(awayAngle - this.headingAngle), Math.cos(awayAngle - this.headingAngle));
      this.headingAngle += diff * Math.min(1.0, dt * 4.5);
    }

    this.velocity.copy(this.heading).multiplyScalar(this.speed);
    this.velocity.addScaledVector(_scratchVec3C, dt);

    this.position.addScaledVector(this.velocity, dt);
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y)) {
      this.position.set(0, 0, 0);
    }
    this.mesh.position.copy(this.position);

    // Reticle animation
    if (this.isSelected) {
      this.reticleMat.opacity = 0.85;
      this.reticleMat.color.setHex(0x00e5ff);
      this.reticle.rotation.z += dt * 0.75;
    } else if (this.isHovered) {
      this.reticleMat.opacity = 0.55;
      this.reticleMat.color.setHex(0x73d2ff);
      this.reticle.rotation.z += dt * 1.2;
    } else {
      this.reticleMat.opacity = 0.0;
    }

    // 4. Animate Undulating Anatomy with hydrodynamic banking
    this.animateAnatomy(thrustL, thrustR, tailBurst, dt, steerRate);

    // 4b. Hydrodynamic Cavitation Micro-Wake Particles
    this.emitHydrodynamicWakes(environment, tailBurst, dt);

    // 5. Update 3D Connectome Visual Pulses & Neuron Glows
    this.updateConnectomeVisuals();

    // 6. Food Consumption Check at Mouth Tip with Suction
    this.checkFoodConsumption(environment, dt);

    // 7. Metabolic Energy Cost
    const metabolicCost = (0.8 + Math.pow(this.speed / this.maxSpeed, 2) * 2.2) * this.connectome.genome.traits.metabolism * dt;
    this.energy -= metabolicCost;
    this.fitness += this.speed * dt * 0.1;

    if (this.energy <= 0) {
      this.isDead = true;
    }
  }

  gatherSensoryInputs(environment) {
    const inputs = this.sensoryInputs;
    inputs.fill(0);

    // Find nearest food
    const nearest = environment.getNearestFood(this.position);

    if (nearest) {
      _scratchVec3A.copy(nearest.position).sub(this.position);
      const dist = _scratchVec3A.length();
      if (dist > 0.0001) _scratchVec3A.divideScalar(dist);

      // Transform food vector to local creature coordinates
      _scratchQuat.copy(this.quaternion).invert();
      const localFoodDir = _scratchVec3A.applyQuaternion(_scratchQuat);

      // S0: Food Left (positive when food is to the left: -x)
      inputs[0] = Math.max(0, -localFoodDir.x) * Math.max(0, localFoodDir.z);
      // S1: Food Right (positive when food is to the right: +x)
      inputs[1] = Math.max(0, localFoodDir.x) * Math.max(0, localFoodDir.z);
      // S2: Food Proximity (1.0 when touching, 0.0 far away)
      inputs[2] = 1.0 / (1.0 + dist * 0.15);
      // S3: Food Pitch (elevation angle)
      inputs[3] = localFoodDir.y;

      // Glow antenna bulbs proportionally
      this.bulbMatL.color.setRGB(0, 0.5 + inputs[0] * 0.5, 1.0);
      this.bulbMatR.color.setRGB(0, 0.5 + inputs[1] * 0.5, 1.0);
    }

    // S4: Wall / Boundary Proximity Alert
    const b = environment.bounds;
    const wallProx = Math.max(
      Math.abs(this.position.x) / b.x,
      Math.abs(this.position.y) / b.y,
      Math.abs(this.position.z) / b.z
    );
    inputs[4] = Math.max(0, (wallProx - 0.7) / 0.3);

    // S5: Speed Proprioception
    inputs[5] = this.speed / this.maxSpeed;

    // S6: Hunger / Energy State
    inputs[6] = 1.0 - Math.min(1.0, this.energy / 100.0);

    // S7: Central Pattern Generator Gait Clock
    inputs[7] = Math.sin(this.clock);

    return inputs;
  }

  animateAnatomy(thrustL, thrustR, tailBurst, dt, steerRate = 0) {
    const speedRatio = THREE.MathUtils.clamp(this.speed / (this.maxSpeed || 10.0), 0.1, 1.5);

    // Continuous wave phase accumulation - eliminates frequency-shift phase jumping & jitter!
    const finFlapFreq = 3.6 + speedRatio * 3.2;
    this.finPhase += dt * finFlapFreq;

    // Energetic swimming frequency (3.8 Hz idle -> 9.5 Hz burst)
    const waveFreq = 3.8 + tailBurst * 4.5 + speedRatio * 2.8;
    this.tailPhase += dt * waveFreq;

    // Dynamic banking roll into turns (fluid aquatic hydrodynamics)
    const targetRoll = THREE.MathUtils.clamp(-steerRate * 0.22, -0.55, 0.55);
    this.roll = THREE.MathUtils.lerp(this.roll, targetRoll, dt * 5.5);
    this.mesh.rotation.z = this.roll;

    // Pectoral fins flap vigorously with differential thrust and 3D fluttering
    const finAmpL = 0.38 * (0.7 + Math.abs(thrustL) * 0.5);
    const finAmpR = 0.38 * (0.7 + Math.abs(thrustR) * 0.5);
    this.finL.rotation.z = Math.PI * 0.75 + Math.sin(this.finPhase) * finAmpL;
    this.finR.rotation.z = -Math.PI * 0.75 - Math.sin(this.finPhase) * finAmpR;
    this.finL.rotation.x = Math.cos(this.finPhase) * 0.22;
    this.finR.rotation.x = Math.cos(this.finPhase) * 0.22;

    // Tail Spine undulation down parent-child hierarchy
    // Natural biological fish kinematics: amplitude increases progressively toward the caudal fin
    const numSegs = this.tailSegments.length;
    this.tailSegments.forEach((seg, idx) => {
      const segPhase = this.tailPhase - idx * 0.58;
      // Progressive joint amplitude: ~12° at base to ~30° at caudal fluke
      const jointAmp = (0.20 + (idx / numSegs) * 0.32) * (1.0 + tailBurst * 0.7);

      // Flex across both lateral (Y) and vertical/pitch (X) axes for rich 3D visibility from all camera angles
      seg.rotation.y = Math.sin(segPhase) * jointAmp;
      seg.rotation.x = Math.cos(segPhase * 0.5) * (jointAmp * 0.45);
      seg.rotation.z = Math.sin(segPhase * 0.5) * (jointAmp * 0.18);
    });

    // Animate Internal Digestive Bolus Dissolution & Nutrient Absorption
    if (this.bolusScale > 0.001) {
      this.bolusScale = Math.max(0, this.bolusScale - dt * 0.28);
      const pulse = 1.0 + Math.sin(this.clock * 7.0) * 0.14;
      const s = this.bolusScale * pulse;
      if (this.bolusMesh) this.bolusMesh.scale.set(s, s, s);
      if (this.bolusMat) this.bolusMat.opacity = Math.min(1.0, this.bolusScale * 1.4);
      if (this.stomachMat) {
        this.stomachMat.emissiveIntensity = THREE.MathUtils.lerp(this.stomachMat.emissiveIntensity, 0.25 + this.bolusScale * 0.4, dt * 3.5);
      }
    } else {
      if (this.bolusMesh) this.bolusMesh.scale.set(0.001, 0.001, 0.001);
      if (this.bolusMat) this.bolusMat.opacity = 0;
      if (this.stomachMat) {
        this.stomachMat.emissiveIntensity = THREE.MathUtils.lerp(this.stomachMat.emissiveIntensity, 0.2, dt * 2.0);
      }
    }

    // Ventral spinal cord glows with active motor impulses and metabolic energy
    if (this.spinalNodes) {
      const motorPulse = Math.abs(thrustL) + Math.abs(thrustR) + tailBurst;
      this.spinalNodes.forEach((node, idx) => {
        const wave = Math.sin(this.tailPhase - idx * 0.6);
        const intensity = 0.35 + (motorPulse * 0.35) + wave * 0.2 + (this.bolusScale * 0.3);
        node.material.opacity = THREE.MathUtils.clamp(intensity, 0.15, 0.95);
      });
    }
  }

  updateConnectomeVisuals() {
    // Scale and brighten neuron nodes based on dynamic activation
    const c = this.connectome;

    // Sensory Neurons
    for (let i = 0; i < NUM_SENSORY; i++) {
      const val = Math.abs(c.sensoryValues[i]);
      const mesh = this.neuronMeshes.sensory[i];
      const scale = 0.8 + val * 1.2;
      mesh.scale.set(scale, scale, scale);
    }

    // Hidden Neurons
    for (let i = 0; i < NUM_HIDDEN; i++) {
      const val = Math.abs(c.hiddenValues[i]);
      const mesh = this.neuronMeshes.hidden[i];
      const scale = 0.9 + val * 1.4;
      mesh.scale.set(scale, scale, scale);
    }

    // Motor Neurons
    for (let i = 0; i < NUM_MOTOR; i++) {
      const val = Math.abs(c.motorValues[i]);
      const mesh = this.neuronMeshes.motor[i];
      const scale = 0.9 + val * 1.5;
      mesh.scale.set(scale, scale, scale);
    }

    // Highlight hovered neuron if set from HUD
    if (this.highlightedNeuron) {
      const hMesh = this.neuronMeshes[this.highlightedNeuron.type]?.[this.highlightedNeuron.idx];
      if (hMesh) {
        hMesh.scale.set(3.0, 3.0, 3.0);
      }
    }

    // Render Action Potential Pulses along 3D Synapses
    const pulses = c.activePulses;
    this.pulseMeshPool.forEach((pMesh, idx) => {
      if (idx < pulses.length) {
        const p = pulses[idx];
        const fromPos = this.getNodePos(p.fromType, p.fromIdx);
        const toPos = this.getNodePos(p.toType, p.toIdx);

        if (fromPos && toPos) {
          pMesh.position.lerpVectors(fromPos, toPos, p.progress);
          pMesh.visible = true;
          const s = 1.0 - Math.abs(p.progress - 0.5) * 0.8;
          pMesh.scale.set(s, s, s);
        } else {
          pMesh.visible = false;
        }
      } else {
        pMesh.visible = false;
      }
    });
  }

  getNodePos(type, idx) {
    if (type === 'sensory') return this.nodePositions.sensory[idx];
    if (type === 'hidden') return this.nodePositions.hidden[idx];
    if (type === 'motor') return this.nodePositions.motor[idx];
    return null;
  }

  checkFoodConsumption(environment, dt = 0.016) {
    // Exact mouth / snout point at front tip of creature
    const mouthPos = _scratchVec3A.copy(this.position).addScaledVector(this.heading, 1.4);
    const eatenCount = environment.attractAndConsumeFood(mouthPos, 3.4, 1.35, dt);

    if (eatenCount > 0) {
      this.foodEaten += eatenCount;
      this.energy = Math.min(this.maxEnergy, this.energy + eatenCount * 38.0);
      this.fitness += eatenCount * 120.0;

      // Ingestion into internal digestive tract pouch
      this.bolusScale = 1.0;
      if (this.bolusMat) this.bolusMat.opacity = 0.95;
      if (this.stomachMat) this.stomachMat.emissiveIntensity = 0.85;

      // Bioluminescent ingestion flash
      this.headMat.emissiveIntensity = 0.95;

      // Antennae twitch forward dip reflex on ingestion
      this.antennaL.rotation.x += 0.35;
      this.antennaR.rotation.x += 0.35;

      if (this.isSelected) {
        soundEngine.playFeed();
      }
    } else {
      this.headMat.emissiveIntensity = THREE.MathUtils.lerp(this.headMat.emissiveIntensity, 0.15, dt * 5.0);
      this.antennaL.rotation.x = THREE.MathUtils.lerp(this.antennaL.rotation.x, 0.4, dt * 6.0);
      this.antennaR.rotation.x = THREE.MathUtils.lerp(this.antennaR.rotation.x, 0.4, dt * 6.0);
    }
  }

  emitHydrodynamicWakes(environment, tailBurst, dt) {
    if (!environment || !environment.emitWake || this.isDead || this.speed < 0.45) return;

    this.wakeTimer = (this.wakeTimer || 0) + dt;
    const emitInterval = Math.max(0.025, 0.08 - (this.speed / 10.0) * 0.04);

    if (this.wakeTimer >= emitInterval) {
      this.wakeTimer = 0;

      // 1. Caudal fluke wake vortex emission
      if (this.tailSegments && this.tailSegments.length > 0) {
        const flukeSeg = this.tailSegments[this.tailSegments.length - 1];
        flukeSeg.getWorldPosition(_scratchVec3A);
        _scratchVec3B.copy(this.heading).multiplyScalar(-this.speed * 0.12);
        _scratchVec3B.x += (Math.random() - 0.5) * 0.2;
        _scratchVec3B.y += (Math.random() - 0.5) * 0.2;
        environment.emitWake(_scratchVec3A, _scratchVec3B, this.color, 0.9 + tailBurst * 0.5);
      }

      // 2. Fin tip vortices on sprints or high speeds
      if (tailBurst > 0.3 || this.speed > 5.0) {
        if (this.finL) {
          this.finL.getWorldPosition(_scratchVec3A);
          _scratchVec3B.copy(this.heading).multiplyScalar(-this.speed * 0.08);
          environment.emitWake(_scratchVec3A, _scratchVec3B, this.color, 0.7);
        }
        if (this.finR) {
          this.finR.getWorldPosition(_scratchVec3A);
          _scratchVec3B.copy(this.heading).multiplyScalar(-this.speed * 0.08);
          environment.emitWake(_scratchVec3A, _scratchVec3B, this.color, 0.7);
        }
      }
    }
  }

  canReproduce() {
    return this.energy > 175.0 && this.age > 8.0;
  }

  reproduce() {
    this.energy *= 0.55;
    const childGenome = this.connectome.cloneAndMutate();
    const spawnPos = this.position.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 2.0)
    );
    return new Creature(spawnPos, childGenome.genome, this.generation + 1);
  }

  rebuildSynapticLines() {
    if (this.synapseLines) {
      this.neuralGroup.remove(this.synapseLines);
      this.synapseLines.geometry.dispose();
      this.synapseLines.material.dispose();
    }
    this.buildSynapticLines();
  }

  stimulateNeuron(type, idx) {
    this.connectome.stimulate(type, idx);
    this.headMat.emissiveIntensity = 1.0;
    const mesh = this.neuronMeshes[type]?.[idx];
    if (mesh) {
      mesh.scale.set(3.2, 3.2, 3.2);
    }
  }

  highlightNeuron(type, idx) {
    this.highlightedNeuron = (type && idx !== undefined && idx !== null) ? { type, idx } : null;
  }

  getChaseCamPos(targetVec = new THREE.Vector3()) {
    return targetVec.copy(this.position)
      .addScaledVector(this.heading, -8.5)
      .add(new THREE.Vector3(0, 3.2, 0));
  }

  getMacroCamPos(targetVec = new THREE.Vector3()) {
    return targetVec.copy(this.position)
      .addScaledVector(this.heading, 3.2)
      .add(new THREE.Vector3(1.0, 0.8, 0));
  }

  getLookAtPos(targetVec = new THREE.Vector3()) {
    return targetVec.copy(this.position).addScaledVector(this.heading, 1.2);
  }

  dispose() {
    this.mesh.traverse(child => {
      if (child.isMesh || child.isLine || child.isLineSegments || child.isPoints) {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m && m.dispose && m.dispose());
          } else if (child.material.dispose) {
            child.material.dispose();
          }
        }
      }
    });
  }
}
