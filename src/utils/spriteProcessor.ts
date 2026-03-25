// src/utils/spriteProcessor.ts

import type { Rect, Sprite } from '../types';

/**
 * Loads an image file into an HTMLImageElement
 * @param file - The image file to load
 * @throws Error if file reading or image loading fails
 */
export async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error(`Failed to read file: ${file.name}`));
      }

      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to decode image: ${file.name}`));
      img.src = event.target.result as string;
    };

    reader.onerror = () => reject(new Error(`FileReader error: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Computes the tight bounding rectangle of non-transparent pixels.
 * Returns at least a 1×1 rect even if the image is fully transparent.
 */
export function getTrimmedRect(canvas: HTMLCanvasElement): Rect {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { x: 0, y: 0, w: canvas.width, h: canvas.height };
  }

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 0) {
        if (x < left)   left   = x;
        if (x > right)  right  = x;
        if (y < top)    top    = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  // No non-transparent pixels found
  if (right < left || bottom < top) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  return {
    x: left,
    y: top,
    w: right - left + 1,
    h: bottom - top + 1,
  };
}

/**
 * Creates a new canvas containing only the trimmed region
 */
export function createTrimmedCanvas(
  source: HTMLCanvasElement,
  rect: Rect
): HTMLCanvasElement {
  const target = document.createElement('canvas');
  target.width = rect.w;
  target.height = rect.h;

  const ctx = target.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D context for trimmed canvas');
  }

  ctx.drawImage(
    source,
    rect.x, rect.y, rect.w, rect.h,   // source rect
    0,      0,      rect.w, rect.h    // destination = full target size
  );

  return target;
}

/**
 * Main entry point: process an image file into a Sprite object
 *
 * @param file - The uploaded image file
 * @param options.trim - Whether to remove transparent padding (default: true)
 * @returns Sprite with trimmed canvas and metadata
 */
export interface ProcessSpriteOptions {
  trim?: boolean;
}

export async function processSprite(
  file: File,
  options: ProcessSpriteOptions = {}
): Promise<Sprite> {
  const { trim = true } = options;

  const image = await loadImage(file);

  // Draw full image to source canvas
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;

  const ctx = sourceCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D context for source canvas');
  }

  ctx.drawImage(image, 0, 0);

  // Decide final bounds
  const trimmedRect = trim
    ? getTrimmedRect(sourceCanvas)
    : { x: 0, y: 0, w: image.width, h: image.height };

  const resultCanvas = createTrimmedCanvas(sourceCanvas, trimmedRect);

  return {
    id: crypto.randomUUID().slice(0, 9), // short, unique, readable id
    name: file.name,
    originalWidth: image.width,
    originalHeight: image.height,
    trimmedRect,
    canvas: resultCanvas,
  };
}

/**
 * Fast integer next-power-of-two calculation (common in texture atlasing)
 */
export function nextPowerOfTwo(n: number): number {
  if (n <= 0) return 1;
  // Using leading zero count – very fast on modern JS engines
  return 1 << (32 - Math.clz32(n - 1));
}

/**
 * Removes a solid background color from a canvas
 */
export function removeBackground(canvas: HTMLCanvasElement, color?: {r: number, g: number, b: number}): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // If no color provided, assume top-left pixel is background
  const targetR = color ? color.r : data[0];
  const targetG = color ? color.g : data[1];
  const targetB = color ? color.b : data[2];
  const tolerance = 15;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    if (Math.abs(r - targetR) < tolerance && 
        Math.abs(g - targetG) < tolerance && 
        Math.abs(b - targetB) < tolerance) {
      data[i + 3] = 0;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Calculates the center of mass (weighted by alpha) of a canvas
 */
export function getCenterOfMass(canvas: HTMLCanvasElement): {x: number, y: number} {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { x: canvas.width / 2, y: canvas.height / 2 };
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  
  let totalAlpha = 0;
  let sumX = 0;
  let sumY = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        totalAlpha += alpha;
        sumX += x * alpha;
        sumY += y * alpha;
      }
    }
  }
  
  if (totalAlpha === 0) return { x: width / 2, y: height / 2 };
  return { x: sumX / totalAlpha, y: sumY / totalAlpha };
}

/**
 * Stabilizes a sequence of sprites by aligning their centers of mass
 */
export function stabilizeFrames(sprites: Sprite[]): Sprite[] {
  if (sprites.length === 0) return sprites;

  const centers = sprites.map(s => getCenterOfMass(s.canvas));
  
  // Find max dimensions to fit all sprites centered
  let maxW = 0;
  let maxH = 0;
  
  centers.forEach((center, i) => {
    const s = sprites[i];
    const distLeft = center.x;
    const distRight = s.canvas.width - center.x;
    const distTop = center.y;
    const distBottom = s.canvas.height - center.y;
    
    maxW = Math.max(maxW, distLeft * 2, distRight * 2);
    maxH = Math.max(maxH, distTop * 2, distBottom * 2);
  });

  // Redraw each sprite onto a new canvas of maxW x maxH, centered
  return sprites.map((s, i) => {
    const center = centers[i];
    const newCanvas = document.createElement('canvas');
    newCanvas.width = Math.ceil(maxW);
    newCanvas.height = Math.ceil(maxH);
    const ctx = newCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        s.canvas,
        newCanvas.width / 2 - center.x,
        newCanvas.height / 2 - center.y
      );
    }
    return {
      ...s,
      canvas: newCanvas,
      trimmedRect: { x: 0, y: 0, w: newCanvas.width, h: newCanvas.height }
    };
  });
}
