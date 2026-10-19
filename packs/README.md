# Sprite Packs

This folder contains your sprite packs. Each pack is a subfolder containing:
- `pack.json` — pack metadata
- `actions.json` — animation manifest
- PNG sprite sheets referenced by `actions.json` (any sub-folder inside the pack)
- optional `effects/` images referenced by `pack.json` (e.g. the Kamehameha beam)

## Creating a Pack

See [docs/sprite-format.md](../docs/sprite-format.md) for the exact format specification.

A template is available in [docs/pack-template/](../docs/pack-template/).

## Installing a Pack

1. Copy the pack folder to this directory
2. Open Settings → Appearance → Sprite Pack
3. Select your pack

## Local Packs in This Folder

Packs placed here (in the repository's `packs/` folder) are copied into the app's data folder on start-up. While your settings still use `"spritePack": "default"`, the most recently built pack here is used automatically. Everything in this folder except this README is git-ignored.

Two local build helpers write packs here from art you keep in `assets/goku/` (also git-ignored):

- `python scripts/build-hd-pack.py`: high-resolution poses → `packs/goku-hd/` (needs Pillow + numpy)
- `node scripts/build-sheets.js`: 64px frames → `packs/goku-classic/`

`pack.json` options: `"rendering": "pixelated"` (default, nearest-neighbour) or `"smooth"` (painted/high-res art), and `"displayScale"` (screen px per frame px).

## Importing Existing Art

Use the import tool:
```bash
npm run import-pack <source-folder> --name <pack-name>
```

## Important

**Do not commit copyrighted sprite packs to this repository.** Packs are user data and should remain private.
