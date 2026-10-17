/**
 * Connectome & Evolutionary Neural Network Architecture
 * 
 * 8 Sensory Inputs:
 *   [0] Food Sensor Left (directional sensitivity)
 *   [1] Food Sensor Right (directional sensitivity)
 *   [2] Food Proximity (1 / (1 + distance to nearest food))
 *   [3] Food Elevation (vertical angle to nearest food)
 *   [4] Boundary Proximity (alert when approaching tank walls)
 *   [5] Current Speed (proprioception)
 *   [6] Energy / Hunger Level (internal physiological state)
 *   [7] Central Pattern Oscillator (sinusoidal pacemaker for natural idle gait)
 * 
 * 4 Recurrent Interneurons (CTRNN leaky-integrator hidden nodes):
 *   [0..3] Leaky integration with self-recurrent & cross-recurrent feedback
 * 
 * 4 Motor Outputs:
 *   [0] Left Fin Thrust [-1, 1]
 *   [1] Right Fin Thrust [-1, 1]
 *   [2] Vertical Pitch [-1, 1]
 *   [3] Tail Burst Propulsion [0, 1]
 */

export const SENSORY_LABELS = [
  'Food Sensor L',
  'Food Sensor R',
  'Food Proximity',
  'Food Pitch',
  'Wall Proximity',
  'Speed Proprio',
  'Hunger State',
  'Gait Clock'
];

export const HIDDEN_LABELS = [
  'Interneuron α',
  'Interneuron β',
  'Interneuron γ',
  'Interneuron δ'
];

export const MOTOR_LABELS = [
  'Thrust Left',
  'Thrust Right',
  'Pitch Fin',
  'Tail Burst'
];

export const NUM_SENSORY = 8;
export const NUM_HIDDEN = 4;
export const NUM_MOTOR = 4;

export class Connectome {
  constructor(genome = null) {
    if (genome) {
      this.genome = JSON.parse(JSON.stringify(genome));
    } else {
      this.genome = this.createRandomGenome();
    }

    // Dynamic neuron activation states
    this.sensoryValues = new Float32Array(NUM_SENSORY);
    this.hiddenValues = new Float32Array(NUM_HIDDEN);
    this.prevHidden = new Float32Array(NUM_HIDDEN);
    this.stimBoost = new Float32Array(NUM_SENSORY);
    this.motorValues = new Float32Array(NUM_MOTOR);

    // Active action potentials for visual rendering (pulses traveling along synapses)
    // Structure: [{ fromType, fromIdx, toType, toIdx, progress, speed, weight }]
    this.activePulses = [];
  }

  createRandomGenome() {
    const randomMatrix = (rows, cols, scale = 1.0) => {
      const mat = [];
      for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
          row.push((Math.random() * 2 - 1) * scale);
        }
        mat.push(row);
      }
      return mat;
    };

    const randomArray = (size, scale = 0.5) => {
      const arr = [];
      for (let i = 0; i < size; i++) arr.push((Math.random() * 2 - 1) * scale);
      return arr;
    };

    return {
      // Direct sensory to motor reflexes (Braitenberg vehicle architecture)
      wDirect: randomMatrix(NUM_MOTOR, NUM_SENSORY, 1.2),
      // Sensory to hidden interneurons
      wSensoryHidden: randomMatrix(NUM_HIDDEN, NUM_SENSORY, 1.0),
      // Recurrent hidden to hidden
      wRecurrent: randomMatrix(NUM_HIDDEN, NUM_HIDDEN, 0.8),
      // Hidden to motor
      wHiddenMotor: randomMatrix(NUM_MOTOR, NUM_HIDDEN, 1.0),
      // Biases
      bHidden: randomArray(NUM_HIDDEN, 0.3),
      bMotor: randomArray(NUM_MOTOR, 0.2),
      // Leaky integration time constants
      tau: Array.from({ length: NUM_HIDDEN }, () => 0.4 + Math.random() * 0.4),
      // Morphology / Phenotype traits
      traits: {
        hue: Math.random(), // 0..1 color wheel
        antennaLength: 0.8 + Math.random() * 0.6,
        finSize: 0.8 + Math.random() * 0.5,
        maxSpeed: 8.0 + Math.random() * 4.0,
        metabolism: 0.8 + Math.random() * 0.4
      }
    };
  }

  cloneAndMutate(mutationRate = 0.15, mutationMagnitude = 0.25) {
    const childGenome = JSON.parse(JSON.stringify(this.genome));

    const mutateVal = (val, mag = mutationMagnitude) => {
      if (Math.random() < mutationRate) {
        val += (Math.random() * 2 - 1) * mag;
      }
      return val;
    };

    // Mutate weights
    ['wDirect', 'wSensoryHidden', 'wRecurrent', 'wHiddenMotor'].forEach(key => {
      for (let r = 0; r < childGenome[key].length; r++) {
        for (let c = 0; c < childGenome[key][r].length; c++) {
          childGenome[key][r][c] = mutateVal(childGenome[key][r][c]);
        }
      }
    });

    ['bHidden', 'bMotor', 'tau'].forEach(key => {
      for (let i = 0; i < childGenome[key].length; i++) {
        childGenome[key][i] = mutateVal(childGenome[key][i]);
      }
    });

    // Mutate morphological traits slightly
    const t = childGenome.traits;
    if (Math.random() < mutationRate) t.hue = (t.hue + (Math.random() * 0.1 - 0.05) + 1.0) % 1.0;
    if (Math.random() < mutationRate) t.antennaLength = Math.max(0.4, Math.min(1.8, t.antennaLength + (Math.random() * 0.2 - 0.1)));
    if (Math.random() < mutationRate) t.finSize = Math.max(0.5, Math.min(1.6, t.finSize + (Math.random() * 0.2 - 0.1)));
    if (Math.random() < mutationRate) t.maxSpeed = Math.max(5.0, Math.min(14.0, t.maxSpeed + (Math.random() * 1.0 - 0.5)));

    return new Connectome(childGenome);
  }

  /**
   * Forward pass: computes new motor outputs given sensory inputs
   */
  step(sensoryInputs, dt) {
    for (let i = 0; i < NUM_SENSORY; i++) {
      if (this.stimBoost[i] > 0.001) {
        this.stimBoost[i] = Math.max(0, this.stimBoost[i] - dt * 2.5);
      }
      this.sensoryValues[i] = (sensoryInputs[i] || 0.0) + this.stimBoost[i];
    }

    this.prevHidden.set(this.hiddenValues);
    const prevHidden = this.prevHidden;

    // 1. Compute Hidden (Interneurons) via Leaky-Integrator CTRNN
    for (let h = 0; h < NUM_HIDDEN; h++) {
      let sum = this.genome.bHidden[h];

      // Inputs from sensors
      for (let s = 0; s < NUM_SENSORY; s++) {
        const w = this.genome.wSensoryHidden[h][s];
        const val = this.sensoryValues[s];
        sum += w * val;

        // Visual pulse trigger on strong transmission
        if (Math.abs(w * val) > 0.45 && Math.random() < 0.08) {
          this.triggerPulse('sensory', s, 'hidden', h, w);
        }
      }

      // Recurrent inputs from previous hidden states
      for (let r = 0; r < NUM_HIDDEN; r++) {
        const w = this.genome.wRecurrent[h][r];
        const val = prevHidden[r];
        sum += w * val;

        if (Math.abs(w * val) > 0.45 && Math.random() < 0.06) {
          this.triggerPulse('hidden', r, 'hidden', h, w);
        }
      }

      // Leaky dynamics: dH/dt = (-H + tanh(sum)) / tau
      const alpha = Math.min(1.0, dt / Math.max(0.1, this.genome.tau[h]));
      this.hiddenValues[h] = (1.0 - alpha) * prevHidden[h] + alpha * Math.tanh(sum);
    }

    // 2. Compute Motor Outputs
    for (let m = 0; m < NUM_MOTOR; m++) {
      let sum = this.genome.bMotor[m];

      // Direct reflex connection from sensors (Braitenberg pathway)
      for (let s = 0; s < NUM_SENSORY; s++) {
        const w = this.genome.wDirect[m][s];
        const val = this.sensoryValues[s];
        sum += w * val;

        if (Math.abs(w * val) > 0.5 && Math.random() < 0.06) {
          this.triggerPulse('sensory', s, 'motor', m, w);
        }
      }

      // Indirect connection from hidden interneurons
      for (let h = 0; h < NUM_HIDDEN; h++) {
        const w = this.genome.wHiddenMotor[m][h];
        const val = this.hiddenValues[h];
        sum += w * val;

        if (Math.abs(w * val) > 0.45 && Math.random() < 0.08) {
          this.triggerPulse('hidden', h, 'motor', m, w);
        }
      }

      // Motor activation
      if (m === 3) {
        // Tail burst: sigmoid [0, 1]
        this.motorValues[m] = 1.0 / (1.0 + Math.exp(-sum * 2.0));
      } else {
        // Thrust left, right, pitch: tanh [-1, 1]
        this.motorValues[m] = Math.tanh(sum);
      }
    }

    // 3. Update active pulses
    for (let i = this.activePulses.length - 1; i >= 0; i--) {
      const p = this.activePulses[i];
      p.progress += dt * p.speed;
      if (p.progress >= 1.0) {
        this.activePulses.splice(i, 1);
      }
    }

    return this.motorValues;
  }

  triggerPulse(fromType, fromIdx, toType, toIdx, weight) {
    if (this.activePulses.length > 32) return; // Cap for performance
    this.activePulses.push({
      fromType,
      fromIdx,
      toType,
      toIdx,
      progress: 0.0,
      speed: 3.5 + Math.random() * 2.0,
      weight
    });
  }

  stimulate(type, idx, voltage = 1.8) {
    if (type === 'sensory') {
      this.stimBoost[idx] = voltage;
      this.sensoryValues[idx] = voltage;
      // Trigger pulses along all outgoing paths
      for (let h = 0; h < NUM_HIDDEN; h++) {
        this.triggerPulse('sensory', idx, 'hidden', h, this.genome.wSensoryHidden[h][idx]);
      }
      for (let m = 0; m < NUM_MOTOR; m++) {
        this.triggerPulse('sensory', idx, 'motor', m, this.genome.wDirect[m][idx]);
      }
    } else if (type === 'hidden') {
      this.hiddenValues[idx] = voltage;
      for (let h = 0; h < NUM_HIDDEN; h++) {
        if (h !== idx) this.triggerPulse('hidden', idx, 'hidden', h, this.genome.wRecurrent[h][idx]);
      }
      for (let m = 0; m < NUM_MOTOR; m++) {
        this.triggerPulse('hidden', idx, 'motor', m, this.genome.wHiddenMotor[m][idx]);
      }
    } else if (type === 'motor') {
      this.motorValues[idx] = voltage;
    }
  }

  getSynapseWeight(fromType, fromIdx, toType, toIdx) {
    const g = this.genome;
    if (fromType === 'sensory' && toType === 'hidden') return g.wSensoryHidden[toIdx][fromIdx];
    if (fromType === 'hidden' && toType === 'hidden') return g.wRecurrent[toIdx][fromIdx];
    if (fromType === 'hidden' && toType === 'motor') return g.wHiddenMotor[toIdx][fromIdx];
    if (fromType === 'sensory' && toType === 'motor') return g.wDirect[toIdx][fromIdx];
    return 0;
  }

  setSynapseWeight(fromType, fromIdx, toType, toIdx, weight) {
    const g = this.genome;
    if (fromType === 'sensory' && toType === 'hidden') g.wSensoryHidden[toIdx][fromIdx] = weight;
    if (fromType === 'hidden' && toType === 'hidden') g.wRecurrent[toIdx][fromIdx] = weight;
    if (fromType === 'hidden' && toType === 'motor') g.wHiddenMotor[toIdx][fromIdx] = weight;
    if (fromType === 'sensory' && toType === 'motor') g.wDirect[toIdx][fromIdx] = weight;
  }

  toggleSynapsePolarity(fromType, fromIdx, toType, toIdx) {
    const current = this.getSynapseWeight(fromType, fromIdx, toType, toIdx);
    // If near zero, jump to 1.0; otherwise invert sign
    const next = Math.abs(current) < 0.2 ? 1.0 : -current;
    this.setSynapseWeight(fromType, fromIdx, toType, toIdx, next);
    return next;
  }
}
