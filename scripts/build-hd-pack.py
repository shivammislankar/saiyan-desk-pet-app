"""
Build the local "goku-hd" sprite pack from full-size pose images.

    python scripts/build-hd-pack.py            (needs Pillow + numpy)

Input:  assets/goku/sheets/{Standing,Punch_01..04,Kick_01..03}.png
        (case-insensitive file names)
Output: packs/goku-hd/{pack.json, actions.json, sheets/*.png}

packs/ is git-ignored (see SPEC section 3): this art stays on your machine.
The app copies packs/<id>/ into its data folder on start-up and uses it.

Per image: drop the faint near-transparent haze, remove small stray
fragments, crop, then scale ALL poses by one shared factor (so he never
changes size between frames), line the feet up on a common baseline and
centre the body in a FRAME x FRAME cell.
"""

import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC_DIR = os.path.join(ROOT, "assets", "goku", "sheets")
OUT_DIR = os.path.join(ROOT, "packs", "goku-hd")

FRAME = 256          # output frame size (px)
MARGIN = 4           # empty border inside each frame
ALPHA_CUTOFF = 96    # alpha below this is haze, not art
MIN_PART = 0.02      # drop fragments smaller than 2% of the main figure

# Kamehameha: 4 charge frames + 1 fire frame (body + beam in one image).
# These come from a source drawn at a different scale, so they get their own
# scale factor, matched to the standing pose (KAME_HEIGHT_RATIO).
KAME_POSES = ["KAMEHAMEHA_01", "KAMEHAMEHA_02", "KAMEHAMEHA_03", "KAMEHAMEHA_04", "KAMEHAMEHA_05"]
KAME_HEIGHT_RATIO = 0.85   # crouched stance vs standing height
# In KAMEHAMEHA_05 (source px): the beam is everything right of BEAM_X and
# above BEAM_MAX_Y (his legs continue below it), plus everything right of
# LEGS_MAX_X (past his legs, all of it is beam glow). It is cut out and drawn
# in a separate overlay window so it can extend past the pet window.
BEAM_X = 114
BEAM_MAX_Y = 215
LEGS_MAX_X = 122

POSES = ["Standing", "Punch_01", "Punch_02", "Punch_03", "Punch_04", "Kick_01", "Kick_02", "Kick_03"]

# sheet file -> poses (in frame order)
SHEETS = {
    "idle.png": ["Standing"],
    "punch_1.png": ["Punch_01"],
    "punch_2.png": ["Punch_02"],
    "punch_3.png": ["Punch_03"],
    "uppercut.png": ["Punch_04"],
    "kick_1.png": ["Kick_01"],
    "kick_2.png": ["Kick_02", "Kick_03"],
    # Keyboard strikes (src/services/input-service.ts): any key -> random frame,
    # Backspace -> 0, Enter -> 2-3 (uppercuts), Space -> 5-7 (kicks).
    "kamehameha_charge.png": ["KAMEHAMEHA_01", "KAMEHAMEHA_02", "KAMEHAMEHA_03", "KAMEHAMEHA_04"],
    "kamehameha_fire.png": ["KAMEHAMEHA_05"],
    "strikes.png": ["Punch_01", "Punch_02", "Punch_03", "Punch_04",
                    "Kick_01", "Kick_01", "Kick_02", "Kick_03"],
}

# action -> (sheet, fps, loop). Actions without their own art use the
# standing pose so every required action exists.
ACTIONS = {
    "strikes": ("strikes.png", 12, False),
    "punch_1": ("punch_1.png", 12, False),
    "punch_2": ("punch_2.png", 12, False),
    "punch_3": ("punch_3.png", 12, False),
    "uppercut": ("uppercut.png", 12, False),
    "kick_1": ("kick_1.png", 12, False),
    "kick_2": ("kick_2.png", 12, False),
    "kamehameha_charge": ("kamehameha_charge.png", 4, False),
    "kamehameha_fire": ("kamehameha_fire.png", 4, False),
}
STANDING_ONLY = [
    "idle", "fly", "hover", "nimbus_ride", "block",
    "kaioken", "laugh", "scroll_unroll", "peek", "stretch", "drink", "thinking", "done",
    "drag", "sleep", "working", "confused", "eat", "train", "scratch_head", "yawn",
    "stomach_growl", "look_around", "spar",
]
LOOPING = {"idle", "fly", "hover", "nimbus_ride", "thinking", "working", "drag", "sleep", "train", "kaioken"}


def find_source(name):
    wanted = name.lower() + ".png"
    for f in os.listdir(SRC_DIR):
        if f.lower() == wanted:
            return os.path.join(SRC_DIR, f)
    sys.exit(f"Missing source image: {name}.png in {SRC_DIR}")


def components(mask):
    """Label 8-connected components of a boolean mask. Returns (labels, sizes)."""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    sizes = [0]
    current = 0
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if labels[y0, x0]:
            continue
        current += 1
        size = 0
        q = deque([(y0, x0)])
        labels[y0, x0] = current
        while q:
            y, x = q.popleft()
            size += 1
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        q.append((ny, nx))
        sizes.append(size)
    return labels, sizes


def clean(path, array=None, feet_centre=False):
    """
    Return (cropped RGBA image, x of the body centre within the crop,
    (left, top) offset of the crop in the source).
    feet_centre: centre on the feet instead of the whole figure (for poses
    where hands/energy extend far to one side).
    """
    a = array.copy() if array is not None else np.array(Image.open(path).convert("RGBA"))
    a[a[:, :, 3] < ALPHA_CUTOFF] = 0

    labels, sizes = components(a[:, :, 3] > 0)
    if len(sizes) <= 1:
        sys.exit(f"{path}: no visible pixels")
    main = int(np.argmax(sizes))
    h, w = labels.shape
    # Pieces touching the image edge are parts of a neighbouring pose that was
    # cut off when the image was cropped; free-floating pieces (swoosh/impact
    # effects) are part of this pose and are kept.
    edge = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])))
    keep = {
        i for i, s in enumerate(sizes)
        if i == main or (i and s >= sizes[main] * MIN_PART and i not in edge)
    }
    a[~np.isin(labels, list(keep))] = 0

    ys, xs = np.nonzero(a[:, :, 3])
    top, bottom, left, right = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[top:bottom, left:right]

    # Body centre: mean x of the main figure's opaque pixels, which ignores
    # detached swoosh effects and stays stable between poses.
    body = labels[top:bottom, left:right] == main
    if feet_centre:
        rows = body.shape[0]
        body = body.copy()
        body[: int(rows * 0.85)] = False
    centre_x = float(np.nonzero(body)[1].mean())
    return Image.fromarray(a), centre_x, (int(left), int(top))


def place(im, cx, scale):
    """Scale a cleaned pose and drop it into a FRAME cell, feet on the baseline.
    Returns (cell, (x, y) where the scaled crop's top-left landed)."""
    w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    # Resample with premultiplied alpha so edges don't pick up dark fringes.
    small = im.convert("RGBa").resize((w, h), Image.LANCZOS).convert("RGBA")
    x = round(FRAME / 2 - cx * scale)
    x = min(max(x, MARGIN), FRAME - MARGIN - w)  # keep the whole pose in frame
    y = FRAME - MARGIN - h
    cell = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    cell.paste(small, (x, y), small)
    return cell, (x, y)


def build_kamehameha(standing_height):
    """Charge/fire frames scaled to match the standing pose, plus the beam."""
    raw = {n: np.array(Image.open(find_source(n)).convert("RGBA")) for n in KAME_POSES}

    # Split the fire frame into body and beam.
    fire = raw["KAMEHAMEHA_05"]
    beam_mask = np.zeros(fire.shape[:2], dtype=bool)
    beam_mask[:BEAM_MAX_Y + 1, BEAM_X:] = True
    beam_mask[:, LEGS_MAX_X:] = True
    body_arr = fire.copy()
    body_arr[beam_mask] = 0
    beam_arr = fire.copy()
    beam_arr[~beam_mask] = 0
    raw["KAMEHAMEHA_05"] = body_arr

    cleaned = {n: clean(n, array=a, feet_centre=True) for n, a in raw.items()}
    ref = float(np.median([cleaned[n][0].height for n in KAME_POSES[:4]]))
    usable = FRAME - 2 * MARGIN
    k = KAME_HEIGHT_RATIO * standing_height / ref
    k = min([k] + [min(usable / im.height, usable / im.width) for im, _, _ in cleaned.values()])

    frames = {}
    for n, (im, cx, (left, top)) in cleaned.items():
        cell, (px, py) = place(im, cx, k)
        frames[n] = cell
        if n == "KAMEHAMEHA_05":
            # Beam axis: middle of the beam's rows where it leaves the hands.
            ys = np.nonzero(beam_arr[:, BEAM_X:BEAM_X + 12, 3] >= ALPHA_CUTOFF)[0]
            axis_y = float(ys.mean()) if len(ys) else (BEAM_MAX_Y / 2)
            hand = (round(px + (BEAM_X - left) * k), round(py + (axis_y - top) * k))

    beam_arr[beam_arr[:, :, 3] < ALPHA_CUTOFF] = 0
    labels, sizes = components(beam_arr[:, :, 3] > 0)
    big = [i for i, sz in enumerate(sizes) if i and sz >= max(sizes) * MIN_PART]
    beam_arr[~np.isin(labels, big)] = 0  # drop stray specks
    ys, xs = np.nonzero(beam_arr[:, :, 3])
    bt, bb, bl, br = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    beam = Image.fromarray(beam_arr[bt:bb, bl:br])
    bw, bh = round(beam.width * k), round(beam.height * k)
    beam = beam.convert("RGBa").resize((bw, bh), Image.LANCZOS).convert("RGBA")
    effect = {
        "image": "effects/kamehameha_beam.png",
        # Where the beam attaches (its hand end, on its axis), in beam-image px.
        "originX": round((BEAM_X - bl) * k),
        "originY": round((axis_y - bt) * k),
        # Hand position inside the kamehameha_fire frame, in frame px.
        "handX": hand[0],
        "handY": hand[1],
    }
    return frames, beam, effect, k


def main():
    poses = {name: clean(find_source(name)) for name in POSES}

    # One shared scale so the character keeps the same size in every pose.
    usable = FRAME - 2 * MARGIN
    scale = min(min(usable / im.height, usable / im.width) for im, _, _ in poses.values())

    frames = {}
    for name, (im, cx, _) in poses.items():
        frames[name], _ = place(im, cx, scale)

    kame_frames, beam, beam_effect, kame_scale = build_kamehameha(poses["Standing"][0].height * scale)
    frames.update(kame_frames)
    effects_dir = os.path.join(OUT_DIR, "effects")
    os.makedirs(effects_dir, exist_ok=True)
    beam.save(os.path.join(effects_dir, "kamehameha_beam.png"), optimize=True)
    print(f"Built effects/kamehameha_beam.png ({beam.width}x{beam.height}), Kamehameha scale {kame_scale:.3f}")

    sheet_dir = os.path.join(OUT_DIR, "sheets")
    os.makedirs(sheet_dir, exist_ok=True)
    counts = {}
    for file, names in SHEETS.items():
        sheet = Image.new("RGBA", (FRAME * len(names), FRAME), (0, 0, 0, 0))
        for i, n in enumerate(names):
            sheet.paste(frames[n], (i * FRAME, 0))
        sheet.save(os.path.join(sheet_dir, file), optimize=True)
        counts[file] = len(names)
        print(f"Built sheets/{file} ({len(names)} x {FRAME}x{FRAME})")

    def action(sheet, fps, loop):
        n = counts[sheet]
        return {
            "sheet": f"sheets/{sheet}",
            "frameWidth": FRAME,
            "frameHeight": FRAME,
            "frameCount": n,
            "framesPerRow": n,
            "fps": fps,
            "anchorX": FRAME // 2,
            "anchorY": FRAME // 2,
            "loop": loop,
            "frameEvents": {},
            "flip": False,
        }

    actions = {name: action(*spec) for name, spec in ACTIONS.items()}
    for name in STANDING_ONLY:
        actions[name] = action("idle.png", 6, name in LOOPING)

    with open(os.path.join(OUT_DIR, "actions.json"), "w") as f:
        json.dump({"actions": actions}, f, indent=2)
        f.write("\n")
    with open(os.path.join(OUT_DIR, "pack.json"), "w") as f:
        json.dump({
            "name": "Goku HD (local)",
            "author": "local",
            "version": "1.0.0",
            "license": "Personal use only. Not for redistribution.",
            "facing": "right",
            # Painted/high-res art: draw 1 frame px per screen px, smoothed.
            "rendering": "smooth",
            "displayScale": 1,
            "effects": {"kamehameha": beam_effect},
        }, f, indent=2)
        f.write("\n")
    print(f"Wrote pack to {os.path.relpath(OUT_DIR, ROOT)} (shared scale {scale:.3f})")


if __name__ == "__main__":
    main()
