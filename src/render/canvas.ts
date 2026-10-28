export const SCOPE_THEME = {
  background: '#0e1014',
  grid: '#242a34',
  gridStrong: '#343c49',
  axis: '#525d6d',
  accent: '#ff5a1f',
  accentSoft: '#ff8f63',
  paper: '#f5f3ec',
  muted: '#8f98a6',
} as const;

/**
 * Shared high-DPI canvas lifecycle: ResizeObserver sizing, a single rAF loop,
 * and clean teardown when a room unmounts.
 */
export abstract class CanvasView {
  protected readonly canvas: HTMLCanvasElement;
  protected readonly context: CanvasRenderingContext2D;
  protected width = 0;
  protected height = 0;
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;
  private running = false;

  constructor(className: string, ariaLabel: string) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = className;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', ariaLabel);
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D is unavailable.');
    }
    this.context = context;
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  protected abstract drawFrame(now: number): void;

  mount(container: HTMLElement): void {
    container.append(this.canvas);
    this.resizeObserver.observe(container);
    this.resize();
    this.start();
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    const loop = (now: number): void => {
      if (!this.running) {
        return;
      }
      if (this.width > 0 && this.height > 0) {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
        this.drawFrame(now);
      }
      this.frame = requestAnimationFrame(loop);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  protected get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  private resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      return;
    }
    this.width = rect.width;
    this.height = rect.height;
    const ratio = this.pixelRatio;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  protected drawGrid(columns = 8, rows = 4): void {
    const ctx = this.context;
    ctx.save();
    ctx.strokeStyle = SCOPE_THEME.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let column = 1; column < columns; column += 1) {
      const x = Math.round((this.width / columns) * column) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let row = 1; row < rows; row += 1) {
      const y = Math.round((this.height / rows) * row) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = SCOPE_THEME.gridStrong;
    ctx.beginPath();
    const midY = Math.round(this.height / 2) + 0.5;
    ctx.moveTo(0, midY);
    ctx.lineTo(this.width, midY);
    ctx.stroke();
    ctx.restore();
  }

  protected drawScopeLabel(text: string, align: 'left' | 'right' = 'left'): void {
    const ctx = this.context;
    ctx.save();
    ctx.fillStyle = SCOPE_THEME.muted;
    ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, align === 'left' ? 10 : this.width - 10, 8);
    ctx.restore();
  }
}
