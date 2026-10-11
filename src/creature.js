import * as THREE from 'three';
import { Connectome, NUM_SENSORY, NUM_HIDDEN, NUM_MOTOR } from './neural.js';

let nextCreatureId = 1;

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

    // Internal biological clock
    this.clock = Math.random() * 100.0;

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
    this.clock += dt * 4.0;

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
    const targetHeading = new THREE.Vector3(
      Math.cos(this.headingAngle),
      Math.sin(this.headingAngle) + pitchRate * 0.45,
      zDrift
    ).normalize();

    this.heading.lerp(targetHeading, dt * 5.5).normalize();

    if (this.heading.lengthSq() > 0.0001) {
      this.heading.normalize();
      const lookTarget = this.position.clone().add(this.heading);
      this.mesh.lookAt(lookTarget);
      this.quaternion.copy(this.mesh.quaternion);
    }

    // Accelerate along heading
    const targetSpeed = forwardThrust * (this.maxSpeed || 10.0);
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * 3.8);
    if (!Number.isFinite(this.speed)) this.speed = 0.0;
    this.velocity.copy(this.heading).multiplyScalar(this.speed);

    // 2.5D Tank Boundary Repulsion & Z-Depth Centering
    const bounds = environment.bounds;
    const boundaryPush = new THREE.Vector3();
    if (Math.abs(this.position.x) > bounds.x - 3) boundaryPush.x = -Math.sign(this.position.x) * (Math.abs(this.position.x) - (bounds.x - 3)) * 6.0;
    if (Math.abs(this.position.y) > bounds.y - 3) boundaryPush.y = -Math.sign(this.position.y) * (Math.abs(this.position.y) - (bounds.y - 3)) * 6.0;
    // Stronger Z containment so they stay within the cross-section
    if (Math.abs(this.position.z) > bounds.z - 1.5) boundaryPush.z = -Math.sign(this.position.z) * (Math.abs(this.position.z) - (bounds.z - 1.5)) * 12.0;
    // Continuous gentle spring toward Z = 0
    boundaryPush.z -= this.position.z * 1.8;
    this.velocity.addScaledVector(boundaryPush, dt);

    this.position.addScaledVector(this.velocity, dt);
    if (!Number.isFinite(this.position.x) || !Number.isFinite(this.position.y)) {
      this.position.set(0, 0, 0);
    }
    this.mesh.position.copy(this.position);

    // Reticle animation
    if (this.isSelected) {
      this.reticleMat.opacity = 0.85;
      this.reticleMat.color.setHex(0x00e5ff);
      this.reticle.rotation.z += dt * 1.5;
    } else if (this.isHovered) {
      this.reticleMat.opacity = 0.55;
      this.reticleMat.color.setHex(0x73d2ff);
      this.reticle.rotation.z += dt * 3.0;
    } else {
      this.reticleMat.opacity = 0.0;
    }

    // 4. Animate Undulating Anatomy
    this.animateAnatomy(thrustL, thrustR, tailBurst, dt);

    // 5. Update 3D Connectome Visual Pulses & Neuron Glows
    this.updateConnectomeVisuals();

    // 6. Food Consumption Check
    this.checkFoodConsumption(environment);

    // 7. Metabolic Energy Cost
    const metabolicCost = (0.8 + Math.pow(this.speed / this.maxSpeed, 2) * 2.2) * this.connectome.genome.traits.metabolism * dt;
    this.energy -= metabolicCost;
    this.fitness += this.speed * dt * 0.1;

    if (this.energy <= 0) {
      this.isDead = true;
    }
  }

  gatherSensoryInputs(environment) {
    const inputs = new Float32Array(NUM_SENSORY);

    // Find nearest food
    const nearest = environment.getNearestFood(this.position);

    if (nearest) {
      const toFood = nearest.position.clone().sub(this.position);
      const dist = toFood.length();
      toFood.normalize();

      // Transform food vector to local creature coordinates
      const invQuat = this.quaternion.clone().invert();
      const localFoodDir = toFood.applyQuaternion(invQuat);

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

  animateAnatomy(thrustL, thrustR, tailBurst, dt) {
    // Fins flap based on thrust
    const finFlapFreq = 4.0 + this.speed * 1.5;
    this.finL.rotation.z = Math.PI * 0.75 + Math.sin(this.clock * finFlapFreq) * 0.3 * (0.5 + Math.abs(thrustL));
    this.finR.rotation.z = -Math.PI * 0.75 - Math.sin(this.clock * finFlapFreq) * 0.3 * (0.5 + Math.abs(thrustR));

    // Tail Spine undulation (serpentine wave propagation)
    const waveFreq = 3.5 + tailBurst * 4.0 + this.speed * 0.8;
    const waveAmp = 0.28 + tailBurst * 0.2;

    this.tailSegments.forEach((seg, idx) => {
      const phase = this.clock * waveFreq - idx * 0.7;
      seg.rotation.y = Math.sin(phase) * waveAmp;
      seg.rotation.x = Math.cos(phase * 0.5) * (waveAmp * 0.3);
    });
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

  checkFoodConsumption(environment) {
    const eatenList = environment.consumeFoodNear(this.position, 1.8);
    if (eatenList > 0) {
      this.foodEaten += eatenList;
      this.energy = Math.min(this.maxEnergy, this.energy + eatenList * 38.0);
      this.fitness += eatenList * 120.0;

      // Glow pulse body on feeding
      this.headMat.emissiveIntensity = 0.55;
    } else {
      this.headMat.emissiveIntensity = THREE.MathUtils.lerp(this.headMat.emissiveIntensity, 0.15, 0.08);
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
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material.isMaterial) child.material.dispose();
      }
    });
  }
}
