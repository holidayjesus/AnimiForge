export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Sprite {
  id: string;
  name: string;
  originalWidth: number;
  originalHeight: number;
  trimmedRect: Rect; // The rect of non-transparent pixels relative to original
  canvas: HTMLCanvasElement;
}

export interface PackedSprite extends Sprite {
  frame: Rect; // Position in the atlas
}

export interface PackerSettings {
  padding: number;
  allowRotation: boolean;
  pot: boolean;
  square: boolean;
  trim: boolean;
  maxWidth: number;
  maxHeight: number;
}

export interface AtlasResult {
  sprites: PackedSprite[];
  width: number;
  height: number;
  json: string;
}
