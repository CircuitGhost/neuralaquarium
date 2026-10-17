# 🌊 SYNAPSE-3D // Evolving Neural Connectome Aquarium

[![Three.js](https://img.shields.io/badge/Three.js-r186-black?style=flat-square&logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-990000?style=flat-square&logo=webgl)](https://www.khronos.org/webgl/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

An artificial life simulation in WebGL/Three.js where bioluminescent aquatic organisms navigate a tranquil planted 2.5D aquarium tank, powered by real-time continuous-time recurrent neural networks (CTRNN) visible directly inside each creature's translucent head.

---

## ✨ Features & Systems

### 🌿 1. Tranquil Planted 2.5D Aquarium Tank
* **Procedural Kelp Forest**: Swaying multi-stem ribbon kelp clusters rooted along the sandy substrate with organic wave kinematics.
* **Stratified Riverbed**: Sandy seabed with scattered smooth stones and soft bottom contact shadows.
* **Atmospheric Caustics & God Rays**: Soft underwater sunlight ribbons and depth fog tuned for tranquil, natural illumination without harsh glare.
* **Fluid 2D Navigation**: Click and drag anywhere on the tank to pan smoothly up, down, left, and right; scroll wheel or pinch to zoom from wide tank overviews down to microscopic cell scales.

### 🧠 2. 3D Internal Neural Connectome (CTRNN)
* **Suspended 3D Brain**: A living neural network visible inside each creature's glassmorphic head pod.
* **8 Sensory Inputs**:
  * Dual directional food receptors (left/right phototaxis & chemoreception).
  * Food proximity & elevation pitch angle.
  * Tank boundary collision alert sensors.
  * Internal proprioceptive velocity & hunger state.
  * Central Pattern Generator (CPG) sinusoidal clock for baseline swim pulses.
* **4 Recurrent Leaky Hidden Neurons**: Continuous-time recurrent neural network (CTRNN) with dynamic feedback loops and time-constant decay ($\tau$).
* **4 Motor Outputs**: Left pectoral thrust, right pectoral thrust, pitch elevation, and caudal burst propulsion.
* **Real-Time Action Potential Visualization**: 
  * Synapse lines color-coded by excitatory (cyan/gold) or inhibitory (crimson) weights.
  * Electrical pulses physically travel along axons in real-time as synapses fire.

### 🧬 3. In-Browser Evolutionary Dynamics
* Organisms autonomously hunt drifting plankton clusters to maintain energy.
* High-energy creatures reproduce, passing down mutated synaptic weights, time constants, and morphological traits (color hue, fin scale, antenna length).
* Low-energy creatures starve and dissolve gracefully into the marine substrate.
* Adaptive population management preserves alpha genome lineages to prevent extinction bottlenecks.

### 🔬 4. Live Connectome Neurosurgery
* **Voltage Injection**: Click any neuron node on the 2D HUD to inject artificial electrical potential (+1.8V)—watch sparks propagate through the connectome as the creature twitches its fins or bursts its tail in response.
* **Synaptic Polarity Inversion**: Click any synapse on the HUD to toggle between **Excitatory** and **Inhibitory** weights, actively rewiring instincts in real-time.
* **3D Cross-Highlighting**: Hovering nodes on the HUD highlights and scales the corresponding 3D neuron inside the specimen's head.
* **Specimen Cloning**: One-click **🧬 Clone (x3)** button to spawn exact copies of any champion organism's brain to test its dominance against the school.

### 🎥 5. Cinematic Cameras & Specimen Tracking
* **3 Cinematic Perspectives**:
  * **Follow Specimen (Key `1`)**: Spring-damped tracking locked onto selected swimming organism in the 2D plane.
  * **Macro Studio (Key `2`)**: Close-up studio view locked onto the creature's firing connectome.
  * **Free Tank Pan (Key `3` or Canvas Drag)**: Smooth 2D panning and zooming across the entire aquarium environment.
* **Bullet-Time Mode (Key `B`)**: Eases simulation speed down to 0.22x slow motion for detailed neural and locomotion inspection.
* **Leaderboard Quick-Jump**:
  * `Tab` / `Shift+Tab` or `[` / `]`: Cycle through living specimens.
  * **👑 Alpha**: Jump to the organism with the most food consumed.
  * **⏳ Elder**: Jump to the oldest surviving specimen.
  * **⚡ Fastest**: Jump to the highest-velocity swimmer.
* **Shift + Click Plankton Drop**: Drop fresh nutrient clusters directly into the tank and watch nearby organisms detect and swarm toward them.

---

## 🎮 Controls Quick-Reference

| Action | Control |
|---|---|
| **Pan Tank** | Click & drag on canvas (left, right, up, down) |
| **Zoom View** | Mouse scroll wheel / pinch gesture / `+` and `−` HUD buttons |
| **Inspect Creature** | Click directly on any swimming creature |
| **Drop Food** | `Shift` + Left Click anywhere in the tank or `F` key |
| **Camera Modes** | `1` Follow Fish · `2` Macro Studio · `3` Free Pan |
| **Cycle Organisms** | `Tab` / `Shift+Tab` or `[` / `]` |
| **Bullet-Time (Slow Mo)** | `B` key |
| **Neurosurgery / Voltage** | Click any neuron node on the HUD brain inspector |
| **Synapse Rewiring** | Click any axon connection on the HUD |
| **Audio Toggle** | `🔇 Audio Off` / `🔊 Audio On` button on HUD |

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* Modern web browser with WebGL 2.0 support (Chrome, Firefox, Safari, Edge)

### Installation & Launch

```bash
# 1. Clone the repository
git clone https://github.com/CircuitGhost/neuralaquarium.git
cd neuralaquarium

# 2. Install dependencies
npm install

# 3. Launch local Vite development server
npm run dev

# 4. Open in browser
# http://localhost:5173
```

---

## 🛠️ Architecture & Tech Stack

* **Rendering Engine**: [Three.js](https://threejs.org/) (r186)
* **Build System**: [Vite](https://vitejs.dev/)
* **Neural Architecture**: Continuous-Time Recurrent Neural Networks (CTRNN) with Euler numerical integration
* **Locomotion Kinematics**: 5-segment spine wave propagation with differential pectoral fin aero/hydrodynamic drag
* **Shading & Post-Processing**: Custom Three.js `MeshPhysicalMaterial` transmission with ACES Filmic tone mapping and selective bloom
* **Audio Synthesis**: Pure Web Audio API procedural sound generation

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
