import * as THREE from 'three';
import { Creature } from './creature.js';
import { Connectome } from './neural.js';

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

    // Storage Keys
    this.STORAGE_KEY = 'synapse_ecosystem_state';
    this.PRESETS_KEY = 'synapse_lineage_presets';
    this.autoSaveInterval = 8.0; // seconds
    this.autoSaveTimer = 0.0;

    // Lineage Presets Bank
    this.lineagePresets = this.loadLineagePresets();

    // Restore saved population or initialize fresh
    const restored = this.loadFromStorage();
    if (!restored) {
      this.initPopulation();
    }

    // Auto-save on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.saveToStorage());
    }
  }

  initPopulation() {
    for (let i = 0; i < this.targetSize; i++) {
      this.spawnCreature();
    }
  }

  spawnCreature(genome = null, gen = 1) {
    const b = this.environment.bounds;
    const floorLimit = -b.y + 6.5;
    const ceilingLimit = b.y - 4.5;
    const pos = new THREE.Vector3(
      (Math.random() * 2 - 1) * (b.x - 9.0),
      floorLimit + 2.0 + Math.random() * (ceilingLimit - floorLimit - 4.0),
      (Math.random() * 2 - 1) * Math.max(1, b.z - 3.0)
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
      c.isSelected = true;
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
        const wasSelected = (this.selectedCreature === c);
        this.scene.remove(c.mesh);
        c.dispose();
        this.creatures.splice(i, 1);
        this.totalDeaths++;

        if (wasSelected) {
          this.selectedCreature = this.getHealthiestCreature();
          if (this.selectedCreature) {
            this.selectedCreature.isSelected = true;
          }
        }
      }
    }

    // 2. Prevent extinction / maintain population density with mutated genetic diversity
    if (this.creatures.length < 8) {
      let seedGenome = null;
      if (this.bestGenome) {
        // Diversify by mutating champion genome to prevent clonal monoculture
        const dummy = new Connectome(this.bestGenome);
        seedGenome = Math.random() < 0.65 ? dummy.cloneAndMutate(0.25, 0.35).genome : null;
      }
      this.spawnCreature(seedGenome, this.highestGeneration);
    }

    // 3. Periodic Auto-Save to LocalStorage
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= this.autoSaveInterval) {
      this.autoSaveTimer = 0.0;
      this.saveToStorage();
    }
  }

  getHealthiestCreature() {
    const living = this.creatures.filter(c => !c.isDead);
    if (living.length === 0) return null;
    return living.reduce((best, c) => c.energy > best.energy ? c : best, living[0]);
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
      const b = this.environment.bounds;
      const offsetPos = parentPos.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 4.0, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 4.0)
      );
      offsetPos.y = THREE.MathUtils.clamp(offsetPos.y, -b.y + 4.0, b.y - 3.0);
      offsetPos.x = THREE.MathUtils.clamp(offsetPos.x, -b.x + 3.0, b.x - 3.0);
      const clone = new Creature(offsetPos, genome, this.selectedCreature.generation);
      this.creatures.push(clone);
      this.scene.add(clone.mesh);
      this.totalBirths++;
    }
  }

  resetAll() {
    this.clearStorage();
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

  // --------------------------------------------------------------------------
  // Persistence: Auto-Save & Restore with LocalStorage
  // --------------------------------------------------------------------------
  saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const livingCreatures = this.creatures.filter(c => !c.isDead);
      if (livingCreatures.length === 0) return;

      const data = {
        version: 1,
        timestamp: Date.now(),
        highestGeneration: this.highestGeneration,
        totalBirths: this.totalBirths,
        totalDeaths: this.totalDeaths,
        allTimeBestFitness: this.allTimeBestFitness,
        bestGenome: this.bestGenome,
        creatures: livingCreatures.map(c => ({
          generation: c.generation,
          age: c.age,
          energy: c.energy,
          foodEaten: c.foodEaten,
          fitness: c.fitness,
          position: [c.position.x, c.position.y, c.position.z],
          genome: c.connectome.genome
        }))
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Synapse: LocalStorage save failed:', e);
    }
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return false;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw);
      if (!data || !data.creatures || data.creatures.length === 0) return false;

      this.highestGeneration = data.highestGeneration || 1;
      this.totalBirths = data.totalBirths || 0;
      this.totalDeaths = data.totalDeaths || 0;
      this.allTimeBestFitness = data.allTimeBestFitness || 0;
      this.bestGenome = data.bestGenome || null;

      // Spawn restored population
      data.creatures.forEach(saved => {
        const pos = (saved.position && saved.position.length === 3)
          ? new THREE.Vector3(saved.position[0], saved.position[1], saved.position[2])
          : null;
        const c = new Creature(pos, saved.genome, saved.generation || 1);
        if (saved.age !== undefined) c.age = saved.age;
        if (saved.energy !== undefined) c.energy = saved.energy;
        if (saved.foodEaten !== undefined) c.foodEaten = saved.foodEaten;
        if (saved.fitness !== undefined) c.fitness = saved.fitness;

        this.creatures.push(c);
        this.scene.add(c.mesh);
      });

      if (this.creatures.length > 0) {
        this.selectedCreature = this.creatures[0];
        this.selectedCreature.isSelected = true;
      }

      console.log(`Synapse: Restored ${this.creatures.length} organisms from persistent storage (Gen ${this.highestGeneration}).`);
      return true;
    } catch (e) {
      console.warn('Synapse: Failed to load state from LocalStorage, falling back to fresh population:', e);
      return false;
    }
  }

  clearStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {
      console.warn('Synapse: Failed to clear LocalStorage:', e);
    }
  }

  // --------------------------------------------------------------------------
  // Lineage Snapshot Bank: Presets & Custom Saved Lines
  // --------------------------------------------------------------------------
  getBuiltInPresets() {
    return [
      {
        id: 'emerald-shoaler',
        name: 'Emerald Shoaler Lineage',
        description: 'Agile schooler tuned with rapid fin flutter and high food sensor sensitivity.',
        builtIn: true,
        traits: { hue: 0.38, antennaLength: 1.4, finSize: 1.25, maxSpeed: 11.5, metabolism: 0.92, longevity: 0.8 },
        generation: 4,
        genome: {
          wDirect: [
            [1.2, 0.2, 0.9, 0.0, -0.8, 0.1, -0.3, 0.5],
            [0.2, 1.2, 0.9, 0.0, -0.8, 0.1, -0.3, 0.5],
            [0.0, 0.0, 0.0, 1.4, 0.0, 0.0, 0.0, 0.0],
            [0.1, 0.1, 1.5, 0.0, -0.5, 0.0, 0.4, 0.6]
          ],
          wSensoryHidden: [
            [0.8, -0.3, 1.1, 0.2, -0.4, 0.3, 0.1, 0.5],
            [-0.3, 0.8, 1.1, -0.2, -0.4, 0.3, 0.1, 0.5],
            [0.4, 0.4, 0.5, 0.8, 0.2, 0.1, -0.2, 0.3],
            [0.1, 0.1, 0.9, 0.0, -0.9, 0.4, 0.3, 0.8]
          ],
          wRecurrent: [
            [0.4, -0.2, 0.1, 0.0],
            [-0.2, 0.4, 0.1, 0.0],
            [0.1, 0.1, 0.5, -0.1],
            [0.0, 0.0, -0.2, 0.6]
          ],
          wHiddenMotor: [
            [0.9, -0.4, 0.2, 0.5],
            [-0.4, 0.9, 0.2, 0.5],
            [0.1, 0.1, 0.8, -0.2],
            [0.6, 0.6, 0.0, 0.9]
          ],
          bHidden: [0.1, 0.1, 0.0, 0.2],
          bMotor: [0.2, 0.2, 0.0, 0.1],
          tau: [0.35, 0.35, 0.5, 0.4],
          traits: { hue: 0.38, antennaLength: 1.4, finSize: 1.25, maxSpeed: 11.5, metabolism: 0.92, longevity: 0.8 }
        }
      },
      {
        id: 'swift-deep-glider',
        name: 'Swift Deep Glider',
        description: 'Hydrodynamic long-distance cruiser adapted for high speed and gyre navigation.',
        builtIn: true,
        traits: { hue: 0.58, antennaLength: 1.0, finSize: 1.4, maxSpeed: 13.8, metabolism: 0.85, longevity: 0.9 },
        generation: 6,
        genome: {
          wDirect: [
            [1.5, -0.1, 1.2, 0.1, -1.2, 0.2, -0.2, 0.3],
            [-0.1, 1.5, 1.2, -0.1, -1.2, 0.2, -0.2, 0.3],
            [0.0, 0.0, 0.0, 1.6, 0.0, 0.0, 0.0, 0.0],
            [0.3, 0.3, 1.8, 0.0, -0.8, 0.1, 0.6, 0.8]
          ],
          wSensoryHidden: [
            [1.0, -0.5, 1.3, 0.0, -0.6, 0.5, 0.0, 0.4],
            [-0.5, 1.0, 1.3, 0.0, -0.6, 0.5, 0.0, 0.4],
            [0.2, 0.2, 0.4, 1.1, 0.0, 0.2, 0.0, 0.2],
            [0.4, 0.4, 1.2, 0.0, -1.0, 0.6, 0.5, 0.9]
          ],
          wRecurrent: [
            [0.5, -0.3, 0.0, 0.1],
            [-0.3, 0.5, 0.0, 0.1],
            [0.0, 0.0, 0.6, 0.0],
            [0.2, 0.2, 0.0, 0.7]
          ],
          wHiddenMotor: [
            [1.1, -0.6, 0.1, 0.7],
            [-0.6, 1.1, 0.1, 0.7],
            [0.0, 0.0, 1.0, 0.0],
            [0.8, 0.8, 0.0, 1.2]
          ],
          bHidden: [0.15, 0.15, 0.0, 0.25],
          bMotor: [0.25, 0.25, 0.0, 0.2],
          tau: [0.28, 0.28, 0.45, 0.32],
          traits: { hue: 0.58, antennaLength: 1.0, finSize: 1.4, maxSpeed: 13.8, metabolism: 0.85, longevity: 0.9 }
        }
      },
      {
        id: 'abyssal-amber-forager',
        name: 'Abyssal Amber Forager',
        description: 'Patient bottom-grazer with expansive sensory bulbs and efficient energy consumption.',
        builtIn: true,
        traits: { hue: 0.08, antennaLength: 1.6, finSize: 0.95, maxSpeed: 8.8, metabolism: 0.68, longevity: 1.0 },
        generation: 8,
        genome: {
          wDirect: [
            [0.9, 0.3, 1.4, 0.0, -0.7, 0.0, -0.5, 0.6],
            [0.3, 0.9, 1.4, 0.0, -0.7, 0.0, -0.5, 0.6],
            [0.0, 0.0, 0.0, 1.2, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, -0.4, 0.0, 0.2, 0.4]
          ],
          wSensoryHidden: [
            [0.7, -0.1, 1.4, 0.1, -0.5, 0.1, 0.2, 0.6],
            [-0.1, 0.7, 1.4, -0.1, -0.5, 0.1, 0.2, 0.6],
            [0.3, 0.3, 0.8, 0.9, 0.1, 0.0, -0.1, 0.4],
            [0.2, 0.2, 1.1, 0.0, -0.7, 0.2, 0.4, 0.7]
          ],
          wRecurrent: [
            [0.3, -0.1, 0.2, 0.0],
            [-0.1, 0.3, 0.2, 0.0],
            [0.2, 0.2, 0.4, 0.1],
            [0.0, 0.0, 0.1, 0.5]
          ],
          wHiddenMotor: [
            [0.7, -0.3, 0.3, 0.4],
            [-0.3, 0.7, 0.3, 0.4],
            [0.1, 0.1, 0.7, -0.1],
            [0.4, 0.4, 0.1, 0.6]
          ],
          bHidden: [0.05, 0.05, 0.0, 0.1],
          bMotor: [0.15, 0.15, 0.0, 0.05],
          tau: [0.5, 0.5, 0.6, 0.55],
          traits: { hue: 0.08, antennaLength: 1.6, finSize: 0.95, maxSpeed: 8.8, metabolism: 0.68, longevity: 1.0 }
        }
      }
    ];
  }

  loadLineagePresets() {
    const builtIns = this.getBuiltInPresets();
    if (typeof localStorage === 'undefined') return builtIns;
    try {
      const raw = localStorage.getItem(this.PRESETS_KEY);
      if (!raw) return builtIns;
      const userPresets = JSON.parse(raw);
      return [...builtIns, ...(Array.isArray(userPresets) ? userPresets : [])];
    } catch (e) {
      console.warn('Synapse: Failed to load user lineage presets:', e);
      return builtIns;
    }
  }

  saveLineagePreset(name, creature = null) {
    const source = creature || this.selectedCreature;
    if (!source) return null;

    const preset = {
      id: 'custom-' + Date.now(),
      name: name.trim() || `Lineage #${source.id}`,
      description: `Saved from Generation ${source.generation} with fitness ${source.fitness.toFixed(1)} and ${source.foodEaten} food ingested.`,
      builtIn: false,
      timestamp: Date.now(),
      traits: source.connectome.genome.traits,
      generation: source.generation,
      genome: JSON.parse(JSON.stringify(source.connectome.genome))
    };

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.PRESETS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.push(preset);
        localStorage.setItem(this.PRESETS_KEY, JSON.stringify(list));
      } catch (e) {
        console.warn('Synapse: Failed to save user lineage preset to storage:', e);
      }
    }

    this.lineagePresets = this.loadLineagePresets();
    return preset;
  }

  deleteLineagePreset(presetId) {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.PRESETS_KEY);
      if (!raw) return;
      let list = JSON.parse(raw);
      list = list.filter(p => p.id !== presetId);
      localStorage.setItem(this.PRESETS_KEY, JSON.stringify(list));
      this.lineagePresets = this.loadLineagePresets();
    } catch (e) {
      console.warn('Synapse: Failed to delete user lineage preset:', e);
    }
  }

  spawnFromPreset(preset, count = 1) {
    if (!preset || !preset.genome) return null;
    let lastSpawned = null;

    for (let i = 0; i < count; i++) {
      const b = this.environment.bounds;
      const floorLimit = -b.y + 5.5;
      const ceilingLimit = b.y - 2.5;
      const pos = new THREE.Vector3(
        (Math.random() * 2 - 1) * (b.x - 8),
        floorLimit + 2.0 + Math.random() * (ceilingLimit - floorLimit - 4.0),
        (Math.random() * 2 - 1) * Math.max(1, b.z - 3)
      );

      const cloneGenome = JSON.parse(JSON.stringify(preset.genome));
      const c = new Creature(pos, cloneGenome, preset.generation || this.highestGeneration);
      this.creatures.push(c);
      this.scene.add(c.mesh);
      this.totalBirths++;
      lastSpawned = c;
    }

    if (lastSpawned) {
      if (this.selectedCreature) this.selectedCreature.isSelected = false;
      this.selectedCreature = lastSpawned;
      lastSpawned.isSelected = true;
    }

    return lastSpawned;
  }
}
