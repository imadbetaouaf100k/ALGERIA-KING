# Lions of Algeria: Journey Edition

An original third-person browser adventure built with React, TypeScript, Three.js, Vite, and Tailwind CSS v4. The application entry point remains `src/App.tsx`.

## The Campaign

The former single-city training mission has been replaced by a connected **12-chapter story campaign across 14 playable regional scenes and 82 sequential objectives**. Chapter 9 visits three different fictional countries. This is a condensed procedural campaign, not a finished AAA-scale open world.

Yassine returns from the city to his Algerian village after his brother Rayan, a water engineer, disappears. Evidence about falsified water measurements leads him to the Black Shadow network. Witnesses, archives, and friends connect each destination to the next. The ending resolves Rayan's disappearance and the network's purpose rather than introducing an unrelated final boss.

| Chapter | Playable Region | Main Activities |
| --- | --- | --- |
| 1 | Taghzout village, Algeria | Meet Idris, investigate the well and farms, recover the notebook, prepare with Sami |
| 2 | Tala mountain pass | Meet Liane, cross the bridge, escape a short drone pursuit, recover the southern map |
| 3 | Steppe roadside stations | Meet Murad, drive Asfar between waypoints, examine the distribution ledger, find Sami |
| 4 | The Namar desert trail | Meet Azel, drive between dune markers, discover the erased spring inscription |
| 5 | Namar oasis at night | Meet Safiya and Nabil, crouch behind cover, recover Rayan's letter and official invitation |
| 6 | The fictional Mizan crossing | Submit a file, verify the invitation with Kamal, receive Salma's approval, pass the gate |
| 7 | Neraya, fictional Tazira | Meet Adam and Hala, translate the charter reference, search the harbor register |
| 8 | Sefra old medina, Tazira | Interview Zineb, Tarek, and Hana; connect their accounts with an evidence-board deduction |
| 9.I | Aster Harbor, fictional Ordel | Meet Mira, defend the public archive, recover the first certified copy |
| 9.II | Sarin, fictional Velora | Meet Ren, cross the archive bridge, compare and interpret the signing register |
| 9.III | Noria, fictional Ivara | Meet Ines, recover river measurements, inspect the pump records, certify the results |
| 10 | The meeting house, Tazira | Reunite with Liane, Murad, Sami, and Adam; identify the final site on a shared map |
| 11 | Taghzout after the return | See restored water and new decorations, reunite with Amina and Rayan, obtain the key |
| 12 | The old Atlas observatory | Disable relays and drones, confront Nacer, publish the complete evidence, see the epilogue |

All countries beyond Algeria and the Mizan corridor are fictional. Crossing is an official narrative process; the physical gate remains blocked until the prescribed approvals are completed. The atlas is not a real map or a guide to crossing real borders.

## Encounters and Progression

- Story characters exist in their scenes before the player interacts with them, with recognizable colors, hairstyles, scarves, roles, and name labels that become readable nearby.
- Proximity conversations and radio exchanges establish context while exploring. Full conversations have explicit next/leave controls and pause simulation and chase timers.
- Liane, Azel, Adam, Mira, and Ines accompany the player after their introductions. They follow the traveled path; appropriate companions ride along during driving sections.
- The journal records evidence only after it is obtained and characters only after they are met. It supports Arabic, English, and French.
- Three evidence-board deductions require interpreting earlier witness statements. Incorrect answers provide feedback without erasing progress.
- Progress is sequential. The map reveals regions as they are visited; it cannot be used to skip the story.
- Gold objectives provide direction and distance. The chapter itinerary tracks each objective.
- There is no campaign-wide countdown. Only the mountain pursuit has a time limit.
- Each region has optional collectible memories. These remain collected after revisiting and do not award XP twice.
- After the ending, every region is available for free travel from the atlas, without replaying missions or reactivating hostile drones.

## Controls

| Action | Keyboard / Mouse |
| --- | --- |
| Walk | WASD or arrow keys; Z also moves forward |
| Sprint | Shift |
| Jump / leave water | Space |
| Crouch | C or left Ctrl |
| Look / aim | Hold right mouse and drag |
| Use the non-lethal pulse tool | Left mouse or F |
| Speak, examine, enter/leave vehicle, climb low cover | E |
| Recharge | R |
| Switch tool | Q |
| Journey atlas / regional map | M |
| Evidence and character journal | J |
| Controls guide | H |
| Pause | Esc or P |
| Leave a conversation / close a panel | Esc |
| Advance dialogue | E, Enter, or the onscreen button |
| Choose an evidence-board answer | 1, 2, 3, or the onscreen choices |
| Drive | W/S accelerate or reverse; A/D steer; Space brakes |

On mobile, the left joystick controls walking or driving. Drag the scene to look around. The right buttons handle interaction and movement; the jump button becomes a hold-to-brake control while driving. Controls have configurable size, inset, and handedness. A full joystick push enables sprinting on foot.

## Presentation and Scope

The game retains its dark olive, brass, bilingual visual identity and full-bleed launcher. Original new key art illustrates the village, night oasis, Ordel harbor, Velora valley, and Ivara river. These images are cinematic illustrations, not screenshots of the procedural gameplay renderer.

The playable scenes use original procedural geometry: rural houses and farms, cedar paths and a bridge/cave, roadside stations, dunes, an oasis, a staffed checkpoint, whitewashed arcades, a medina, slate-roofed brick buildings, layered green mountain roofs, river stilt houses, a gathering courtyard, and a fortified observatory. The scenes are separate compact regions joined by readable cinematic transitions, not a seamless full-size world.

Asfar has responsive arcade-style acceleration, steering, friction, reverse, braking, impact damage, and a field repair interaction. It is not a simulation-grade vehicle physics system. Existing jumping, swimming, crouching, contextual low-cover climbing, aim assistance, non-lethal tools, enemies, particles, score combos, and wardrobe features remain available.

Regional synthesized musical motifs and ambient filters change with the environment. Device speech synthesis can read dialogue using a matching **locally installed** language voice. If no suitable local voice is installed, subtitles remain fully functional. Voice reading can be disabled in Audio settings; there is no bundled voice-actor audio or remote TTS service.

Regional weather is the default, with dust and rain overrides. General day/night lighting is supported; the oasis and observatory stay in their story-required night conditions until the campaign has finished.

## Saving and Recovery

The new campaign uses `loa:campaign` with schema version `2`. Original training checkpoints under `loa:checkpoint` are left untouched and are not interpreted as campaign progress. Existing equipment, settings, lifetime XP, achievements, and high scores are preserved.

Campaign saves include the region, objective index, completed objective IDs, evidence, discovered characters, visited regions, collected memories, elapsed time, enemy health, weapon cells, vehicle state, and companion/path state. A checkpoint is made after completed interactions, vehicle interactions, kills, region changes, and pauses, with periodic saves while exploring.

XP is credited when earned, not again when a run ends or reloads. Failed pursuits and defeats keep the story state and recovered evidence; retry respawns at the current region's safe entrance. Completed objectives and defeated enemies are not reset for farming duplicate rewards. A checkpoint interrupted exactly at a region exit is normalized when loaded.

Storage is local to the browser. If localStorage is unavailable, the active session remains playable but progress will not persist after closing it.

## Architecture

| File | Responsibility |
| --- | --- |
| `src/App.tsx` | Launcher, profile persistence, panels, pause, transitions, results, and free exploration |
| `src/game/campaign.ts` | Connected story definitions, localized dialogue, actors, region descriptions, epilogue, save validation, structural checks |
| `src/game/engine.ts` | Game loop, region loading/disposal, objective progression, conversations, companions, driving, combat, cameras, and saves |
| `src/game/regions.ts` | Deterministic regional architecture, terrain, collision layouts, water, official gate, and Asfar model |
| `src/game/world.ts` | Shared procedural texture and target/drone/beacon helpers; legacy city builder retained as a reusable asset |
| `src/game/character.ts` | Articulated original character with NPC appearance variations |
| `src/game/audio.ts` | Regional soundscape, vehicle engine, effects, optional local device voice reading |
| `src/game/journeyText.ts` | Localized campaign interface text |
| `src/game/i18n.ts` | Existing shared interface translations |
| `src/components/JourneyAtlas.tsx` | Progressive world atlas, regional map, chapter itinerary, evidence and character journal |
| `src/components/JourneyCinematic.tsx` | Arrival, travel, and multi-scene epilogue |
| `src/components/Conversation.tsx` | Accessible, player-paced dialogue and deduction choices |
| `src/components/GameView.tsx` | Engine lifecycle, responsive HUD, touch input, vehicle controls |
| `src/components/Panels.tsx` | Settings, controls guide, equipment, clothing, achievements, and records |
| `src/journey.css` | Journey interface and cinematic styles layered over the existing design |

To extend the story, add a `RegionDefinition` in `campaign.ts`, give each objective a unique ID, provide its NPC placements, and finish it with a travel or finish objective. The common interaction system handles talking, examining, reaching, driving, chases, combat, deductions, and travel. New visual biomes are implemented in `regions.ts`. `validateCampaign()` catches missing actors, duplicate objective IDs, broken endings, and invalid deduction answers when the game initializes.

## Verification

The production Vite build has passed. TypeScript editor diagnostics were checked during implementation. Structural campaign checks also run at game initialization. Automated browser playthroughs and physical-device frame-rate profiling have **not** been performed in this environment. The graphics settings, static batching, pooled effects, adaptive pixel ratio, resource disposal, and throttled HUD are designed for performance, but 60 fps is not guaranteed across devices.

Manual acceptance checks for a browser run:

1. Begin at Taghzout, approach Idris, advance/leave/reopen his conversation, and verify the next objective appears only after its final line.
2. Collect evidence and confirm it appears in the journal, then reload and continue without losing it or receiving duplicate XP.
3. Cross Tala's bridge, complete or fail the pursuit, and test safe checkpoint retry.
4. Drive Asfar with keyboard and touch, brake, collide, exit, repair, and resume a saved driving session.
5. Verify the Mizan gate remains closed until Kamal and Salma have approved the application.
6. Choose wrong and correct deductions; ensure wrong answers do not lose progress or bypass the question.
7. Follow the three international stops, reunite with the allies, and visit the visibly changed village.
8. Complete the final confrontation, watch or skip the epilogue, enter free exploration, and use the atlas to revisit all 14 regions.
9. Change language, audio, graphics, touch size, and touch layout; verify settings persist.