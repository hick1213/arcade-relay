#!/usr/bin/env python3
"""Asset generation spec for IMG-01..30 (S-30).

Prompt = style_block (design/art-bible.json, loaded at runtime and prefixed
mechanically) + asset-specific body copied from design/assets.md.
Routes are fixed by state/asset-routing.json: image_sprite / image_background
= openai:gpt-image-2 (relay). No re-routing during generation.
"""
import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(_HERE, "..", "..", ".."))
ART_BIBLE = os.path.join(ROOT, "design", "art-bible.json")
OUT_DIR = os.path.join(ROOT, "game", "assets", "images")
PROGRESS = os.path.join(_HERE, "gen_progress.jsonl")

with open(ART_BIBLE, "r", encoding="utf-8") as fh:
    _BIBLE = json.load(fh)

STYLE_BLOCK = _BIBLE["style_block"]

# edit mode: None = /images/generations, or a repo-absolute path passed to
# /images/edits as the reference image (IMG-02/03 use IMG-01; character
# sprites share design/refs/character-ref.png per design/assets.md).
CHAR_REF = os.path.join(ROOT, "design", "refs", "character-ref.png")

ASSETS = [
    {
        "id": "IMG-01", "file": "tile-inn-hall-morning.png", "size": "1536x1024",
        "background": "opaque", "ref": None,
        "prompt": "Elevated 3/4 top-down view of the interior of a cozy Chinese wuxia inn main hall in clear morning light: wooden service counter on the upper side, staircase, raised walkway, round wooden tables with stools evenly spread over the lower two-thirds as a playable floor, wine jars along walls, red carpet runner as accent, no people, calm and tidy, large uncluttered floor area, single-screen game board composition",
    },
    {
        "id": "IMG-02", "file": "tile-inn-hall-day.png", "size": "1536x1024",
        "background": "opaque", "ref": "IMG-01",
        "prompt": "The exact same inn hall, same layout, same furniture positions, same camera angle as the reference image, but at busy midday: lanterns lit, warm bright candlelight tone, slight bustle marks (a steamer on the counter), still no people, identical playable floor area",
    },
    {
        "id": "IMG-03", "file": "tile-inn-hall-night.png", "size": "1536x1024",
        "background": "opaque", "ref": "IMG-01",
        "prompt": "The exact same inn hall, same layout and camera as the reference image, but at evening close: warm lantern glow dominating, overall one step dimmer and cozier, long soft warm shadows, windows showing dusk, still no people. Overall brightness must stay in the 0.2-0.75 luminance band so interactive sprites stay readable",
    },
    {
        "id": "IMG-04", "file": "sprite-staff-a-fu.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall young male inn waiter named A-Fu, full body standing, front 3/4 view, indigo-blue short jacket over white trousers (cool-toned clothing), a folded serving cloth over one forearm, slightly clumsy cheerful grin, big round eyes, simple rounded silhouette, one isolated character, no ground shadow",
    },
    {
        "id": "IMG-05", "file": "sprite-staff-tie-niu.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall stocky male inn cook named Tie-Niu, full body standing, front 3/4 view, slate-grey-blue apron over charcoal tunic (cool-toned clothing), thick arms, wide honest smile, small kitchen cleaver tucked in belt, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-06", "file": "sprite-staff-wen-qu.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall slender male inn accountant named Wen-Qu, full body standing, front 3/4 view, teal-green long robe (#2F433A tone, cool-toned), holding a wooden abacus, thin mustache, clever narrow eyes, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-07", "file": "sprite-staff-xiao-die.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall young female inn maid named Xiao-Die, full body standing, front 3/4 view, dusty-rose tunic with hair in two round buns, holding a small broom, shy soft smile, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-08", "file": "sprite-staff-da-song.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall broad-shouldered male inn guard named Da-Song, full body standing, front 3/4 view, charcoal-blue martial tunic with simple shoulder guard (cool-toned), wooden staff in both hands, earnest bulky frame, rounded but sturdy silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-09", "file": "sprite-staff-liu-biao-tou.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall female escort captain named Liu-Biao-Tou, full body standing, front 3/4 view, steel-blue travel outfit with muted iron bracers (cool-toned), saber sheathed on back, confident stance, calm sharp eyes, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-10", "file": "sprite-staff-su-yu-chu.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall elderly male imperial chef named Su-Yu-Chu, full body standing, front 3/4 view, aubergine-plum chef robe with white kerchief (cool-toned), holding a long-handled ladle, thin white beard, serene proud expression, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-11", "file": "sprite-guest-commoner.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall ordinary traveler guest, full body standing, front 3/4 view, plain ochre-and-tan commoner robe (warm-toned clothing only), straw hat held in hand, relaxed hungry expression, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-12", "file": "sprite-guest-escort.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall jianghu escort (bodyguard) guest, full body standing, front 3/4 view, red-brown traveler robe with vermilion sash (warm-toned clothing), saber at hip, weathered confident face, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-13", "file": "sprite-guest-gourmet.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette, bold dark ink-brown outline weight and chibi 2-heads-tall proportions), draw a DIFFERENT new character: single chibi 2-heads-tall wealthy gourmet guest, full body standing, front 3/4 view, rich burgundy-and-gold-trim merchant robe (warm-toned clothing), round belly, holding chopsticks, fussy demanding expression, rounded silhouette, isolated character, no ground shadow",
    },
    {
        "id": "IMG-14", "file": "sprite-rival-warlord.png", "size": "1024x1024",
        "background": "transparent", "ref": CHAR_REF,
        "prompt": "Using the reference image ONLY as the art-style reference (same watercolor storybook technique, palette and bold dark ink-brown outline weight), draw a DIFFERENT new character with a deliberately ANGULAR silhouette that contrasts with rounded friendly characters: single menacing jianghu rival warlord, chibi 2-heads-tall but angular and imposing, front 3/4 view, ink-black (#281D10) robe with vermilion red accents only, sharp angular silhouette, cold glare, arms crossed, isolated character, no ground shadow",
    },
    {
        "id": "IMG-15", "file": "sprite-dish-01-noodles.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of a steaming bowl of hand-pulled noodle soup, cream porcelain bowl, 3/4 top-down view, one item centered, simple readable shape at small size, isolated item",
    },
    {
        "id": "IMG-16", "file": "sprite-dish-02-buns.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of a bamboo steamer with three white steamed buns, 3/4 top-down view, one item centered, simple readable shape, isolated item",
    },
    {
        "id": "IMG-17", "file": "sprite-dish-03-chicken.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of a glazed roasted chicken on a round ceramic plate, 3/4 top-down view, one item centered, simple readable shape, isolated item",
    },
    {
        "id": "IMG-18", "file": "sprite-dish-04-tofu.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of mapo tofu in a shallow clay pot, warm red-brown sauce, 3/4 top-down view, one item centered, simple readable shape, isolated item",
    },
    {
        "id": "IMG-19", "file": "sprite-dish-05-fish.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of a whole steamed fish on an oval ceramic platter with scallion garnish, 3/4 top-down view, one item centered, simple readable shape, isolated item",
    },
    {
        "id": "IMG-20", "file": "sprite-dish-06-broth.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single small icon of an ornate golden-trimmed tureen of luxurious broth with a tiny ladle, subtly premium look, 3/4 top-down view, one item centered, simple readable shape, isolated item",
    },
    {
        "id": "IMG-21", "file": "sprite-table-round.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single round wooden inn table with 4 stools, 3/4 top-down view, warm wood tones, subtle grain, slightly worn top, no items on it, single object centered, isolated, no ground shadow",
    },
    {
        "id": "IMG-22", "file": "ui-ambition-wealth.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single icon of a muted-gold sycee ingot (Chinese yuanbao) with soft candlelight highlight, front view, one item centered, simple readable shape at small size, isolated",
    },
    {
        "id": "IMG-23", "file": "ui-ambition-xia.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single icon of a sheathed jianghu sword crossed with a small wine gourd, muted steel and teal-green accents, front view, one item centered, simple readable shape, isolated",
    },
    {
        "id": "IMG-24", "file": "ui-ambition-renown.png", "size": "1024x1024",
        "background": "transparent", "ref": None,
        "prompt": "Single icon of a rolled paper scroll with a blank label and a small vermilion seal stamp, front view, one item centered, simple readable shape, isolated",
    },
    {
        "id": "IMG-25", "file": "ui-event-card-frame.png", "size": "1024x1536",
        "background": "transparent", "ref": None,
        "prompt": "A single vertical event card frame: warm paper texture border, vermilion corner ornaments and muted-gold trim, decorated top medallion of a lantern, large empty inner area for later text, no text anywhere, transparent inside the frame, flat front view",
    },
    {
        "id": "IMG-26", "file": "tile-ending-wealth.png", "size": "1536x1024",
        "background": "opaque", "ref": None,
        "prompt": "Ending illustration, same inn hall at golden dusk overflowing with prosperity: chests, stacked silver, red lanterns doubled, chibi inn staff celebrating around the counter, warm triumphant mood, wide storybook composition",
    },
    {
        "id": "IMG-27", "file": "tile-ending-xia.png", "size": "1536x1024",
        "background": "opaque", "ref": None,
        "prompt": "Ending illustration, the chibi inn staff standing together in the inn courtyard at dawn with swords shouldered, cool teal dawn sky kept outside the palette accents, quiet heroic mood, wide storybook composition",
    },
    {
        "id": "IMG-28", "file": "tile-ending-renown.png", "size": "1536x1024",
        "background": "opaque", "ref": None,
        "prompt": "Ending illustration, the inn hall crowded with admiring guests and a red festival banner, the chibi staff proudly serving at the counter, bustling famous-teahouse mood, wide storybook composition",
    },
    {
        "id": "IMG-29", "file": "ui-title-emblem.png", "size": "1536x1024",
        "background": "transparent", "ref": None,
        "prompt": "Decorative title screen emblem for a wuxia inn management game: a lantern, the inn's tiled roof silhouette, wine jar and ink-brush flourish arranged around a large empty center area, no text anywhere, transparent background, horizontally wide composition",
    },
    {
        "id": "IMG-30", "file": "ui-common-sheet.png", "size": "1536x1024",
        "background": "transparent", "ref": None,
        "prompt": "A sprite sheet laid out on an invisible regular grid on transparent background: 2 round wooden buttons (normal and pressed states), 1 parchment panel base, 1 ledger book icon, 1 silver ingot icon, 1 scroll icon, 1 small sword-icon chip, evenly spaced with clear margins between elements, no text, flat front view of each element",
    },
]

ASSET_BY_ID = {a["id"]: a for a in ASSETS}


def full_prompt(asset):
    """Mechanically prefix the art-bible style_block."""
    return STYLE_BLOCK + " " + asset["prompt"]


def resolve_ref(ref):
    if ref is None:
        return None
    if ref in ASSET_BY_ID:
        return os.path.join(OUT_DIR, ASSET_BY_ID[ref]["file"])
    return ref
