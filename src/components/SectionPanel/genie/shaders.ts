/**
 * The genie's GPU half. The vertex shader is geometry.ts's sliceAt() per vertex of a dense mesh
 * laid over the slab's texture; the fragment shader lights it: the lamp-side glint as the slab
 * arrives under the bulb, a warm light carried in transit, a lighter, thinner neck near the object,
 * and one faint sweep of lamp light across the slab as it lands.
 */

export const VERTEX = `#version 300 es
precision highp float;
in vec2 aUV;              // over the padded texture, 0..1 (top-left origin)
uniform vec2 uView;       // viewport, CSS px
uniform vec4 uPadN;       // texture margin left, top, right, bottom, as shares of the slab's size
uniform vec4 uNeck;       // travel frame: a0, a1 (along the travel), c0, c1 (across)
uniform vec4 uDock;
uniform int uAxis;        // 0: pours right, 1: rises, 2: falls
uniform int uShape;       // 0: the opening's curve, 1: the close's (accelerating into the object)
uniform float uT;         // 0 = all in the object, 1 = home
uniform float uLag;
uniform vec4 uE;          // cubic-bezier of each slice's travel
uniform float uFlare;
out vec2 vUV;
out vec2 vPN;             // the slab's own coordinates, 0..1 inside it
out float vS;             // how far this slice has travelled
float b1(float p1, float p2, float t) { float u = 1. - t; return 3.*p1*u*u*t + 3.*p2*u*t*t + t*t*t; }
float bez(float x) {
  if (x <= 0.) return 0.;
  if (x >= 1.) return 1.;
  float t = x;
  for (int i = 0; i < 8; i++) {
    float u = 1. - t;
    float dx = b1(uE.x, uE.z, t) - x;
    float d = 3.*uE.x*u*u + 6.*(uE.z - uE.x)*u*t + 3.*(1. - uE.z)*t*t;
    if (abs(d) < 1e-5) break;
    t = clamp(t - dx / d, 0., 1.);
  }
  return b1(uE.y, uE.w, t);
}
void main() {
  vec2 pn = aUV * (1. + uPadN.xy + uPadN.zw) - uPadN.xy;
  float k, cn;
  if (uAxis == 0) { k = pn.x; cn = pn.y; }
  else if (uAxis == 1) { k = 1. - pn.y; cn = pn.x; }
  else { k = pn.y; cn = pn.x; }
  float tau = clamp((uT - (1. - clamp(k, 0., 1.)) * uLag) / (1. - uLag), 0., 1.);
  float s = uShape == 0 ? bez(tau) : 1. - bez(1. - tau);
  float a = mix(mix(uNeck.x, uNeck.y, k), mix(uDock.x, uDock.y, k), s);
  float w = smoothstep(0., uFlare, s);
  float c = mix(mix(uNeck.z, uDock.z, w), mix(uNeck.w, uDock.w, w), cn);
  vec2 p = uAxis == 0 ? vec2(a, c) : (uAxis == 1 ? vec2(c, -a) : vec2(c, a));
  gl_Position = vec4(p.x / uView.x * 2. - 1., 1. - p.y / uView.y * 2., 0., 1.);
  vUV = aUV;
  vPN = pn;
  vS = s;
}`

export const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vPN;
in float vS;
uniform int uPass;          // 0: the shadow on the room, 1: the slab
uniform sampler2D uTex;     // premultiplied
uniform sampler2D uGlintTex;
uniform vec4 uGlintBox;     // where the glint's crop sits, in the texture's UV (x0, y0, x1, y1)
uniform float uGlint;
uniform float uShadow;
uniform vec3 uWarm;
uniform float uWarmK;
uniform float uFadeIn;
uniform float uNeckAlpha;   // how see-through the neck is near the object
uniform float uNeckLight;   // how much lighter (thinner glass, lamp-warm) the neck is
uniform vec2 uSize;         // the slab, CSS px
uniform vec2 uLamp;         // the bulb on the slab, shares of its box
uniform float uSweep;       // 0..1 while the lamp's light crosses the slab, else -1
uniform float uSweepK;
uniform vec3 uSweepColor;
out vec4 o;
void main() {
  // Each slice comes out of the object faint and thin, and is whole well before it lands.
  float body = smoothstep(0., uFadeIn, vS) * mix(uNeckAlpha, 1., smoothstep(.2, .8, vS));
  if (uPass == 0) {
    o = texture(uTex, vUV) * (uShadow * body);
    return;
  }
  vec4 c = texture(uTex, vUV);
  if (uGlint > 0. && vUV.x >= uGlintBox.x && vUV.x <= uGlintBox.z && vUV.y >= uGlintBox.y && vUV.y <= uGlintBox.w) {
    c += texture(uGlintTex, (vUV - uGlintBox.xy) / (uGlintBox.zw - uGlintBox.xy)) * uGlint;
  }
  // The neck: thinner glass near the object lets the lamp's warmth through, never a dark wedge.
  float neck = 1. - smoothstep(0., .6, vS);
  c.rgb = mix(c.rgb, uWarm * .42 * c.a, uNeckLight * neck);
  // The lamp's light carried while travelling: strongest mid-way, gone once home.
  c.rgb += uWarm * (uWarmK * (1. - vS) * smoothstep(0., .3, vS)) * c.a;
  // Landing: the lamp's light slides once across the slab from its lamp edge, slanted, faint.
  if (uSweep >= 0.) {
    vec2 px = vPN * uSize;
    float x = px.x + (px.y - uLamp.y * uSize.y) * .2;
    float centre = mix(-.18, 1.12, uSweep) * uSize.x;
    float band = exp(-pow((x - centre) / (uSize.x * .1), 2.));
    float fade = sin(3.14159265 * uSweep) * mix(1., .35, clamp(vPN.x, 0., 1.));
    float inside = step(0., vPN.x) * step(vPN.x, 1.) * step(0., vPN.y) * step(vPN.y, 1.);
    c.rgb += uSweepColor * (uSweepK * band * fade * inside) * c.a;
  }
  o = c * body;
}`
