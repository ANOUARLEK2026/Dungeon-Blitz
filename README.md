# Dungeon Blitz — V1.3

V1.2 is a full polish pass over V1.1. It keeps the existing roguelite systems and adds a stronger pixel-art presentation, distinct boss identities, weapon-specific combat feedback, richer room decoration, improved map presentation, achievements/rewards, fullscreen support, responsive scaling, stronger audio identity, and additional runtime safety limits.

## Controls
- WASD / Arrow Keys: move
- Mouse: aim + shoot
- Shift / Space: dash
- E: interact
- 1 / 2 / 3: consumables
- Q / R: weapon cycle
- I: inventory
- M: map
- Esc: pause
- Enter: start from main menu
- Fullscreen: main menu or HUD button

## V1.2 highlights
- Custom procedural pixel-art sprites for player, enemies and bosses
- Boss-specific silhouettes, telegraphs and phase visuals
- Weapon-specific muzzle flashes, projectile trails, impacts and audio
- Stronger crit/death/explosion feedback
- Room identity decoration for combat, elite, trap, shrine, treasure and boss rooms
- Improved world-map presentation
- Achievement system with permanent coin rewards
- Fullscreen and responsive screen scaling
- Missing external art references removed; the build is self-contained
- Particle and transient-object caps for long-session stability
- V1.1 systems retained: branching routes, relics, events, bosses, meta unlocks, saves and recovery mode

Open `index.html` in a modern Chromium/Edge/Firefox browser. No external libraries are required.

## V1.3 — fixes & additions
**Fixed**
- Shop "BUY" buttons triggered reward-card logic instead of buying
- Shops, chests, altars and the start room wrongly fired "ROOM CLEARED" rewards
- Revisited cleared rooms re-spawned enemies and trapped the player
- Traps/gauntlet state leaked into later rooms; traps hit every frame
- Bombs didn't count kills/drops, split Splitters, or hurt bosses
- Difficulty and room counter were tied to room ID, now to run progress
- Relics, run progress and the polish HUD (depth/threat bar, boost tray) now save/load and reset correctly
- Route and Achievements screens no longer let the game run underneath them
- Duplicate frame render during hit-stop; Perfect Clear / Master of Steel / early achievements could never unlock
- Relics that did nothing now work: Thorn Armor, Combo Drive, Momentum, Crit Master, Adrenaline; Vault Key and Legendary Hunter now have effects

**Added**
- Weapon ownership: start with Blaster (+ licensed weapons), buy the rest from Mira; Q/R cycles owned weapons
- Invulnerability frames after hits and during dashes
- On-canvas [E] prompts, consumable counts in the HUD, compass directions on route cards
- Map reveals adjacent rooms as "?" ; all adjacent routes selectable (incl. safe backtracking)
- Space to dash, auto-pause on focus loss, working Color Assist outlines

## V1.4 — visual overhaul
- New animated Warden (walk cycle, flowing cape, glowing visor/core) and six distinct hand-built weapon models with unique muzzle flashes, casings and projectiles
- Redesigned enemies per type (horned brute, blade runner, lens gunner, shield tank, floating mage, jelly splitter), spawn-in and elite crowns
- Cached biome floors (5 palettes by depth + boss), runic arena circles, stone back wall with arches/banners/torches, bricked obstacles with glowing runes
- Dynamic lighting (player light, torches, projectiles, boss), light shafts, vignette, low-HP pulse
- New particle engine: sparks, tumbling shards, smoke, embers, fireflies/dust motes, shockwave rings, dash afterimages, persistent floor decals
- Adaptive mood system: calm rooms get warm light, fireflies and soft pentatonic pads; combat/boss/low HP/high combo get darker red grading, embers and a driving bass-and-arpeggio score
