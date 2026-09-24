# أسود الجزائر — Lions of Algeria

An original third-person 3D action-adventure game built with React, TypeScript, Three.js, Vite, and Tailwind CSS. The entry point is `src/App.tsx`.

## Overview

Play as Yassine, who returns to his Algerian village after his brother Rayan disappears. Follow clues across 12 chapters spanning villages, mountains, plateaus, deserts, oases, official border crossings, and fictional North African countries before returning home for a final confrontation with the Shadow network.

### Playable Content

- **12 chapters** with 82 sequential objectives across 14 procedural regions
- **13 biomes**: village, mountain, plateau, desert, oasis, border, city, medina, port, highland, river, allies, citadel
- **20+ characters** with original dialogue in Arabic, English, and French
- **Vehicle driving** with the Asfar rover (acceleration, steering, braking, collision damage)
- **Combat** with non-lethal Azru/Sirocco tools, drone AI, pursuit sequences
- **Exploration**: walking, running, jumping, crouching, swimming, climbing, entering buildings
- **Evidence journal** with witness testimony and deduction puzzles
- **Companion system** where NPCs follow the player after story events

### Controls

| Action | Keyboard | Touch |
|--------|----------|-------|
| Move | WASD / Arrow keys | Left joystick |
| Look | Right mouse drag | Right side drag |
| Sprint | Shift | Full joystick push |
| Jump | Space | Button |
| Fire | F / Left mouse | Button |
| Interact | E | Button |
| Crouch | C | Button |
| Reload | R | Button |
| Switch tool | Q | Button |
| Brake (vehicle) | Space | Hold button |
| Map | M | Menu |
| Journal | J | Menu |
| Pause | Esc / P | Menu |

### Settings & Performance

The game includes real rendering controls (not cosmetic):

- **Resolution**: Native, 720p, 1080p, 1440p, 2160p, 4320p — validated against device capabilities
- **FPS Cap**: 30, 60, 120, Unlimited — with refresh rate detection
- **Dynamic Resolution Scaling** — maintains target FPS by adjusting render scale
- **Performance Overlay** — real-time FPS, frame time, draw calls, memory usage
- **Graphics Presets** — Low / Medium / High / Ultra with actual Three.js parameter changes
- **13 individual settings**: Texture, Shadow, Effects, Foliage, View Distance, AA, AO, Reflections, Volumetrics, Post-Processing, LOD, Particles, Water quality

### Audio

- Original procedural music generated with Web Audio API (different motifs per biome)
- Synthesized ambient sounds and effects (footsteps, gunshots, impacts, vehicle engine)
- Optional device TTS for dialogue using locally-installed voices
- Per-channel volume control: Master, Music, Effects, Environment

### Architecture

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main application, menus, pause, results, settings persistence |
| `src/game/engine.ts` | Game loop, physics, combat, AI, vehicles, cameras, save/load |
| `src/game/campaign.ts` | All 12 chapters, 14 regions, 82 objectives, 20+ characters |
| `src/game/regions.ts` | Procedural terrain, buildings, vegetation, per-biome geometry |
| `src/game/world.ts` | Shared procedural helpers (textures, targets, drones, beacons) |
| `src/game/character.ts` | Articulated character with outfit/accessory variations |
| `src/game/audio.ts` | Procedural audio engine with biome-specific music |
| `src/game/settings.ts` | Real graphics settings, device detection, validation |
| `src/game/types.ts` | TypeScript interfaces for all game state |
| `src/game/i18n.ts` | Full translations (Arabic, English, French) |
| `src/components/GameView.tsx` | Engine lifecycle, HUD, touch controls |
| `src/components/JourneyAtlas.tsx` | World map, chapter journal, evidence timeline |
| `src/components/Panels.tsx` | Settings, controls, wardrobe, armory, achievements |
| `src/components/Conversation.tsx` | Dialogue system with choices |
| `src/components/JourneyCinematic.tsx` | Region transitions and epilogue |
| `src/components/PerformanceMonitor.tsx` | FPS counter and performance overlay |

### Save System

- Automatic checkpoints after objectives, kills, and vehicle interactions
- Versioned campaign schema with migration support
- Stores region, objectives, evidence, companions, vehicle state, trail
- Settings, profile XP, scores persist in localStorage
- Graceful degradation when localStorage unavailable

### Honest Scope

This is a **playable story campaign** with real 3D gameplay, not a menu mockup. However:

- Geometry is procedurally generated boxes/shapes, not photorealistic models
- No skeletal animation (character joints are articulated groups)
- Mobile performance varies by device
- The 10K resolution option validates against actual device capabilities
- Browser TTS voices vary by platform
- Vehicle physics are arcade-style, not simulation-grade

## Development

```bash
npm install
npm run dev     # Development server
npm run build   # Production build
```

## License

All game content (characters, story, world, audio, art) is original. No copyrighted game assets are used.