import * as THREE from 'three';

/**
 * Shared helper for text labels baked into a CanvasTexture (3D sprites).
 *
 * Canvas text is rasterised once, so it cannot react to a language switch on
 * its own. Every label created here exposes `setText()` which re-bakes the
 * canvas; callers invoke it from their language effect. A CJK-capable font
 * stack is used, and labels re-bake once web fonts have finished loading so
 * the first paint never shows tofu boxes.
 */

export const LABEL_FONT_FAMILY =
  '"Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB",monospace';

export interface LabelSpriteOptions {
  /** Canvas pixel size (texture resolution). */
  width?: number;
  height?: number;
  /** Border + text colour, CSS string. */
  color: string;
  /** Background fill, CSS string. */
  background?: string;
  /** Starting font size in px; shrinks until the text fits. */
  fontPx?: number;
  minFontPx?: number;
  borderPx?: number;
  /** World-space sprite width; height follows the canvas aspect ratio. */
  worldWidth: number;
}

export interface LabelSprite {
  sprite: THREE.Sprite;
  setText(next: string): void;
  dispose(): void;
}

export function hexToCss(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function createLabelSprite(initialText: string, opts: LabelSpriteOptions): LabelSprite {
  const width = opts.width ?? 512;
  const height = opts.height ?? 64;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(opts.worldWidth, (opts.worldWidth * height) / width, 1);

  let current = initialText;
  let disposed = false;

  function draw(): void {
    if (!ctx) return;
    const border = opts.borderPx ?? 3;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = opts.background ?? 'rgba(8, 11, 16, 0.88)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = border;
    ctx.strokeRect(border / 2, border / 2, width - border, height - border);
    ctx.fillStyle = opts.color;
    const maxTextWidth = width - 24;
    let fontPx = opts.fontPx ?? 30;
    const minPx = opts.minFontPx ?? 10;
    do {
      ctx.font = `bold ${fontPx}px ${LABEL_FONT_FAMILY}`;
      if (ctx.measureText(current).width <= maxTextWidth) break;
      fontPx -= 1;
    } while (fontPx > minPx);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(current, width / 2, height / 2);
    texture.needsUpdate = true;
  }

  draw();
  // Re-bake once fonts (incl. system CJK fallbacks) are ready.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!disposed) draw();
    });
  }

  return {
    sprite,
    setText(next: string) {
      if (next === current) return;
      current = next;
      draw();
    },
    dispose() {
      disposed = true;
      texture.dispose();
      material.dispose();
    },
  };
}
