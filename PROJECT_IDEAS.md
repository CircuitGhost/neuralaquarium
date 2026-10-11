# Viral Three.js Project Concepts & Blueprints

Curated high-concept WebGL/Three.js projects designed for high viral engagement across technical, creative, and general subreddits (**r/threejs**, **r/creativecoding**, **r/InternetIsBeautiful**, **r/programming**, **r/simulated**, **r/machinelearning**).

---

## 1. 3D Bioluminescent Slime Mold (*Physarum polycephalum*)
* **Subreddits**: r/creativecoding, r/simulated, r/InternetIsBeautiful, r/woahdude
* **Concept**: 3D volumetric slime mold crawling over imported 3D scans (statues, skulls, branches, wireframes) using GPGPU compute/particle agents.
* **The Hook**: Glowing neon mycelial/slime networks actively colonizing geometry, pulsing in sync with ambient audio or mouse turbulence, leaving glowing trails with UnrealBloom post-processing.
* **Core Tech**: Three.js (WebGPU/TSL or WebGL GPGPU), 3D ping-pong trail textures, UnrealBloomPass, depth of field.

---

## 2. Evolving 3D Neural Braitenberg / Connectome Creature *(Current Active Project)*
* **Subreddits**: r/programming, r/threejs, r/machinelearning, r/artificial
* **Concept**: An artificial life digital aquarium where translucent, bioluminescent organisms navigate 3D space driven by an active internal neural connectome with real-time synaptic pulse visualization.
* **Key Mechanics**:
  * **Translucent Organism Anatomy**: Glassmorphic/subsurface body, sensory antennae (phototaxis / chemoreception), undulating fins/tail.
  * **Visible 3D Neural Circuit**: Internally suspended 3D neural nodes connected by synapses. Action potentials (glowing electrical pulses) flash along axons as sensory inputs trigger motor outputs.
  * **Emergent Brain Architecture**: Continuous-time recurrent neural network (CTRNN) or Braitenberg ring-attractor architecture driving steering, speed, and phototaxis.
  * **Real-time Evolution & Genetics**: Creatures feed on nutrients, reproduce with mutation (weight jitter, morphology changes), or starve, evolving behavioral strategies over generations.
  * **Macro Inspection Mode**: Click any specimen to enter smooth cinematic orbital lock-on, slowing down time and inspecting its live neural state, firing rates, generation pedigree, and genome.
* **Core Tech**: Three.js, instanced meshes / ribbon trails, custom shaders for synaptic action potentials, post-processing bloom, in-browser evolutionary loop.

---

## 3. Glassmorphic Micro-Terrarium (Procedural L-System Flora)
* **Subreddits**: r/InternetIsBeautiful, r/webdev, r/threejs, r/IndieDev
* **Concept**: A rotatable, ambient glass cube housing a procedural biological terrarium that grows and reacts to local time, weather, and microphone audio.
* **The Hook**: Photorealistic real-time glass refractions, rain sliding down the exterior glass faces, dynamic botanical branching (L-systems), swaying in response to mouse cursor wind.
* **Core Tech**: MeshPhysicalMaterial (transmission, roughness, IOR), procedural plant generation, screen-space caustics, audio reactivity.

---

## 4. Tactile Mechanical Pocket Synth / Tape Loop Deck
* **Subreddits**: r/synthesizers, r/webdev, r/threejs, r/cassetteculture
* **Concept**: A hyper-tactile, skeuomorphic 1970s Braun / Teenage Engineering-style audio workstation in 3D.
* **The Hook**: Physically draggable knobs, tactile rocker switches with mechanical click feedback, spinning magnetic tape spools with real-time flutter/tape saturation powered by the Web Audio API.
* **Core Tech**: Three.js, Raycasting / spring physics for dials, Web Audio API synthesis and convolution reverb.

---

## 5. Celestial Gravitational Fluid / N-Body Accretion Sandbox
* **Subreddits**: r/simulated, r/space, r/threejs, r/woahdude
* **Concept**: 500,000+ GPU particles simulating gravitational N-body orbital dynamics and tidal collisions.
* **The Hook**: Flinging neutron stars into spinning spiral galaxy discs, watching tidal tails rip apart, and triggering relativistic gravitational lensing shaders around black holes at 60 FPS in the browser.
* **Core Tech**: WebGL/WebGPU compute shader simulation, instanced particle buffers, post-processing bloom and space dust raymarching.
