import * as THREE from 'three';
import { Creature } from './creature.js';

export class PopulationManager {
  constructor(scene, environment, targetSize = 20) {
    this.scene = scene;
    this.environment = environment;
    this.targetSize = targetSize;

    this.creatures = [];
    this.selectedCreature = null;

    // Lineage & Telemetry Stats
    this.highestGeneration = 1;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.allTimeBestFitness = 0;
    this.bestGenome = null;

    this.initPopulation();
  }

  initPopulation() {
    for (let i = 0; i < this.targetSize; i++) {
      this.spawnCreature();
    }
  }

  spawnCreature(genome = null, gen = 1) {
    const b = this.environment.bounds;
    const pos = new THREE.Vector3(
      (Math.random() * 2 - 1) * (b.x - 8),
      (Math.random() * 2 - 1) * (b.y - 6),
      (Math.random() * 2 - 1) * Math.max(1, b.z - 3)
    );

    const c = new Creature(pos, genome, gen);
    this.creatures.push(c);
    this.scene.add(c.mesh);
    this.totalBirths++;

    if (gen > this.highestGeneration) {
      this.highestGeneration = gen;
    }

    if (!this.selectedCreature) {
      this.selectedCreature = c;
    }

    return c;
  }

  update(dt) {
    // 1. Update each living creature
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      c.update(dt, this.environment);

      // Track all-time best genome
      if (c.fitness > this.allTimeBestFitness) {
        this.allTimeBestFitness = c.fitness;
        this.bestGenome = JSON.parse(JSON.stringify(c.connectome.genome));
      }

      // Check reproduction
      if (c.canReproduce()) {
        const offspring = c.reproduce();
        this.creatures.push(offspring);
        this.scene.add(offspring.mesh);
        this.totalBirths++;
        if (offspring.generation > this.highestGeneration) {
          this.highestGeneration = offspring.generation;
        }
      }

      // Handle death & removal
      if (c.isDead && c.fadeAlpha <= 0.02) {
        if (this.selectedCreature === c) {
          // Fallback to highest energy creature
          this.selectedCreature = this.getHealthiestCreature();
        }
        this.scene.remove(c.mesh);
        c.dispose();
        this.creatures.splice(i, 1);
        this.totalDeaths++;
      }
    }

    // 2. Prevent extinction / maintain population density
    if (this.creatures.length < 8) {
      // Spawn new offspring from best surviving genome or fresh genetic line
      const seedGenome = this.bestGenome ? this.bestGenome : null;
      this.spawnCreature(seedGenome, this.highestGeneration);
    }
  }

  getHealthiestCreature() {
    if (this.creatures.length === 0) return null;
    let healthiest = this.creatures[0];
    for (const c of this.creatures) {
      if (c.energy > healthiest.energy && !c.isDead) {
        healthiest = c;
      }
    }
    return healthiest;
  }

  selectCreatureById(id) {
    const found = this.creatures.find(c => c.id === id);
    if (found) {
      if (this.selectedCreature) this.selectedCreature.isSelected = false;
      this.selectedCreature = found;
      this.selectedCreature.isSelected = true;
    }
    return found;
  }

  getAlphaHunter() {
    if (this.creatures.length === 0) return null;
    let alpha = this.creatures[0];
    for (const c of this.creatures) {
      if (c.foodEaten > alpha.foodEaten && !c.isDead) alpha = c;
    }
    return alpha;
  }

  getElder() {
    if (this.creatures.length === 0) return null;
    let elder = this.creatures[0];
    for (const c of this.creatures) {
      if (c.age > elder.age && !c.isDead) elder = c;
    }
    return elder;
  }

  getFastest() {
    if (this.creatures.length === 0) return null;
    let fastest = this.creatures[0];
    for (const c of this.creatures) {
      if (c.speed > fastest.speed && !c.isDead) fastest = c;
    }
    return fastest;
  }

  cycleSpecimen(direction = 1) {
    if (this.creatures.length === 0) return null;
    let idx = this.creatures.indexOf(this.selectedCreature);
    if (idx === -1) idx = 0;
    else idx = (idx + direction + this.creatures.length) % this.creatures.length;

    if (this.selectedCreature) this.selectedCreature.isSelected = false;
    this.selectedCreature = this.creatures[idx];
    this.selectedCreature.isSelected = true;
    return this.selectedCreature;
  }

  cloneSelected(count = 3) {
    if (!this.selectedCreature) return;
    const genome = JSON.parse(JSON.stringify(this.selectedCreature.connectome.genome));
    const parentPos = this.selectedCreature.position;

    for (let i = 0; i < count; i++) {
      const offsetPos = parentPos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 4.0, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 4.0)
      );
      const clone = new Creature(offsetPos, genome, this.selectedCreature.generation);
      this.creatures.push(clone);
      this.scene.add(clone.mesh);
      this.totalBirths++;
    }
  }

  resetAll() {
    for (const c of this.creatures) {
      this.scene.remove(c.mesh);
      c.dispose();
    }
    this.creatures = [];
    this.selectedCreature = null;
    this.highestGeneration = 1;
    this.allTimeBestFitness = 0;
    this.bestGenome = null;
    this.initPopulation();
  }
}
