# Credits

## Default Sprites

The default character in `assets/goku/placeholder/` is an original martial artist drawn entirely by code in `scripts/generate-placeholder-sprites.ts` (`npm run generate-sprites`). It is not based on any existing artwork or character. Released under the project's MIT license.

The same script draws the default Kamehameha beam (`placeholder/beam.png`).

## Tray Icon

`src/main/tray-icon.ts` contains an original generated icon (orange badge with an energy orb).

## Audio

All sound effects are synthesised at runtime with the Web Audio API in `src/renderer/pet/sound-fx.ts`. No audio files are included. Any audio added later must be original or CC0/permissively licensed, with its license recorded here.

## Not Included

Sprite packs you build or install locally (`packs/`, `assets/goku/sprites/`, `assets/goku/sheets/`) are git-ignored and are never part of this repository or its installers.

## Third-Party Libraries

See [THIRD_PARTY_LICENSES.md](../THIRD_PARTY_LICENSES.md).
