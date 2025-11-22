import { storage } from "../storage";
import { type InsertShape } from "@shared/schema";

// --- Spatial Indexing ---

class SpatialGrid {
  private grid: Map<string, InsertShape[]> = new Map();
  private cellSize: number;

  constructor(width: number, height: number, cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  private getShapeCells(shape: InsertShape): string[] {
    const bounds = getShapeBounds(shape);
    if (!bounds) return [];

    const startX = Math.floor(bounds.minX / this.cellSize);
    const endX = Math.floor(bounds.maxX / this.cellSize);
    const startY = Math.floor(bounds.minY / this.cellSize);
    const endY = Math.floor(bounds.maxY / this.cellSize);

    const cells: string[] = [];
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        cells.push(`${x},${y}`);
      }
    }
    return cells;
  }

  add(shape: InsertShape) {
    const cells = this.getShapeCells(shape);
    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, []);
      }
      this.grid.get(cell)!.push(shape);
    }
  }

  query(shape: InsertShape): InsertShape[] {
    const cells = this.getShapeCells(shape);
    const result = new Set<InsertShape>();
    for (const cell of cells) {
      const shapes = this.grid.get(cell);
      if (shapes) {
        for (const s of shapes) {
          result.add(s);
        }
      }
    }
    return Array.from(result);
  }
}

// --- Utilities: shape normalization and templates ---

function getShapeBounds(s: Partial<InsertShape>): { minX: number; minY: number; maxX: number; maxY: number } | null {
  // @ts-ignore - types are loose in DB but strict here
  const type = s.type;
  
  switch (type) {
    case 'circle':
      if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
        return { minX: s.x - s.radius, minY: s.y - s.radius, maxX: s.x + s.radius, maxY: s.y + s.radius };
      }
      return null;
    case 'rectangle':
    case 'triangle':
      if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.width === 'number' && typeof s.height === 'number') {
        return { minX: s.x, minY: s.y, maxX: s.x + s.width, maxY: s.y + s.height };
      }
      return null;
    case 'star':
      if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.radius === 'number') {
        return { minX: s.x - s.radius, minY: s.y - s.radius, maxX: s.x + s.radius, maxY: s.y + s.radius };
      }
      return null;
    case 'line':
      if (typeof s.x === 'number' && typeof s.y === 'number' && typeof s.x2 === 'number' && typeof s.y2 === 'number') {
        return { minX: Math.min(s.x, s.x2), minY: Math.min(s.y, s.y2), maxX: Math.max(s.x, s.x2), maxY: Math.max(s.y, s.y2) };
      }
      return null;
    default:
      return null;
  }
}

function computeBounds(shapes: Partial<InsertShape>[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!Array.isArray(shapes) || shapes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const s of shapes) {
    const b = getShapeBounds(s);
    if (b) {
      minX = Math.min(minX, b.minX);
      maxX = Math.max(maxX, b.maxX);
      minY = Math.min(minY, b.minY);
      maxY = Math.max(maxY, b.maxY);
    }
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
  return { minX, minY, maxX, maxY };
}

export function normalizeShapesToCanvas(
  shapes: Partial<InsertShape>[],
  opts: { width: number; height: number; target: { w: number; h: number }; center: { x: number; y: number } }
): any[] {
  const bounds = computeBounds(shapes);
  if (!bounds) return shapes;
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(opts.target.w / bw, opts.target.h / bh);
  const cx = bounds.minX + bw / 2;
  const cy = bounds.minY + bh / 2;
  const tx = opts.center.x;
  const ty = opts.center.y;

  return shapes.map((s) => {
    const copy = { ...s };
    const color = copy.color || '#000000';
    copy.color = color;
    copy.strokeWidth = copy.strokeWidth || 2;
    
    // @ts-ignore
    switch (copy.type) {
      case 'circle':
        if (typeof copy.x === 'number' && typeof copy.y === 'number') {
          copy.x = (copy.x - cx) * scale + tx;
          copy.y = (copy.y - cy) * scale + ty;
        }
        if (typeof copy.radius === 'number') copy.radius = Math.max(1, copy.radius * scale);
        break;
      case 'rectangle':
      case 'triangle':
        if (typeof copy.x === 'number' && typeof copy.y === 'number') {
          copy.x = (copy.x - cx) * scale + tx;
          copy.y = (copy.y - cy) * scale + ty;
        }
        if (typeof copy.width === 'number') copy.width = Math.max(1, copy.width * scale);
        if (typeof copy.height === 'number') copy.height = Math.max(1, copy.height * scale);
        break;
      case 'star':
        if (typeof copy.x === 'number' && typeof copy.y === 'number') {
          copy.x = (copy.x - cx) * scale + tx;
          copy.y = (copy.y - cy) * scale + ty;
        }
        if (typeof copy.radius === 'number') copy.radius = Math.max(1, copy.radius * scale);
        break;
      case 'line':
        if (typeof copy.x === 'number' && typeof copy.y === 'number') {
          copy.x = (copy.x - cx) * scale + tx;
          copy.y = (copy.y - cy) * scale + ty;
        }
        if (typeof copy.x2 === 'number' && typeof copy.y2 === 'number') {
          copy.x2 = (copy.x2 - cx) * scale + tx;
          copy.y2 = (copy.y2 - cy) * scale + ty;
        }
        break;
    }
    return copy;
  });
}

function translateComposite(shapes: Partial<InsertShape>[], dx: number, dy: number): any[] {
  return shapes.map((s) => {
    const c = { ...s };
    if (typeof c.x === 'number') c.x += dx;
    if (typeof c.y === 'number') c.y += dy;
    if (typeof c.x2 === 'number') c.x2 += dx;
    if (typeof c.y2 === 'number') c.y2 += dy;
    return c;
  });
}

function rectsOverlap(a: {minX:number;minY:number;maxX:number;maxY:number}, b: {minX:number;minY:number;maxX:number;maxY:number}, margin = 10): boolean {
  return !(a.maxX + margin < b.minX || a.minX - margin > b.maxX || a.maxY + margin < b.minY || a.minY - margin > b.maxY);
}

function anyOverlap(composite: Partial<InsertShape>[], existing: Partial<InsertShape>[]): boolean {
  // Use simple O(N*M) check for now, but we could use the SpatialGrid here too if we wanted
  // For placement, we just want to know if *any* overlap occurs
  const existingBounds = existing.map(getShapeBounds).filter(Boolean) as any[];
  for (const s of composite) {
    const sb = getShapeBounds(s);
    if (!sb) continue;
    for (const eb of existingBounds) {
      if (rectsOverlap(sb, eb)) return true;
    }
  }
  return false;
}

export async function placeShape(shapes: Partial<InsertShape>[], canvas: { width: number; height: number }): Promise<any[]> {
  const existing = await storage.getShapes();
  
  // Try to place without overlap
  // Compute composite bounds relative to current positions
  const bounds = computeBounds(shapes);
  if (!bounds) return shapes;
  const cw = canvas.width;
  const ch = canvas.height;

  // Candidate centers (grid)
  const cols = 4; const rows = 4;
  const candidates: { x: number; y: number }[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      candidates.push({ x: (c * cw) / (cols + 1), y: (r * ch) / (rows + 1) });
    }
  }

  // Current center
  const cx = bounds.minX + (bounds.maxX - bounds.minX) / 2;
  const cy = bounds.minY + (bounds.maxY - bounds.minY) / 2;

  for (const candidate of candidates) {
    const dx = candidate.x - cx;
    const dy = candidate.y - cy;
    const moved = translateComposite(shapes, dx, dy);
    if (!anyOverlap(moved, existing as any)) {
      return moved;
    }
  }
  
  // If all positions overlap, return original (NO EVICTION)
  return shapes;
}

export function maybeApplyTemplate(command: string, shapes: any[]): { applied: boolean; templateName?: string; shapes: any[] } {
  // If shapes already look valid, keep them; otherwise, provide sane defaults
  const hasCircle = shapes.some((s) => s.type === 'circle');
  const hasLine = shapes.some((s) => s.type === 'line');

  if (command.includes('smile') || command.includes('smiley')) {
    const tmpl = [
      // More visible face outline
      { type: 'circle', x: 300, y: 250, radius: 80, color: '#FFC107', strokeWidth: 4 },
      { type: 'circle', x: 270, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
      { type: 'circle', x: 330, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
      { type: 'line', x: 250, y: 280, x2: 350, y2: 280, color: '#000000', strokeWidth: 3, style: 'curve' },
    ];
    return { applied: true, templateName: 'smiley', shapes: tmpl };
  }
  if (command.includes('sad face')) {
    const tmpl = [
      { type: 'circle', x: 300, y: 250, radius: 80, color: '#FFFFCC', strokeWidth: 2 },
      { type: 'circle', x: 270, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
      { type: 'circle', x: 330, y: 220, radius: 8, color: '#000000', strokeWidth: 2 },
      { type: 'line', x: 250, y: 320, x2: 350, y2: 320, color: '#000000', strokeWidth: 3, style: 'curve' },
    ];
    return { applied: true, templateName: 'sad', shapes: tmpl };
  }
  if (command.includes('sun')) {
    // Sun with 8 evenly spaced rays, top-aligned
    const centerX = 300; const centerY = 250; const R = 80;
    const rays: any[] = [];
    const rayLen = 40;
    const rayCount = 8;
    const startAngle = -Math.PI / 2; // north
    for (let i = 0; i < rayCount; i++) {
      const angle = startAngle + (i / rayCount) * Math.PI * 2;
      const sx = centerX + (R + 5) * Math.cos(angle);
      const sy = centerY + (R + 5) * Math.sin(angle);
      const ex = centerX + (R + rayLen) * Math.cos(angle);
      const ey = centerY + (R + rayLen) * Math.sin(angle);
      rays.push({ type: 'line', x: sx, y: sy, x2: ex, y2: ey, color: '#FFA500', strokeWidth: 3 });
    }
    const tmpl = [
      { type: 'circle', x: centerX, y: centerY, radius: R, color: '#FFFF00', strokeWidth: 2 },
      ...rays,
    ];
    return { applied: true, templateName: 'sun', shapes: tmpl };
  }
  if (command.includes('tree')) {
    const tmpl = [
      // Trunk
      { type: 'rectangle', x: 290, y: 290, width: 20, height: 80, color: '#8B4513', strokeWidth: 2 },
      // Foliage (stacked triangles)
      { type: 'triangle', x: 240, y: 200, width: 120, height: 90, color: '#228B22', strokeWidth: 2 },
      { type: 'triangle', x: 255, y: 160, width: 90, height: 70, color: '#2E8B57', strokeWidth: 2 },
      { type: 'triangle', x: 270, y: 130, width: 60, height: 50, color: '#32CD32', strokeWidth: 2 },
    ];
    return { applied: true, templateName: 'tree', shapes: tmpl };
  }
  if (command.includes('house')) {
    const baseX = 300; const baseY = 280; const w = 160; const h = 120; const roofH = 70;
    const tmpl = [
      { type: 'rectangle', x: baseX - w / 2, y: baseY - h, width: w, height: h, color: '#8B4513', strokeWidth: 3 },
      { type: 'triangle', x: baseX - w / 2, y: baseY - h - roofH, width: w, height: roofH, color: '#A0522D', strokeWidth: 3 },
      { type: 'rectangle', x: baseX - 15, y: baseY - 50, width: 30, height: 50, color: '#654321', strokeWidth: 2 },
      { type: 'rectangle', x: baseX - 60, y: baseY - 90, width: 35, height: 35, color: '#87CEEB', strokeWidth: 2 },
    ];
    return { applied: true, templateName: 'house', shapes: tmpl };
  }
  if (command.includes('apple')) {
    const tmpl = [
      { type: 'circle', x: 300, y: 260, radius: 40, color: '#FF0000', strokeWidth: 2 },
      { type: 'line', x: 300, y: 220, x2: 300, y2: 200, color: '#654321', strokeWidth: 3 },
      { type: 'circle', x: 290, y: 245, radius: 6, color: '#FFFFFF', strokeWidth: 2 },
      { type: 'circle', x: 310, y: 245, radius: 6, color: '#FFFFFF', strokeWidth: 2 },
    ];
    return { applied: true, templateName: 'apple', shapes: tmpl };
  }
  // If output already decent, keep it
  if (hasCircle || hasLine) return { applied: false, shapes };
  // Otherwise skip
  return { applied: false, shapes };
}
