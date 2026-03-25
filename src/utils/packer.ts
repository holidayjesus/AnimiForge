import { Rect } from '../types';

/**
 * MaxRects Bin Packing Algorithm
 * Implements the "Best Short Side Fit" (BSSF) heuristic.
 */
export class MaxRectsPacker {
  private freeRects: Rect[] = [];
  private width: number = 0;
  private height: number = 0;

  constructor(width: number, height: number) {
    this.init(width, height);
  }

  init(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.freeRects = [{ x: 0, y: 0, w: width, h: height }];
  }

  pack(w: number, h: number, padding: number): Rect | null {
    const paddedW = w + padding;
    const paddedH = h + padding;

    let bestRect: Rect | null = null;
    let bestShortSideFit = Number.MAX_VALUE;
    let bestIndex = -1;

    for (let i = 0; i < this.freeRects.length; i++) {
      const rect = this.freeRects[i];
      if (rect.w >= paddedW && rect.h >= paddedH) {
        const leftoverW = Math.abs(rect.w - paddedW);
        const leftoverH = Math.abs(rect.h - paddedH);
        const shortSideFit = Math.min(leftoverW, leftoverH);

        if (shortSideFit < bestShortSideFit) {
          bestShortSideFit = shortSideFit;
          bestRect = { x: rect.x, y: rect.y, w: paddedW, h: paddedH };
          bestIndex = i;
        }
      }
    }

    if (!bestRect || bestIndex === -1) return null;

    const splitRect = this.freeRects.splice(bestIndex, 1)[0];
    this.splitFreeRect(splitRect, bestRect);
    this.pruneFreeRects();

    return { x: bestRect.x, y: bestRect.y, w, h };
  }

  private splitFreeRect(free: Rect, used: Rect) {
    // Split vertically
    if (used.x < free.x + free.w && used.x + used.w > free.x) {
      if (used.y > free.y && used.y < free.y + free.h) {
        this.freeRects.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
      }
      if (used.y + used.h < free.y + free.h) {
        this.freeRects.push({ x: free.x, y: used.y + used.h, w: free.w, h: free.y + free.h - (used.y + used.h) });
      }
    }

    // Split horizontally
    if (used.y < free.y + free.h && used.y + used.h > free.y) {
      if (used.x > free.x && used.x < free.x + free.w) {
        this.freeRects.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
      }
      if (used.x + used.w < free.x + free.w) {
        this.freeRects.push({ x: used.x + used.w, y: free.y, w: free.x + free.w - (used.x + used.w), h: free.h });
      }
    }
  }

  private pruneFreeRects() {
    for (let i = 0; i < this.freeRects.length; i++) {
      for (let j = i + 1; j < this.freeRects.length; j++) {
        if (this.isContained(this.freeRects[i], this.freeRects[j])) {
          this.freeRects.splice(i, 1);
          i--;
          break;
        }
        if (this.isContained(this.freeRects[j], this.freeRects[i])) {
          this.freeRects.splice(j, 1);
          j--;
        }
      }
    }
  }

  private isContained(a: Rect, b: Rect): boolean {
    return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  }
}
