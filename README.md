# ECHO//FALL

A playable browser chapter of a 2D action-platformer about decisions, memory, and the selves left behind. Built with plain JavaScript and Canvas, with locally rendered Blender sprites. No installation or build step is needed to play; the art is included.

## Play

Open `index.html` in a desktop browser, or run:

```sh
npm start
```

Then visit **http://127.0.0.1:4173**. The server only listens on your computer.

In Windows PowerShell, use `npm.cmd start` (and `npm.cmd test`) if the PowerShell execution policy blocks `npm.ps1`. You can also run `node server.js` directly.

| Action | Keys |
|---|---|
| Move | A / D or left / right arrows |
| Aim blade up / down | W / S or up / down arrows |
| Jump / wall jump | Space; hold for more height |
| Drop through a platform | S + Space |
| Three-hit attack chain | Tap J / X |
| Charged cut | Hold J / X, then release |
| Rising cut / aerial pogo | W + J / airborne S + J |
| Dash / air dash | K / Shift |
| Deflect / charged counter | Tap F / hold F and release at impact |
| Imprint / detonate | Q, then Q again |
| Mend | Hold H while grounded; costs one Resonance |
| Active memory | L / C |
| Interact / rest | E |
| Map | M |
| Pause / controls | Escape |
| End the current run | R, then confirm |

## The playable chapter

- Explore twelve interconnected rooms across the Wake, the Cradle, the Last Garden, and the Choir, with climbing shafts, a pogo route, loops, secret caches, and shortcuts opened from their far side.
- Make decisions involving a wounded creature, a forbidden door, a keeper, and abandoned versions of yourself.
- When you die, choose **one decision** to preserve. Undecided runs leave the will to return.
- Keep at most **five memories**, and equip one combat identity before a run or beside a signal anchor.
- Remembered decisions change future worlds. Forgetting removes their influence when the next run is constructed.
- Mercy has a delayed consequence: the creature returns after three loop transfers.
- Defeat the King by breaking his prediction with aerial strikes, dash follow-ups, charged cuts, and deflects. Cash out accumulated strain with an imprint.
- The Mother brings past selves into combat. The Child can only be persuaded.
- Reach three main endings, or discover a fourth through remembered care and respect for Echoes.
- Memories, loop count, abandoned bodies, and discovered endings save in browser local storage. An unfinished run does not resume after reloading.

This is a vertical slice: procedural levels, a full campaign, gamepad controls, and a broader Echo personality simulation are future work. The Wanderer has 32 Blender poses for idle, running, jumping, attacks, and guarding. Sentinels, lancers, drones, the King, and the Mother have separate Blender models and eight poses each. Enemies use readable fixed patterns; the preserved decisions and their consequences are authored rather than generated. Sound is optional and synthesized locally. Web fonts are decorative; system fonts work offline.

### Prototype 04 polish

- Fixed 120 Hz simulation with interpolated character motion, independent of display refresh rate.
- Buffered follow-up attacks, deflects, and dashes; attacks animate through their actual recovery time.
- Cyclic running in-betweens, eight attack poses, dedicated guard poses, landing compression, dash afterimages, tapered blade arcs, and impact sparks.
- Five detailed enemy and boss models with armor, masks, weapons, moving limbs, and readable attack anticipation.
- Subpixel camera movement, high DPI rendering, layered cathedral scenery, light shafts, and stonework. Removed the full-screen scanline overlay.
- Corrected the Wanderer export anchor so its feet meet the floor.

## Combat and traversal

White telegraphs can be deflected with a short **F** tap at impact. A perfect deflect grants Resonance and leaves strain in the attacker. A late block fractures your integrity: that deferred damage is applied on the next hit. A clean deflect clears the fracture.

Red telegraphs require an evasive jump or a **charged F release**. Hold for roughly half a second, then release just before impact. Ordinary dash invulnerability does not stop red attacks. Airborne deflects can face either direction and restore aerial movement. Deflected projectiles return toward their shooter.

**Q** spends one to three Resonance to imprint a nearby enemy. Press Q again to detonate its stored strain, or let the imprint mature for two seconds for a stronger blast. Hold **H** while stationary on the ground to exchange one Resonance for one integrity; getting hit interrupts it.

Movement supports acceleration, buffered jumps, coyote time, variable jump height, wall slides and wall jumps, one air dash, downward-strike bounces, and a memory-specific double jump. Landing, wall jumping, pogoing, and aerial deflecting refresh your aerial options. Dash cancels attack recovery. Spike falls cost integrity and return you to safe footing; a fatal hit still triggers the memory extraction loop.

The map is available with **M**. Enemy defeats, opened shortcuts, and boss victories persist when you backtrack during a run. A transfer rebuilds that run. Signal anchors heal and let you change the active memory. The breathing passage between the Archive and Lungs exists only while DEFIANCE is remembered.

The reference direction comes from [Nine Sols' close-range deflection combat](https://shop.redcandlegames.com/projects/ninesols) and [Hollow Knight's interconnected exploration](https://www.hollowknight.com/). ECHO//FALL uses its own world, characters, geometry, visuals, and memory-based progression.

## Blender models

`models/echo-fall.blend` contains the animated Wanderer, a modular ruin kit, the original blockout, and a new **06 MAP / interconnected world** scene with all twelve rooms. The game uses the rendered sprite atlas, architectural sprites, and exported collision geometry. See [the Blender workflow](models/README.md) for editing and export instructions. `assets/asset-preview.png` shows the character poses and ruin kit; `assets/map-preview.png` shows the room blockouts.

## Validate

```sh
npm test
npm run check
```

The tests exercise movement, a complete shaft climb, solid collisions, directional combat, deflect timing, charged counters, projectile returns, imprints, healing, room transitions, memory persistence, boss rules, endings, map connectivity, and sprite bounds. They use a minimal DOM/Canvas harness; hands-on browser playtesting remains a separate step.

For offline visual review, run `npm install` then `npm run review`. This uses the development-only `@napi-rs/canvas` renderer to execute the game's drawing commands and save five scenes in `art-review/`. It does not require a browser and does not replace hands-on playtesting. Playing the game still requires no package installation.

## Files

- `game.js`: gameplay, persistent memory model, narrative encounters, rendering, audio.
- `data/world.json` and `world-data.js`: authored room network and its browser bundle.
- `style.css`: interface and responsive layout.
- `index.html`: application shell.
- `server.js`: optional dependency-free local server.
- `models/echo-fall.blend`: editable character, ruins, and map scenes.
- `tools/`: Blender generation/export and a dependency-free PNG atlas packer.
- `assets/`: bundled sprites, manifest, and visual previews.

Save data belongs to the browser and origin used to play. Opening the file directly and using the local server create separate archives. Remove the `echo-fall-v1` local storage entry to start over completely.
