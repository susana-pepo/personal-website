Scene assets (from cozy_rainy_website_claude_code_handoff.zip, copied byte-for-byte; SHA-256 in that package's checksums.sha256.json).

public/media/scene/
  room.webp              the static room (1672x941, empty: no person, chair or desk objects). Drawn slightly
                         zoomed (scene-layout.json "media.frame") so it lines up with the original composition.
  desk-books.webp        transparent: the two books by the lamp (1536x1024)
  camera.webp            transparent: the camera on the third shelf (1254x1254)
  books.webp             transparent, 740x355
  laptop.webp            transparent, 980x686

Built later from the raw exports (not part of that package): the cat's, the woman's and the coffee's
animated clips and stills (cat/, woman/, coffee/), the record player in parts (vinyl/), the lamp
(lamp.webp), the vase (vase.webp), the piano (piano/), the plant (plant/), the glows (glow/), the
window's glass layers (window/) and the views through it (window-views/). How each was made is in the "$comment" entries of
src/scene/scene-layout.json and src/scene/window-views.json, and in the scripts/build-*.py files.

Positions on the 1920x1080 canvas live in src/scene/scene-layout.json (tune them with ?sandbox=1).
The animated room (Woman_breathing_and_coffee_vapor_376e9ddf.mp4) can be brought back by setting media.video;
its file is in Downloads, not in the project.

