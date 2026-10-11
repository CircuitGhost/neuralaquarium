# SYNAPSE-3D // Evolving Neural Connectome Aquarium

An artificial life WebGL simulation running in Three.js where translucent, bioluminescent aquatic organisms navigate a 3D ocean environment driven by an active internal neural connectome.

---

## 🔬 Core Features & Mechanics

### 1. 3D Internal Neural Connectome (CTRNN)
* **Suspended 3D Brain**: Visible inside each creature's translucent body pod.
* **8 Sensory Inputs**:
  * Dual directional food receptors (left / right phototaxis/chemoreception).
  * Food proximity & elevation pitch angle.
  * Tank boundary collision alerts.
  * Internal proprioceptive speed & hunger state.
  * Central pattern generator (CPG) sinusoidal clock.
* **4 Recurrent Hidden Interneurons**: Continuous-time recurrent neural network (CTRNN) with leaky-integrator dynamics ($\tau$) and feedback loops.
* **4 Motor Outputs**: Left thrust, right thrust, pitch angle, and tail burst propulsion.
* **Action Potential Visualization**: 
  * Synapse lines color-coded by excitatory (cyan/gold) or inhibitory (crimson) weights.
  * 3D electrical pulses actively travel from neuron to neuron in real-time as synapses fire.

### 2. Lifelike Aquatic Locomotion
* **Segmented Undulating Spine**: 5 articulated vertebrae propagating sinusoidal traveling waves.
* **Dynamic Pectoral Fins**: Asymmetric flapping driven directly by differential motor neurons.
* **Subsurface / Glassmorphic Body**: `MeshPhysicalMaterial` with transmission, roughness, and dynamic bioluminescent emissive pulses on feeding.

### 3. Real-Time In-Browser Evolutionary Dynamics
* Organisms feed on drifting plankton clusters to gain energy.
* High-energy creatures replicate, passing on mutated weights and morphological traits (color hue, fin scale, antenna length).
* Low-energy creatures starve and dissolve into the marine substrate.
* Extinction prevention automatically seeds fresh mutations from historical alpha genomes.

### 4. Connectome Brain Surgery & Real-Time Probing
* **Neuron Stimulation**: Click any neuron node on the HUD canvas to inject artificial voltage (+1.8V)—witness electrical action potentials spark across axons and the physical creature twitch its fin or burst its tail in response.
* **Synaptic Polarity Inversion**: Click any synapse line on the HUD to toggle between **Excitatory** (cyan) and **Inhibitory** (scarlet) weights, directly altering swimming instincts.
* **3D Cross-Highlighting**: Hovering any neuron on the 2D HUD highlights and scales the corresponding 3D neuron inside the organism's translucent head.
* **Champion Cloning**: One-click **🧬 Clone (x3)** button to spawn identical clones of any specimen's brain to test its dominance.

### 5. Advanced Cinematic Camera & Controls
* **3 Camera Modes**:
  * **Free Orbit (Key `1`)**: Traditional free-look orbiting the ecosystem.
  * **Chase Cam (Key `2`)**: Spring-damped chase camera smoothly following behind the creature, banking into turns.
  * **Macro Studio (Key `3`)**: Close-up studio view locked onto the translucent head and firing connectome.
* **Bullet-Time Mode (Key `B`)**: Eases simulation down to 0.22x slow motion for detailed neural inspection.
* **Zoom Controls**: Mouse scroll wheel, pinch gesture, keys `+` / `-`, or HUD `+ Zoom In` / `− Zoom Out` buttons.
* **Specimen Quick-Jump**:
  * `Tab` / `Shift+Tab` or `[` / `]`: Cycle through living organisms.
  * **👑 Alpha**: Jump to specimen with the most food consumed.
  * **⏳ Elder**: Jump to the oldest surviving organism.
  * **⚡ Fastest**: Jump to the highest-velocity swimmer.
* **Holographic Targeting Reticle**: Moving cursor over any creature draws an active targeting bracket.

---

## 🚀 Running the Project

```bash
# 1. Install dependencies
npm install

# 2. Start local development server
npm run dev

# 3. Open in browser
# http://localhost:5173
```

---

## 🎬 Reddit Post Showcase Strategy

* **Video format**: 15–20 second 60 FPS screen capture.
* **Opening hook (first 3 seconds)**: Start in close-up macro tracking mode on a single organism as it detects a nutrient particle—the sensory antennae bulb lights up, sparks shoot across the 3D connectome inside its head, its pectoral fins twist, and its tail bursts forward to swallow the food.
* **Mid-clip**: Pull back to wide angle showing the entire glowing school of 20+ organisms and drop a nutrient cluster with Shift-click to watch them swarm.
* **Suggested Titles**:
  * *"I built an aquarium in Three.js where each creature has a visible 3D neural network that evolves in real-time to hunt food [Link in comments]"*
  * *"Visualizing neural action potentials inside evolving 3D organisms using Three.js & WebGL"*
