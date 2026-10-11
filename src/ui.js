import * as THREE from 'three';
import { SENSORY_LABELS, HIDDEN_LABELS, MOTOR_LABELS, NUM_SENSORY, NUM_HIDDEN, NUM_MOTOR } from './neural.js';

export class UIManager {
  constructor(populationManager, environment, cameraController) {
    this.pop = populationManager;
    this.env = environment;
    this.cam = cameraController;

    this.simSpeed = 1.0;
    this.isPaused = false;
    this.bulletTime = false;

    // Connectome Interactive State
    this.hoveredNeuron = null;
    this.hoveredSynapse = null;
    this.stimulationRipples = []; // { x, y, radius, alpha }
    this.cachedNodes = { sensory: [], hidden: [], motor: [] };
    this.cachedSynapses = [];

    // Cache DOM Elements
    this.elPopCount = document.getElementById('val-population');
    this.elGenCount = document.getElementById('val-generation');
    this.elFoodCount = document.getElementById('val-food');
    this.elBirthCount = document.getElementById('val-births');
    this.elDeathCount = document.getElementById('val-deaths');

    this.elSpecId = document.getElementById('val-spec-id');
    this.elSpecGen = document.getElementById('val-spec-gen');
    this.elSpecEnergy = document.getElementById('val-spec-energy');
    this.elSpecEnergyBar = document.getElementById('bar-spec-energy');
    this.elSpecAge = document.getElementById('val-spec-age');
    this.elSpecFood = document.getElementById('val-spec-food');
    this.elSpecSpeed = document.getElementById('val-spec-speed');

    // 2D Connectome Canvas
    this.brainCanvas = document.getElementById('brain-canvas');
    if (this.brainCanvas) {
      this.ctx = this.brainCanvas.getContext('2d');
    }

    this.bindEvents();
    this.bindBrainCanvasEvents();
  }

  bindEvents() {
    // 1. Simulation Speed Buttons
    const speedBtns = document.querySelectorAll('.btn-speed');
    speedBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        speedBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const spd = parseFloat(btn.dataset.speed);
        if (spd === 0) {
          this.isPaused = true;
        } else {
          this.isPaused = false;
          this.bulletTime = false;
          this.simSpeed = spd;
          const bBtn = document.getElementById('btn-bullet-time');
          if (bBtn) bBtn.classList.remove('active');
        }
      });
    });

    // 2. Bullet Time Toggle
    const btnBullet = document.getElementById('btn-bullet-time');
    if (btnBullet) {
      btnBullet.addEventListener('click', () => {
        this.bulletTime = !this.bulletTime;
        btnBullet.classList.toggle('active', this.bulletTime);
        if (this.bulletTime) {
          this.isPaused = false;
          this.simSpeed = 0.22;
          speedBtns.forEach(b => b.classList.remove('active'));
        } else {
          this.simSpeed = 1.0;
          const btn1x = document.querySelector('.btn-speed[data-speed="1"]');
          if (btn1x) btn1x.classList.add('active');
        }
      });
    }

    // 3. Camera Mode Buttons (Track, Free, Macro)
    const camBtns = document.querySelectorAll('.btn-cam-mode');
    camBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.cam.setMode) {
          this.cam.setMode(btn.dataset.mode);
        } else {
          camBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.cam.mode = btn.dataset.mode;
        }
      });
    });

    // 4. Zoom Buttons (+ / -)
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.cam.zoom(-10));
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.cam.zoom(10));
    }

    // 5. Specimen Cycling (Prev / Next)
    const btnPrev = document.getElementById('btn-spec-prev');
    const btnNext = document.getElementById('btn-spec-next');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        this.pop.cycleSpecimen(-1);
        if (this.cam.setMode) this.cam.setMode('track');
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        this.pop.cycleSpecimen(1);
        if (this.cam.setMode) this.cam.setMode('track');
      });
    }

    // 6. Champion Teleport Buttons
    const btnAlpha = document.getElementById('btn-alpha');
    const btnElder = document.getElementById('btn-elder');
    const btnFast = document.getElementById('btn-fastest');
    if (btnAlpha) {
      btnAlpha.addEventListener('click', () => {
        const c = this.pop.getAlphaHunter();
        if (c) {
          this.pop.selectCreatureById(c.id);
          if (this.cam.setMode) this.cam.setMode('track');
        }
      });
    }
    if (btnElder) {
      btnElder.addEventListener('click', () => {
        const c = this.pop.getElder();
        if (c) {
          this.pop.selectCreatureById(c.id);
          if (this.cam.setMode) this.cam.setMode('track');
        }
      });
    }
    if (btnFast) {
      btnFast.addEventListener('click', () => {
        const c = this.pop.getFastest();
        if (c) {
          this.pop.selectCreatureById(c.id);
          if (this.cam.setMode) this.cam.setMode('track');
        }
      });
    }

    // 7. Clone Specimen Button
    const btnClone = document.getElementById('btn-clone-spec');
    if (btnClone) {
      btnClone.addEventListener('click', () => {
        this.pop.cloneSelected(3);
      });
    }

    // 8. Drop Nutrients Button
    const btnFeed = document.getElementById('btn-feed');
    if (btnFeed) {
      btnFeed.addEventListener('click', () => {
        const center = this.pop.selectedCreature ? this.pop.selectedCreature.position : new THREE.Vector3();
        this.env.spawnFoodCluster(center, 12);
      });
    }

    // 9. Reset Population
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.pop.resetAll();
      });
    }
  }

  bindBrainCanvasEvents() {
    if (!this.brainCanvas) return;

    const getCanvasPos = (e) => {
      const rect = this.brainCanvas.getBoundingClientRect();
      const scaleX = this.brainCanvas.width / rect.width;
      const scaleY = this.brainCanvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    // Mouse Move: Hover Detection on Nodes & Synapses
    this.brainCanvas.addEventListener('mousemove', (e) => {
      const pos = getCanvasPos(e);
      const c = this.pop.selectedCreature;
      if (!c) return;

      // Check Nodes
      let hitNode = null;
      ['sensory', 'hidden', 'motor'].forEach(type => {
        this.cachedNodes[type].forEach(n => {
          const dSq = (pos.x - n.x) * (pos.x - n.x) + (pos.y - n.y) * (pos.y - n.y);
          if (dSq < 144) { // radius 12
            hitNode = n;
          }
        });
      });

      if (hitNode) {
        this.hoveredNeuron = hitNode;
        this.hoveredSynapse = null;
        this.brainCanvas.style.cursor = 'pointer';
        c.highlightNeuron(hitNode.type, hitNode.idx);
        return;
      }

      // Check Synapses
      let hitSyn = null;
      for (const syn of this.cachedSynapses) {
        const dist = distToSegment(pos, syn.p1, syn.p2);
        if (dist < 4.5) {
          hitSyn = syn;
          break;
        }
      }

      if (hitSyn) {
        this.hoveredSynapse = hitSyn;
        this.hoveredNeuron = null;
        this.brainCanvas.style.cursor = 'crosshair';
        c.highlightNeuron(null);
      } else {
        this.hoveredNeuron = null;
        this.hoveredSynapse = null;
        this.brainCanvas.style.cursor = 'default';
        c.highlightNeuron(null);
      }
    });

    this.brainCanvas.addEventListener('mouseleave', () => {
      this.hoveredNeuron = null;
      this.hoveredSynapse = null;
      if (this.pop.selectedCreature) this.pop.selectedCreature.highlightNeuron(null);
    });

    // Mouse Click: Stimulate Neuron or Flip Synapse Polarity
    this.brainCanvas.addEventListener('click', (e) => {
      const c = this.pop.selectedCreature;
      if (!c) return;

      if (this.hoveredNeuron) {
        // Stimulate Neuron!
        c.stimulateNeuron(this.hoveredNeuron.type, this.hoveredNeuron.idx);
        this.stimulationRipples.push({
          x: this.hoveredNeuron.x,
          y: this.hoveredNeuron.y,
          radius: 6,
          alpha: 1.0
        });
      } else if (this.hoveredSynapse) {
        // Flip Synapse Polarity!
        const syn = this.hoveredSynapse;
        c.connectome.toggleSynapsePolarity(syn.fromType, syn.fromIdx, syn.toType, syn.toIdx);
        c.rebuildSynapticLines();
        this.stimulationRipples.push({
          x: (syn.p1.x + syn.p2.x) * 0.5,
          y: (syn.p1.y + syn.p2.y) * 0.5,
          radius: 8,
          alpha: 1.0
        });
      }
    });
  }

  update() {
    // 1. Update Ecosystem Telemetry
    if (this.elPopCount) this.elPopCount.innerText = this.pop.creatures.length;
    if (this.elGenCount) this.elGenCount.innerText = `Gen ${this.pop.highestGeneration}`;
    if (this.elFoodCount) this.elFoodCount.innerText = this.env.foodItems.length;
    if (this.elBirthCount) this.elBirthCount.innerText = this.pop.totalBirths;
    if (this.elDeathCount) this.elDeathCount.innerText = this.pop.totalDeaths;

    // 2. Update Selected Specimen Telemetry
    const c = this.pop.selectedCreature;
    if (c) {
      if (this.elSpecId) this.elSpecId.innerText = `#${c.id}`;
      if (this.elSpecGen) this.elSpecGen.innerText = `Gen ${c.generation}`;
      if (this.elSpecEnergy) this.elSpecEnergy.innerText = `${Math.max(0, Math.round(c.energy))} / 220`;
      if (this.elSpecEnergyBar) {
        const pct = Math.min(100, Math.max(0, (c.energy / 220) * 100));
        this.elSpecEnergyBar.style.width = `${pct}%`;
        this.elSpecEnergyBar.style.backgroundColor = c.energy < 40 ? '#ff3366' : (c.energy < 100 ? '#ffcc00' : '#00ff88');
      }
      if (this.elSpecAge) this.elSpecAge.innerText = `${c.age.toFixed(1)}s`;
      if (this.elSpecFood) this.elSpecFood.innerText = c.foodEaten;
      if (this.elSpecSpeed) this.elSpecSpeed.innerText = c.speed.toFixed(1);

      // Draw 2D Connectome Architecture & Dynamic Firing
      this.drawConnectome(c);
    }
  }

  drawConnectome(creature) {
    if (!this.ctx || !this.brainCanvas) return;
    const ctx = this.ctx;
    const w = this.brainCanvas.width;
    const h = this.brainCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const c = creature.connectome;
    const g = c.genome;

    // Node Layout Coordinates
    const xSensory = 38;
    const xHidden = w * 0.5;
    const xMotor = w - 38;

    const sensoryNodes = [];
    for (let i = 0; i < NUM_SENSORY; i++) {
      const y = 25 + (i / (NUM_SENSORY - 1)) * (h - 50);
      sensoryNodes.push({ type: 'sensory', idx: i, x: xSensory, y, val: c.sensoryValues[i], label: SENSORY_LABELS[i] });
    }

    const hiddenNodes = [];
    for (let i = 0; i < NUM_HIDDEN; i++) {
      const y = 45 + (i / (NUM_HIDDEN - 1)) * (h - 90);
      hiddenNodes.push({ type: 'hidden', idx: i, x: xHidden, y, val: c.hiddenValues[i], label: HIDDEN_LABELS[i] });
    }

    const motorNodes = [];
    for (let i = 0; i < NUM_MOTOR; i++) {
      const y = 45 + (i / (NUM_MOTOR - 1)) * (h - 90);
      motorNodes.push({ type: 'motor', idx: i, x: xMotor, y, val: c.motorValues[i], label: MOTOR_LABELS[i] });
    }

    this.cachedNodes = { sensory: sensoryNodes, hidden: hiddenNodes, motor: motorNodes };
    this.cachedSynapses = [];

    // 1. Draw Synaptic Connections
    ctx.lineWidth = 1.0;

    const recordAndDrawSynapse = (p1, p2, weight, fromType, fromIdx, toType, toIdx) => {
      if (Math.abs(weight) > 0.22) {
        const isHovered = this.hoveredSynapse &&
          this.hoveredSynapse.fromType === fromType && this.hoveredSynapse.fromIdx === fromIdx &&
          this.hoveredSynapse.toType === toType && this.hoveredSynapse.toIdx === toIdx;

        this.cachedSynapses.push({ p1, p2, weight, fromType, fromIdx, toType, toIdx });

        if (isHovered) {
          ctx.lineWidth = 3.0;
          ctx.strokeStyle = '#ffffff';
        } else {
          ctx.lineWidth = 1.0 + Math.min(2.0, Math.abs(weight));
          ctx.strokeStyle = weight > 0 ? `rgba(0, 229, 255, ${Math.min(0.7, Math.abs(weight) * 0.5)})` : `rgba(255, 51, 102, ${Math.min(0.7, Math.abs(weight) * 0.5)})`;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    };

    // Sensory to Hidden
    for (let hi = 0; hi < NUM_HIDDEN; hi++) {
      for (let si = 0; si < NUM_SENSORY; si++) {
        recordAndDrawSynapse(sensoryNodes[si], hiddenNodes[hi], g.wSensoryHidden[hi][si], 'sensory', si, 'hidden', hi);
      }
    }

    // Hidden to Motor
    for (let mi = 0; mi < NUM_MOTOR; mi++) {
      for (let hi = 0; hi < NUM_HIDDEN; hi++) {
        recordAndDrawSynapse(hiddenNodes[hi], motorNodes[mi], g.wHiddenMotor[mi][hi], 'hidden', hi, 'motor', mi);
      }
    }

    // 2. Draw Active Action Potential Pulses
    c.activePulses.forEach(p => {
      let from, to;
      if (p.fromType === 'sensory') from = sensoryNodes[p.fromIdx];
      else if (p.fromType === 'hidden') from = hiddenNodes[p.fromIdx];

      if (p.toType === 'hidden') to = hiddenNodes[p.toIdx];
      else if (p.toType === 'motor') to = motorNodes[p.toIdx];

      if (from && to) {
        const px = from.x + (to.x - from.x) * p.progress;
        const py = from.y + (to.y - from.y) * p.progress;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Draw Nodes with Dynamic Voltage Glow
    const drawNode = (n, baseColor, align = 'left') => {
      const isHovered = this.hoveredNeuron && this.hoveredNeuron.type === n.type && this.hoveredNeuron.idx === n.idx;
      const act = Math.min(1.0, Math.abs(n.val));
      const radius = (isHovered ? 7.0 : 4.5) + act * 4.0;

      // Glow halo
      const grad = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, radius * 2.2);
      grad.addColorStop(0, isHovered ? '#ffffff' : baseColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Core Node
      ctx.fillStyle = isHovered ? '#ffffff' : (act > 0.5 ? '#ffffff' : baseColor);
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Micro Label
      ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(255, 255, 255, 0.65)';
      ctx.font = isHovered ? 'bold 9px monospace' : '8px monospace';
      ctx.textAlign = align;
      const xOffset = align === 'left' ? 14 : -14;
      ctx.fillText(n.label, n.x + xOffset, n.y + 3);
    };

    sensoryNodes.forEach((n) => drawNode(n, 'rgba(0, 229, 255, 0.9)', 'left'));
    hiddenNodes.forEach((n) => drawNode(n, 'rgba(213, 0, 249, 0.9)', 'left'));
    motorNodes.forEach((n) => drawNode(n, 'rgba(255, 214, 0, 0.9)', 'right'));

    // 4. Draw Stimulation Shockwave Ripples
    for (let i = this.stimulationRipples.length - 1; i >= 0; i--) {
      const rip = this.stimulationRipples[i];
      rip.radius += 2.0;
      rip.alpha -= 0.05;

      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, rip.alpha)})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (rip.alpha <= 0) {
        this.stimulationRipples.splice(i, 1);
      }
    }
  }
}

// Distance from point to line segment helper
function distToSegment(p, v, w) {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
