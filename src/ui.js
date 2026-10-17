import * as THREE from 'three';
import { SENSORY_LABELS, HIDDEN_LABELS, MOTOR_LABELS, NUM_SENSORY, NUM_HIDDEN, NUM_MOTOR } from './neural.js';
import { soundEngine } from './audio.js';

// Concise display labels for canvas nodes (to guarantee zero text overlap)
const SHORT_SENSORY = [
  'Antenna L',
  'Antenna R',
  'Food Dist',
  'Food Elev',
  'Boundary',
  'Velocity',
  'Hunger',
  'Clock'
];

const SHORT_HIDDEN = ['α', 'β', 'γ', 'δ'];

const SHORT_MOTOR = [
  'Thrust L',
  'Thrust R',
  'Pitch',
  'Burst'
];

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
    this.stimulationRipples = [];
    this.cachedNodes = { sensory: [], hidden: [], motor: [] };
    this.cachedSynapses = [];

    // Cache DOM Elements
    this.elPopCount = document.getElementById('val-population');
    this.elGenCount = document.getElementById('val-generation');
    this.elFoodCount = document.getElementById('val-food');
    this.elBirthCount = document.getElementById('val-births');
    this.elDeathCount = document.getElementById('val-deaths');

    this.elSpecId = document.getElementById('val-spec-id');
    this.elSpecSwatch = document.getElementById('specimen-swatch');
    this.elSpecGen = document.getElementById('val-spec-gen');
    this.elSpecStage = document.getElementById('val-spec-stage');
    this.elSpecEnergy = document.getElementById('val-spec-energy');
    this.elSpecEnergyBar = document.getElementById('bar-spec-energy');
    this.elSpecAge = document.getElementById('val-spec-age');
    this.elSpecFood = document.getElementById('val-spec-food');
    this.elSpecSpeed = document.getElementById('val-spec-speed');

    this.elOverlay = document.getElementById('ui-overlay');
    this.elBrainTooltip = document.getElementById('brain-tooltip');
    this.btnPlayPause = document.getElementById('btn-play-pause');
    this.iconPause = document.getElementById('icon-pause');
    this.iconPlay = document.getElementById('icon-play');
    this.iconAudioOn = document.getElementById('icon-audio-on');
    this.iconAudioOff = document.getElementById('icon-audio-off');

    // 2D Connectome Canvas with High-DPI support
    this.brainCanvas = document.getElementById('brain-canvas');
    if (this.brainCanvas) {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvasWidth = 300;
      this.canvasHeight = 210;
      this.brainCanvas.width = this.canvasWidth * this.dpr;
      this.brainCanvas.height = this.canvasHeight * this.dpr;
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
        const spd = parseFloat(btn.dataset.speed);
        if (spd === 0) {
          this.togglePause();
        } else {
          speedBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.isPaused = false;
          this.bulletTime = false;
          this.simSpeed = spd;
          const bBtn = document.getElementById('btn-bullet-time');
          if (bBtn) bBtn.classList.remove('active');
          this.updatePlayPauseUI();
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
        this.updatePlayPauseUI();
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

    // 6. Champion Quick-jump Buttons
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
        this.env.spawnFoodCluster(center, 5);
      });
    }

    // 9. Reset Population
    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        this.pop.resetAll();
      });
    }

    // 10. Web Audio API Ambient & Sfx Toggle
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const isMuted = soundEngine.toggleMute();
        if (this.iconAudioOn && this.iconAudioOff) {
          this.iconAudioOn.style.display = isMuted ? 'none' : 'block';
          this.iconAudioOff.style.display = isMuted ? 'block' : 'none';
        }
        btnAudio.classList.toggle('active', !isMuted);
        const textAudio = document.getElementById('text-audio');
        if (textAudio) textAudio.innerText = isMuted ? 'Sound' : 'Sound On';
      });
    }

    // 11. Shortcuts Modal Dialog
    const btnShortcuts = document.getElementById('btn-shortcuts');
    const modalShortcuts = document.getElementById('shortcuts-modal');
    const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
    if (btnShortcuts && modalShortcuts) {
      btnShortcuts.addEventListener('click', () => {
        modalShortcuts.style.display = 'flex';
      });
    }
    if (btnCloseShortcuts && modalShortcuts) {
      btnCloseShortcuts.addEventListener('click', () => {
        modalShortcuts.style.display = 'none';
      });
    }
    if (modalShortcuts) {
      modalShortcuts.addEventListener('click', (e) => {
        if (e.target === modalShortcuts) modalShortcuts.style.display = 'none';
      });
    }

    // 12. Zen Mode / HUD Toggle
    const btnZen = document.getElementById('btn-zen');
    if (btnZen && this.elOverlay) {
      btnZen.addEventListener('click', () => {
        this.elOverlay.classList.toggle('zen-mode');
      });
    }

    // 13. Lineage Snapshot Bank Modal Dialog
    const btnLineage = document.getElementById('btn-lineage-bank');
    const modalLineage = document.getElementById('lineage-modal');
    const btnCloseLineage = document.getElementById('btn-close-lineage');
    if (btnLineage && modalLineage) {
      btnLineage.addEventListener('click', () => {
        this.renderLineageBank();
        modalLineage.style.display = 'flex';
      });
    }
    if (btnCloseLineage && modalLineage) {
      btnCloseLineage.addEventListener('click', () => {
        modalLineage.style.display = 'none';
      });
    }
    if (modalLineage) {
      modalLineage.addEventListener('click', (e) => {
        if (e.target === modalLineage) modalLineage.style.display = 'none';
      });
    }

    // 14. Save Lineage Prompt Dialog
    const btnSaveHeader = document.getElementById('btn-save-lineage');
    const btnSaveCurrent = document.getElementById('btn-save-current-lineage');
    const modalSavePrompt = document.getElementById('save-prompt-modal');
    const btnCloseSavePrompt = document.getElementById('btn-close-save-prompt');
    const btnCancelSave = document.getElementById('btn-cancel-save');
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    const inputLineageName = document.getElementById('input-lineage-name');

    const openSavePrompt = () => {
      const c = this.pop.selectedCreature;
      if (!c) return;
      if (inputLineageName) {
        inputLineageName.value = `Lineage #${c.id} (Gen ${c.generation})`;
      }
      if (modalSavePrompt) modalSavePrompt.style.display = 'flex';
      if (inputLineageName) setTimeout(() => inputLineageName.focus(), 50);
    };

    if (btnSaveHeader) btnSaveHeader.addEventListener('click', openSavePrompt);
    if (btnSaveCurrent) btnSaveCurrent.addEventListener('click', openSavePrompt);

    if (btnCloseSavePrompt && modalSavePrompt) {
      btnCloseSavePrompt.addEventListener('click', () => {
        modalSavePrompt.style.display = 'none';
      });
    }
    if (btnCancelSave && modalSavePrompt) {
      btnCancelSave.addEventListener('click', () => {
        modalSavePrompt.style.display = 'none';
      });
    }
    if (modalSavePrompt) {
      modalSavePrompt.addEventListener('click', (e) => {
        if (e.target === modalSavePrompt) modalSavePrompt.style.display = 'none';
      });
    }

    if (btnConfirmSave) {
      btnConfirmSave.addEventListener('click', () => {
        const name = inputLineageName ? inputLineageName.value : '';
        this.pop.saveLineagePreset(name);
        if (modalSavePrompt) modalSavePrompt.style.display = 'none';
        this.renderLineageBank();
        soundEngine.playStimulate();
      });
    }
  }

  renderLineageBank() {
    const list = document.getElementById('lineage-preset-list');
    if (!list) return;

    list.innerHTML = '';
    const presets = this.pop.lineagePresets || this.pop.loadLineagePresets();

    presets.forEach(p => {
      const card = document.createElement('div');
      card.className = 'lineage-card';

      const hue = (p.traits && p.traits.hue !== undefined) ? p.traits.hue : 0.5;
      const color = new THREE.Color().setHSL(hue, 0.9, 0.55);
      const hex = '#' + color.getHexString();

      card.innerHTML = `
        <div class="lineage-swatch" style="background:${hex}; box-shadow:0 0 8px ${hex};"></div>
        <div class="lineage-info">
          <div class="lineage-title-row">
            <span class="lineage-name">${p.name}</span>
            <span class="lineage-tag ${p.builtIn ? 'builtin' : ''}">${p.builtIn ? 'Built-in' : 'Saved'}</span>
            <span class="lineage-tag">Gen ${p.generation || 1}</span>
          </div>
          <div class="lineage-desc">${p.description || ''}</div>
        </div>
        <div class="lineage-actions">
          <button class="btn-spawn-lineage" data-id="${p.id}" title="Spawn 2 organisms from this lineage into the aquarium">Spawn (2x)</button>
          ${!p.builtIn ? `<button class="btn-del-lineage" data-id="${p.id}" title="Delete saved lineage">&times;</button>` : ''}
        </div>
      `;

      // Spawn Action
      const spawnBtn = card.querySelector('.btn-spawn-lineage');
      if (spawnBtn) {
        spawnBtn.addEventListener('click', () => {
          this.pop.spawnFromPreset(p, 2);
          soundEngine.playStimulate();
          if (this.cam.setMode) this.cam.setMode('track');
          const modal = document.getElementById('lineage-modal');
          if (modal) modal.style.display = 'none';
        });
      }

      // Delete Action (only custom user presets)
      const delBtn = card.querySelector('.btn-del-lineage');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.pop.deleteLineagePreset(p.id);
          this.renderLineageBank();
        });
      }

      list.appendChild(card);
    });
  }

  toggleBulletTime() {
    this.bulletTime = !this.bulletTime;
    const btnBullet = document.getElementById('btn-bullet-time');
    const speedBtns = document.querySelectorAll('.btn-speed');
    if (btnBullet) btnBullet.classList.toggle('active', this.bulletTime);

    if (this.bulletTime) {
      this.isPaused = false;
      this.simSpeed = 0.22;
      speedBtns.forEach(b => b.classList.remove('active'));
    } else {
      this.simSpeed = 1.0;
      const btn1x = document.querySelector('.btn-speed[data-speed="1"]');
      if (btn1x) btn1x.classList.add('active');
    }
    this.updatePlayPauseUI();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.updatePlayPauseUI();
  }

  updatePlayPauseUI() {
    if (this.iconPause && this.iconPlay) {
      this.iconPause.style.display = this.isPaused ? 'none' : 'block';
      this.iconPlay.style.display = this.isPaused ? 'block' : 'none';
    }
    if (this.btnPlayPause) {
      this.btnPlayPause.classList.toggle('active', this.isPaused);
    }
  }

  bindBrainCanvasEvents() {
    if (!this.brainCanvas) return;

    const getCanvasPos = (e) => {
      const rect = this.brainCanvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (this.canvasWidth / rect.width),
        y: (e.clientY - rect.top) * (this.canvasHeight / rect.height)
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
          if (dSq < 144) {
            hitNode = n;
          }
        });
      });

      if (hitNode) {
        this.hoveredNeuron = hitNode;
        this.hoveredSynapse = null;
        this.brainCanvas.style.cursor = 'pointer';
        c.highlightNeuron(hitNode.type, hitNode.idx);

        if (this.elBrainTooltip) {
          const sign = hitNode.val >= 0 ? '+' : '';
          this.elBrainTooltip.innerText = `${hitNode.fullLabel}: ${sign}${hitNode.val.toFixed(2)}`;
          this.elBrainTooltip.classList.add('active');
        }
        return;
      }

      // Check Synapses
      let hitSyn = null;
      for (const syn of this.cachedSynapses) {
        let dist;
        if (syn.ctrl) {
          dist = Math.min(distToSegment(pos, syn.p1, syn.ctrl), distToSegment(pos, syn.ctrl, syn.p2));
        } else {
          dist = distToSegment(pos, syn.p1, syn.p2);
        }
        if (dist < 5.0) {
          hitSyn = syn;
          break;
        }
      }

      if (hitSyn) {
        this.hoveredSynapse = hitSyn;
        this.hoveredNeuron = null;
        this.brainCanvas.style.cursor = 'crosshair';
        c.highlightNeuron(null);

        if (this.elBrainTooltip) {
          const sign = hitSyn.weight > 0 ? '+' : '';
          const typeStr = hitSyn.weight > 0 ? 'Excitatory' : 'Inhibitory';
          this.elBrainTooltip.innerText = `${hitSyn.fromLabel} → ${hitSyn.toLabel} [${sign}${hitSyn.weight.toFixed(2)} ${typeStr}]`;
          this.elBrainTooltip.classList.add('active');
        }
        return;
      }

      this.hoveredNeuron = null;
      this.hoveredSynapse = null;
      this.brainCanvas.style.cursor = 'default';
      c.highlightNeuron(null);
      if (this.elBrainTooltip) this.elBrainTooltip.classList.remove('active');
    });

    this.brainCanvas.addEventListener('mouseleave', () => {
      this.hoveredNeuron = null;
      this.hoveredSynapse = null;
      if (this.pop.selectedCreature) this.pop.selectedCreature.highlightNeuron(null);
      if (this.elBrainTooltip) this.elBrainTooltip.classList.remove('active');
    });

    // Mouse Click: Stimulate Neuron or Flip Synapse Polarity
    this.brainCanvas.addEventListener('click', (e) => {
      const c = this.pop.selectedCreature;
      if (!c) return;

      if (this.hoveredNeuron) {
        c.stimulateNeuron(this.hoveredNeuron.type, this.hoveredNeuron.idx);
        soundEngine.playStimulate();
        this.stimulationRipples.push({
          x: this.hoveredNeuron.x,
          y: this.hoveredNeuron.y,
          radius: 6,
          alpha: 1.0
        });
      } else if (this.hoveredSynapse) {
        const syn = this.hoveredSynapse;
        c.connectome.toggleSynapsePolarity(syn.fromType, syn.fromIdx, syn.toType, syn.toIdx);
        c.rebuildSynapticLines();
        soundEngine.playStimulate();
        this.stimulationRipples.push({
          x: syn.ctrl ? syn.ctrl.x : (syn.p1.x + syn.p2.x) * 0.5,
          y: syn.ctrl ? syn.ctrl.y : (syn.p1.y + syn.p2.y) * 0.5,
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
      if (this.elSpecSwatch && c.color) {
        const hex = '#' + c.color.getHexString();
        this.elSpecSwatch.style.backgroundColor = hex;
        this.elSpecSwatch.style.boxShadow = `0 0 6px ${hex}`;
      }
      if (this.elSpecGen) this.elSpecGen.innerText = `Gen ${c.generation}`;
      if (this.elSpecStage) {
        const stage = c.lifeStage || (c.age < 12 ? 'fry' : (c.age < 90 ? 'adult' : 'elder'));
        const stageNames = { fry: 'Fry (Juv)', adult: 'Adult', elder: 'Elder' };
        this.elSpecStage.innerText = stageNames[stage] || 'Adult';
        this.elSpecStage.className = `card-badge badge-${stage}`;
      }
      if (this.elSpecEnergy) this.elSpecEnergy.innerText = `${Math.max(0, Math.round(c.energy))} / 220`;
      if (this.elSpecEnergyBar) {
        const pct = Math.min(100, Math.max(0, (c.energy / 220) * 100));
        this.elSpecEnergyBar.style.width = `${pct}%`;
        this.elSpecEnergyBar.style.background = c.energy < 45 ?
          'linear-gradient(90deg, #ef4444, #f43f5e)' :
          (c.energy < 100 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #10b981, #34d399)');
      }
      if (this.elSpecAge) this.elSpecAge.innerText = `${c.age.toFixed(1)}s`;
      if (this.elSpecFood) this.elSpecFood.innerText = c.foodEaten;
      if (this.elSpecSpeed) this.elSpecSpeed.innerText = c.speed.toFixed(1);

      // Draw 2D Connectome Architecture
      this.drawConnectome(c);
    }
  }

  drawConnectome(creature) {
    if (!this.ctx || !this.brainCanvas) return;
    const ctx = this.ctx;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    const dpr = this.dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const c = creature.connectome;
    const g = c.genome;

    // 3 Distinct Architecture Columns with generous breathing room
    const xSensory = 22;
    const xHidden = w * 0.5; // 150
    const xMotor = w - 22;   // 278

    // 1. Position Sensory Nodes
    const sensoryNodes = [];
    for (let i = 0; i < NUM_SENSORY; i++) {
      const y = 20 + (i / (NUM_SENSORY - 1)) * (h - 40);
      sensoryNodes.push({
        type: 'sensory',
        idx: i,
        x: xSensory,
        y,
        val: c.sensoryValues[i],
        shortLabel: SHORT_SENSORY[i],
        fullLabel: SENSORY_LABELS[i]
      });
    }

    // 2. Position Hidden Nodes
    const hiddenNodes = [];
    for (let i = 0; i < NUM_HIDDEN; i++) {
      const y = 42 + (i / (NUM_HIDDEN - 1)) * (h - 84);
      hiddenNodes.push({
        type: 'hidden',
        idx: i,
        x: xHidden,
        y,
        val: c.hiddenValues[i],
        shortLabel: SHORT_HIDDEN[i],
        fullLabel: HIDDEN_LABELS[i]
      });
    }

    // 3. Position Motor Nodes
    const motorNodes = [];
    for (let i = 0; i < NUM_MOTOR; i++) {
      const y = 42 + (i / (NUM_MOTOR - 1)) * (h - 84);
      motorNodes.push({
        type: 'motor',
        idx: i,
        x: xMotor,
        y,
        val: c.motorValues[i],
        shortLabel: SHORT_MOTOR[i],
        fullLabel: MOTOR_LABELS[i]
      });
    }

    this.cachedNodes = { sensory: sensoryNodes, hidden: hiddenNodes, motor: motorNodes };
    this.cachedSynapses = [];

    // Draw Synapses
    const recordAndDrawSynapse = (p1, p2, weight, fromType, fromIdx, toType, toIdx, fromLabel, toLabel, isDirect = false, curveOffset = 0) => {
      const threshold = isDirect ? 0.35 : 0.22;
      if (Math.abs(weight) > threshold) {
        const isHovered = this.hoveredSynapse &&
          this.hoveredSynapse.fromType === fromType && this.hoveredSynapse.fromIdx === fromIdx &&
          this.hoveredSynapse.toType === toType && this.hoveredSynapse.toIdx === toIdx;

        let ctrl = null;
        if (curveOffset !== 0) {
          ctrl = { x: (p1.x + p2.x) * 0.5 + curveOffset, y: (p1.y + p2.y) * 0.5 };
        }

        this.cachedSynapses.push({ p1, p2, ctrl, weight, fromType, fromIdx, toType, toIdx, fromLabel, toLabel });

        if (isHovered) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
        } else {
          ctx.lineWidth = 0.8 + Math.min(1.8, Math.abs(weight) * 0.8);
          const alpha = isDirect ? Math.min(0.3, Math.abs(weight) * 0.28) : Math.min(0.65, Math.abs(weight) * 0.45);
          ctx.strokeStyle = weight > 0 ? `rgba(56, 189, 248, ${alpha})` : `rgba(244, 63, 94, ${alpha})`;
        }

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        if (ctrl) {
          ctx.quadraticCurveTo(ctrl.x, ctrl.y, p2.x, p2.y);
        } else {
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
      }
    };

    // Direct Reflexes (Sensory to Motor)
    for (let mi = 0; mi < NUM_MOTOR; mi++) {
      for (let si = 0; si < NUM_SENSORY; si++) {
        recordAndDrawSynapse(sensoryNodes[si], motorNodes[mi], g.wDirect[mi][si], 'sensory', si, 'motor', mi, sensoryNodes[si].fullLabel, motorNodes[mi].fullLabel, true);
      }
    }

    // Sensory to Hidden Interneurons
    for (let hi = 0; hi < NUM_HIDDEN; hi++) {
      for (let si = 0; si < NUM_SENSORY; si++) {
        recordAndDrawSynapse(sensoryNodes[si], hiddenNodes[hi], g.wSensoryHidden[hi][si], 'sensory', si, 'hidden', hi, sensoryNodes[si].fullLabel, hiddenNodes[hi].fullLabel);
      }
    }

    // Recurrent Hidden Feedback Loops
    for (let h1 = 0; h1 < NUM_HIDDEN; h1++) {
      for (let h2 = 0; h2 < NUM_HIDDEN; h2++) {
        if (h1 !== h2) {
          const curveOffset = ((h1 + h2) % 2 === 0) ? -20 : 20;
          recordAndDrawSynapse(hiddenNodes[h1], hiddenNodes[h2], g.wRecurrent[h2][h1], 'hidden', h1, 'hidden', h2, hiddenNodes[h1].fullLabel, hiddenNodes[h2].fullLabel, false, curveOffset);
        }
      }
    }

    // Hidden to Motor Outputs
    for (let mi = 0; mi < NUM_MOTOR; mi++) {
      for (let hi = 0; hi < NUM_HIDDEN; hi++) {
        recordAndDrawSynapse(hiddenNodes[hi], motorNodes[mi], g.wHiddenMotor[mi][hi], 'hidden', hi, 'motor', mi, hiddenNodes[hi].fullLabel, motorNodes[mi].fullLabel);
      }
    }

    // Active Action Potential Pulses
    c.activePulses.forEach(p => {
      let from, to;
      if (p.fromType === 'sensory') from = sensoryNodes[p.fromIdx];
      else if (p.fromType === 'hidden') from = hiddenNodes[p.fromIdx];

      if (p.toType === 'hidden') to = hiddenNodes[p.toIdx];
      else if (p.toType === 'motor') to = motorNodes[p.toIdx];

      if (from && to) {
        let px, py;
        if (p.fromType === 'hidden' && p.toType === 'hidden' && p.fromIdx !== p.toIdx) {
          const curveOffset = ((p.fromIdx + p.toIdx) % 2 === 0) ? -20 : 20;
          const cx = (from.x + to.x) * 0.5 + curveOffset;
          const cy = (from.y + to.y) * 0.5;
          const t = p.progress;
          const invT = 1.0 - t;
          px = invT * invT * from.x + 2 * invT * t * cx + t * t * to.x;
          py = invT * invT * from.y + 2 * invT * t * cy + t * t * to.y;
        } else {
          px = from.x + (to.x - from.x) * p.progress;
          py = from.y + (to.y - from.y) * p.progress;
        }

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Sensory Nodes (Column 1)
    sensoryNodes.forEach(n => {
      const isHovered = this.hoveredNeuron && this.hoveredNeuron.type === n.type && this.hoveredNeuron.idx === n.idx;
      const act = Math.min(1.0, Math.abs(n.val));
      const radius = (isHovered ? 5.5 : 4.0) + act * 2.5;

      // Glow halo
      const grad = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, radius * 2.0);
      grad.addColorStop(0, isHovered ? '#ffffff' : 'rgba(56, 189, 248, 0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 2.0, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = isHovered ? '#ffffff' : (act > 0.4 ? '#ffffff' : '#38bdf8');
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Label (drawn neatly to the right with ample margin)
      ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(241, 245, 249, 0.75)';
      ctx.font = isHovered ? '600 9px Inter, sans-serif' : '500 9px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(n.shortLabel, n.x + 11, n.y + 3);
    });

    // Draw Hidden Nodes (Column 2 - Interneurons)
    hiddenNodes.forEach(n => {
      const isHovered = this.hoveredNeuron && this.hoveredNeuron.type === n.type && this.hoveredNeuron.idx === n.idx;
      const act = Math.min(1.0, Math.abs(n.val));
      const radius = (isHovered ? 7.5 : 6.0) + act * 2.5;

      // Glow halo
      const grad = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, radius * 2.0);
      grad.addColorStop(0, isHovered ? '#ffffff' : 'rgba(192, 132, 252, 0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 2.0, 0, Math.PI * 2);
      ctx.fill();

      // Core node circle
      ctx.fillStyle = isHovered ? '#ffffff' : (act > 0.4 ? '#ffffff' : '#a855f7');
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Inside label: short Greek identifier centered cleanly inside circle
      ctx.fillStyle = (act > 0.4 || isHovered) ? '#0f172a' : '#ffffff';
      ctx.font = '600 8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(n.shortLabel, n.x, n.y + 3);
    });

    // Draw Motor Nodes (Column 3 - Outputs)
    motorNodes.forEach(n => {
      const isHovered = this.hoveredNeuron && this.hoveredNeuron.type === n.type && this.hoveredNeuron.idx === n.idx;
      const act = Math.min(1.0, Math.abs(n.val));
      const radius = (isHovered ? 5.5 : 4.0) + act * 2.5;

      // Glow halo
      const grad = ctx.createRadialGradient(n.x, n.y, 1, n.x, n.y, radius * 2.0);
      grad.addColorStop(0, isHovered ? '#ffffff' : 'rgba(251, 191, 36, 0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 2.0, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = isHovered ? '#ffffff' : (act > 0.4 ? '#ffffff' : '#fbbf24');
      ctx.beginPath();
      ctx.arc(n.x, n.y, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      // Label (drawn neatly to the left with ample margin)
      ctx.fillStyle = isHovered ? '#ffffff' : 'rgba(241, 245, 249, 0.75)';
      ctx.font = isHovered ? '600 9px Inter, sans-serif' : '500 9px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(n.shortLabel, n.x - 11, n.y + 3);
    });

    // Draw Stimulation Shockwave Ripples
    for (let i = this.stimulationRipples.length - 1; i >= 0; i--) {
      const rip = this.stimulationRipples[i];
      rip.radius += 2.0;
      rip.alpha -= 0.05;

      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, rip.alpha)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();

      if (rip.alpha <= 0) {
        this.stimulationRipples.splice(i, 1);
      }
    }

    ctx.restore();
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
