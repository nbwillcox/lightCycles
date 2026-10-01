# LightCycles

A free, retro-flavored light-cycle arena game with neon graphics. Steer on a snappy grid, leave a permanent wall of light behind you, and cut off rival cycles until the last one standing is you. Campaign rounds, an endless survival mode, power-ups, discs and a rare super-weapon.

**Play it in your browser:** https://nbwillcox.github.io/lightCycles/

Everything is generated in code: the arena, cycles and effects are drawn on the fly, and all sound effects and music are synthesized with the Web Audio API. There are no image or audio files and no build step. A sibling of [SpaceGalaShooter](https://github.com/nbwillcox/SpaceGalaShooter), [SpaceCentiShooter](https://github.com/nbwillcox/SpaceCentiShooter), [SpaceVaderShooter](https://github.com/nbwillcox/SpaceVaderShooter), [SpaceStroids](https://github.com/nbwillcox/SpaceStroids) and [SpaceCommand](https://github.com/nbwillcox/SpaceCommand), with the same look and feel.

## Controls

| Action | Keys |
| --- | --- |
| Steer | `W` `A` `S` `D` or the arrow keys. Turns are buffered, so a quick double-tap makes a tight U-turn on the next grid tick. You can't reverse into yourself. |
| Boost (hold) | `Shift`: a short sprint that drains the energy meter |
| Throw a disc | `Space` |
| Fire the T-wall | `E` or `Enter` |
| Pause | `P` or `Esc` |

## Gameplay

- Cycles move one grid cell per tick on a 64x34 arena. Every cycle lays down a solid wall of light that stays until the cycle is derezzed; hit any wall, obstacle, or the arena edge and you derez.
- **Campaign:** clear rounds against rival cycles. Round difficulty, rival count and cycle speed climb; every 5th round is a single **Elite** duel against a faster, smarter cycle with the full toolkit. You have 3 lives.
- **Survival:** one life, no rounds. A growing swarm of rivals keeps arriving, and every trail is a finite length that grows when you collect energy cells, so the arena stays playable. Score by time and derezzes.
- **Rivals have personalities:** the Cutter cuts you off, the Hoarder plays it safe and fills space, the Tracker shadows your wall, and the Gambler takes risks. They use boost, pickups, discs and T-walls.
- **Arenas:** open grids, scattered blocks, pillars and mazes; some have **portal edges** where you reappear on the opposite side, and some have **sweeping laser gates** with a safe gap to slip through. Five color themes.
- **Pickups:** energy cells (boost refill), shield (survive one collision), discs (a thrown disc cuts through walls and derezzes any cycle it hits), ghost (pass through walls for 3 seconds), overdrive (free boost), and the rare **T-wall**: a bar thrown across your heading that slices through every rival wall it meets and leaves a wall of your own.
- Local top-10 high scores with arcade-style 3-letter initials (stored in your browser).

## Run locally

It is plain HTML/CSS/JS. Either open `index.html` directly, or serve the folder:

```bash
python -m http.server 8000
```

then visit http://localhost:8000. Desktop browsers with a keyboard only.

## License and attribution

Licensed under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/): free to play, share and remix **non-commercially**, as long as you give credit and **link back to this repository**: https://github.com/nbwillcox/lightCycles

This is an original game inspired by classic light-cycle arcade games. It uses no assets, names or code from any existing game and is not affiliated with any film or studio.
