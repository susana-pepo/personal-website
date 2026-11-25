import { describe, expect, it } from "vitest";
import { panelGeometry } from "../components/SectionPanel/panelGeometry";

// Room, lamp and scene-control boxes as measured on the live site at each size.
const at1440 = {
  room: { left: 58, top: 97, right: 1382, bottom: 794 },
  lamp: { left: 671, top: 362, right: 801, bottom: 595 },
  controls: { left: 1060, top: 30, right: 1382, bottom: 66 },
  viewport: { width: 1440, height: 900 },
  gap: 11,
};
const at1920 = {
  room: { left: 240, top: 157, right: 1680, bottom: 915 },
  lamp: { left: 907, top: 445, right: 1048, bottom: 699 },
  controls: { left: 1350, top: 80, right: 1680, bottom: 120 },
  viewport: { width: 1920, height: 1080 },
  gap: 14,
};

const left = (
  s: typeof at1440,
  g: NonNullable<ReturnType<typeof panelGeometry>>,
) => s.viewport.width - g.right - g.width;

describe("panelGeometry", () => {
  it("pops just out of the room: about 2% above and 3% below, clear of the scene controls", () => {
    for (const s of [at1440, at1920]) {
      const g = panelGeometry(s)!;
      const h = s.room.bottom - s.room.top;
      expect(s.room.top - g.top).toBeLessThanOrEqual(Math.ceil(h * 0.02));
      expect(g.top - s.controls.bottom).toBeGreaterThanOrEqual(20);
      expect(g.top + g.height - s.room.bottom).toBe(Math.round(h * 0.03));
    }
  });

  it("without controls, starts 2% of the room above it", () => {
    const g = panelGeometry({ ...at1440, controls: null })!;
    expect(g.top).toBe(Math.round(97 - 697 * 0.02));
  });

  it("reaches past the room on the right, keeping a margin from the window", () => {
    for (const s of [at1440, at1920]) {
      const g = panelGeometry(s)!;
      const outer = s.viewport.width - g.right;
      expect(outer).toBeGreaterThan(s.room.right + 30);
      expect(g.right).toBeGreaterThanOrEqual(24);
    }
  });

  it("reaches left to the lamp’s edge", () => {
    for (const s of [at1440, at1920]) {
      const g = panelGeometry(s)!;
      expect(Math.abs(left(s, g) - s.lamp.right)).toBeLessThanOrEqual(1);
      expect(g.width).toBeLessThanOrEqual(s.viewport.width * 0.5);
    }
  });

  it("is 42% of the window when there is no lamp", () => {
    const g = panelGeometry({ ...at1440, lamp: null })!;
    expect(g.width).toBe(Math.round(1440 * 0.42));
  });

  it("stays inside the window", () => {
    const g = panelGeometry({
      ...at1440,
      room: { left: 0, top: 2, right: 1440, bottom: 899 },
      controls: null,
    })!;
    expect(g.top).toBeGreaterThanOrEqual(24);
    expect(g.top + g.height).toBeLessThanOrEqual(900 - 24);
    expect(g.right).toBeGreaterThanOrEqual(24);
  });

  it("leaves tablets and phones to their own layouts", () => {
    expect(
      panelGeometry({ ...at1440, viewport: { width: 1024, height: 768 } }),
    ).toBeNull();
    expect(
      panelGeometry({
        ...at1440,
        room: { left: 0, top: 0, right: 0, bottom: 0 },
      }),
    ).toBeNull();
  });
});
