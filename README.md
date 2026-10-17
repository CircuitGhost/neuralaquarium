# Neural Aquarium

An in-browser artificial life simulation built with Three.js and WebGL. Translucent aquatic organisms swim, hunt drifting plankton, age through distinct life stages, and reproduce with mutation in a contained 2.5D planted aquarium. 

Each organism is driven by an internal Continuous-Time Recurrent Neural Network (CTRNN) visible inside its body, with real-time action potential pulses traveling along synapses as it navigates.

---

## Systems Overview

### 1. Neural Connectome Architecture
Each creature runs a real-time neural network integrated via Euler steps every frame:
* **8 Sensory Inputs**:
  * Left & Right Food Sensors (directional phototaxis / chemoreception)
  * Food Proximity & Elevation
  * Wall & Substrate Proximity Alert
  * Proprioceptive Velocity
  * Internal Metabolic Energy / Hunger State
  * Central Pattern Generator (CPG) sinusoidal gait pacemaker
* **4 Recurrent Leaky Hidden Neurons**: Continuous-time recurrent interneurons with dynamic feedback loops and time-constant decay ($\tau$).
* **4 Motor Outputs**: Left thrust, right thrust, vertical pitch, and caudal burst propulsion.
* **Axon Pulse Propagation**: Electrical pulses travel along synapse lines in real-time. Synapses are color-coded by polarity (cyan/excitatory, rose/inhibitory).

### 2. Life Stages & Senescence
Organisms go through a complete biological lifecycle:
* **Juvenile Fry (0 – 12s)**: Smaller scale (60% growing to 100%), translucent body, energetic fin flutter, higher metabolic rate, infertile.
* **Mature Adult (12 – 90s)**: Full adult scale, vibrant bioluminescent markings, capable of genetic reproduction when energy threshold is reached.
* **Elder (90s+)**: Stately swimming cadence, deeper weathered hue, slightly larger (115%).
* **Natural Senescence**: Upon reaching maximum lifespan (~135–165s), elders gently sink to the sandy riverbed, dissolving into sparkling nutrient spores that enrich the surrounding substrate anemones and flora.

### 3. Hydrodynamics & Convection Currents
* **Dual-Cell Convection Gyres**: Counter-rotating circulation cells centered around the left and right kelp groves generate slow, continuous underwater currents with central upwelling and perimeter downwelling.
* **Plankton Drift Lanes**: Nutrient clusters drift along natural gyres, creating dynamic feeding lanes that organisms learn to patrol.
* **Locomotion Kinematics**: 5-segment undulating spinal column with progressive joint amplitude and dynamic banking roll into turns.

### 4. Persistence & Lineage Snapshot Bank
* **Auto-Save to LocalStorage**: Periodically saves living population state, generation counters, and champion lineages so your ecosystem persists across browser sessions.
* **Lineage Snapshot Bank (`L` key)**: Save notable genetic strains with custom designations or spawn from curated presets:
  * *Emerald Shoaler Lineage*: Agile schooler tuned with rapid fin flutter and high sensory sensitivity.
  * *Swift Deep Glider*: Streamlined, high-speed gyre cruiser.
  * *Abyssal Amber Forager*: Patient bottom-grazer with expansive sensory bulbs and efficient energy consumption.

### 5. Interactive HUD & Neurosurgery
* **2D Connectome Matrix**: Zero-collision 3-column neural diagram displaying real-time node activation voltages and connection weights.
* **Neurosurgery**: Click any node on the HUD to inject artificial voltage (+1.8V) to trigger physical swimming reflexes, or click any synapse to toggle excitatory/inhibitory polarity in real-time.
* **Tracking Modes**:
  * **Track (`1`)**: Smooth spring-damped camera tracking locked onto the selected specimen in the 2D plane.
  * **Macro (`2`)**: Close-up studio view locked onto the firing connectome.
  * **Free Pan (`3`)**: Free 2D navigation across the entire tank.
* **Zen View (`H`)**: Hides all overlays for ambient full-screen observation.
* **Soundscape**: Procedural audio engine synthesizing oceanic pink noise currents, feeding chimes, and neural discharge clicks via the Web Audio API.

---

## Controls

| Key / Action | Function |
|---|---|
| **Left Click + Drag** | 2D pan across the aquarium |
| **Scroll Wheel / `+` `-`** | Smooth zoom in / out |
| **Click Creature** | Select and track organism |
| **`Tab` / `[` `]`** | Cycle previous / next organism |
| **`1` / `2` / `3`** | Switch Camera (Track / Macro / Free Pan) |
| **`Space`** | Pause / Resume simulation |
| **`B`** | Toggle 0.2x Bullet-Time slow motion |
| **`F` / Shift + Click** | Disperse nutrient plankton cluster |
| **`C`** | Clone selected organism's genome (3x) |
| **`L`** | Open Lineage Snapshot Bank |
| **`H`** | Toggle Zen View (hide/show interface) |

---

## Getting Started

### Requirements
* [Node.js](https://nodejs.org/) (v18+)
* Web browser with WebGL support

### Setup

```bash
# Clone repository
git clone https://github.com/CircuitGhost/neuralaquarium.git
cd neuralaquarium

# Install dependencies
npm install

# Start development server
npm run dev
```

Visit `http://localhost:5188` in your browser.

To build for production:
```bash
npm run build
```

---

## Tech Stack

* **Renderer**: Three.js (WebGL)
* **Bundler**: Vite
* **Audio**: Procedural Web Audio API (white/pink noise filters, bi-quad resonant chimes)
* **Typography**: Inter & JetBrains Mono

---

## License

MIT License. See [LICENSE](LICENSE) for details.
