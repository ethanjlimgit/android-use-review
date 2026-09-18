/**
 * Accessibility Tree Canvas Visualizer
 * Renders Android accessibility tree and phone state on a 2D canvas
 */

export interface A11yNode {
  text: string;
  index: number;
  bounds: string; // Format: "left,top,right,bottom"
  children: A11yNode[];
  className: string;
  resourceId: string;
}

export interface PhoneState {
  currentApp: string;
  isEditable: boolean;
  packageName: string;
  activityName: string;
  focusedElement: {
    resourceId: string;
  };
  keyboardVisible: boolean;
}

export interface DeviceScreenSize {
  width: number;
  height: number;
}

export interface VisualizerOptions {
  width?: number;
  height?: number;
  padding?: number;
  showLabels?: boolean;
  showIndices?: boolean;
  highlightInteractive?: boolean;
  showPhoneState?: boolean;
  phoneStatePosition?: 'top' | 'bottom' | 'overlay';
  backgroundColor?: string;
  elementColor?: string;
  interactiveColor?: string;
  textColor?: string;
  labelFontSize?: number;
  indexFontSize?: number;
  useActualSize?: boolean; // Use actual device dimensions
  deviceScreenSize?: DeviceScreenSize; // Override screen size (instead of auto-detecting from bounds)
  onHoverChange?: (node: A11yNode | null) => void; // Callback when hover state changes
  onSelectChange?: (node: A11yNode | null) => void; // Callback when selection changes
}

const DEFAULT_OPTIONS: Omit<Required<VisualizerOptions>, 'deviceScreenSize' | 'onHoverChange' | 'onSelectChange'> = {
  width: 1080, // Default Android width
  height: 2400, // Default Android height
  padding: 0,
  showLabels: false,
  showIndices: true,
  highlightInteractive: true,
  showPhoneState: false,
  phoneStatePosition: 'overlay',
  backgroundColor: '#1a1a1a',
  elementColor: 'rgba(100, 100, 255, 0.3)',
  interactiveColor: 'rgba(100, 255, 100, 0.4)',
  textColor: '#ffffff',
  labelFontSize: 10,
  indexFontSize: 24,
  useActualSize: true,
};

// Interactive elements that should be highlighted
const INTERACTIVE_CLASSES = [
  'Button',
  'ImageButton',
  'Switch',
  'EditText',
  'SeekBar',
  'CheckBox',
  'RadioButton',
  'Spinner',
];

export class A11yCanvasVisualizer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Omit<Required<VisualizerOptions>, 'deviceScreenSize' | 'onHoverChange' | 'onSelectChange'> & Pick<VisualizerOptions, 'deviceScreenSize' | 'onHoverChange' | 'onSelectChange'>;
  private deviceBounds = { width: 1080, height: 2400 }; // Default Android dimensions
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private hoveredNode: A11yNode | null = null;
  private selectedNode: A11yNode | null = null;

  constructor(canvas: HTMLCanvasElement, options: VisualizerOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    // Set canvas dimensions
    this.canvas.width = this.options.width;
    this.canvas.height = this.options.height;

    // Setup mouse event listeners
    this.setupEventListeners();
  }

  /**
   * Main render function
   */
  render(tree: A11yNode[], phoneState: PhoneState): void {
    this.lastPhoneState = phoneState;
    this.calculateScale(tree);
    this.clear();
    if (this.options.showPhoneState) {
      this.drawPhoneState(phoneState);
    }
    this.drawTree(tree);
    // Tooltip is now handled by React component via onHoverChange callback
  }

  /**
   * Calculate optimal scale to fit all elements
   */
  private calculateScale(tree: A11yNode[]): void {
    // Use provided device screen size or auto-detect from tree
    if (this.options.deviceScreenSize) {
      this.deviceBounds = {
        width: this.options.deviceScreenSize.width,
        height: this.options.deviceScreenSize.height,
      };
    } else if (tree.length > 0) {
      // Find device bounds from the tree
      let maxRight = 0;
      let maxBottom = 0;

      tree.forEach(node => {
        const bounds = this.parseBounds(node.bounds);
        maxRight = Math.max(maxRight, bounds.right);
        maxBottom = Math.max(maxBottom, bounds.bottom);
      });

      this.deviceBounds = { width: maxRight, height: maxBottom };
    } else {
      // Default size if no tree and no device size provided
      this.deviceBounds = { width: 1080, height: 2400 };
    }

    if (this.options.useActualSize) {
      // Use actual device dimensions (1:1 scale)
      this.scale = 1;
      this.offsetX = this.options.padding;
      this.offsetY = this.options.padding;

      // Update canvas to match device size plus padding
      this.canvas.width = this.deviceBounds.width + this.options.padding * 2;
      this.canvas.height = this.deviceBounds.height + this.options.padding * 2;
    } else {
      // Calculate scale to fit canvas with padding
      const availableWidth = this.options.width - this.options.padding * 2;
      const availableHeight = this.options.height - this.options.padding * 2;

      const scaleX = availableWidth / this.deviceBounds.width;
      const scaleY = availableHeight / this.deviceBounds.height;

      this.scale = Math.min(scaleX, scaleY);
      this.offsetX = this.options.padding;
      this.offsetY = this.options.padding;
    }
  }

  /**
   * Clear canvas
   */
  private clear(): void {
    this.ctx.fillStyle = this.options.backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw phone state information
   */
  private drawPhoneState(phoneState: PhoneState): void {
    const padding = 12;
    const lineHeight = 18;
    const fontSize = 12;

    this.ctx.save();
    this.ctx.font = `${fontSize}px monospace`;

    const lines = [
      `App: ${phoneState.currentApp}`,
      `Package: ${phoneState.packageName}`,
      `Activity: ${phoneState.activityName.split('.').pop() || phoneState.activityName}`,
      `Keyboard: ${phoneState.keyboardVisible ? 'Visible' : 'Hidden'}`,
      `Editable: ${phoneState.isEditable ? 'Yes' : 'No'}`,
      phoneState.focusedElement.resourceId
        ? `Focused: ${phoneState.focusedElement.resourceId}`
        : '',
    ].filter(Boolean);

    // Calculate background size
    const maxWidth = Math.max(
      ...lines.map(line => this.ctx.measureText(line).width)
    );
    const bgWidth = maxWidth + padding * 2;
    const bgHeight = lines.length * lineHeight + padding * 2;

    let x = 0;
    let y = 0;

    if (this.options.phoneStatePosition === 'top') {
      x = this.options.padding;
      y = this.options.padding;
    } else if (this.options.phoneStatePosition === 'bottom') {
      x = this.options.padding;
      y = this.canvas.height - bgHeight - this.options.padding;
    } else {
      // overlay - top right
      x = this.canvas.width - bgWidth - this.options.padding;
      y = this.options.padding;
    }

    // Draw background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    this.ctx.fillRect(x, y, bgWidth, bgHeight);

    // Draw border
    this.ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, bgWidth, bgHeight);

    // Draw text
    this.ctx.fillStyle = this.options.textColor;
    lines.forEach((line, i) => {
      this.ctx.fillText(line, x + padding, y + padding + (i + 1) * lineHeight - 4);
    });

    this.ctx.restore();
  }

  /**
   * Draw all nodes in the tree
   */
  private drawTree(tree: A11yNode[]): void {
    tree.forEach(node => {
      this.drawNode(node);
    });
  }

  /**
   * Draw a single node
   */
  private drawNode(node: A11yNode): void {
    const bounds = this.parseBounds(node.bounds);
    const scaledBounds = this.scaleToCanvas(bounds);

    const isInteractive = this.isInteractive(node);
    const isHovered = this.hoveredNode?.index === node.index;
    const isSelected = this.selectedNode?.index === node.index;

    // Draw element rectangle
    this.ctx.save();

    // Fill
    if (isSelected) {
      this.ctx.fillStyle = 'rgba(255, 200, 0, 0.5)';
    } else if (isHovered) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    } else if (isInteractive && this.options.highlightInteractive) {
      this.ctx.fillStyle = this.options.interactiveColor;
    } else {
      this.ctx.fillStyle = this.options.elementColor;
    }

    this.ctx.fillRect(
      scaledBounds.left,
      scaledBounds.top,
      scaledBounds.width,
      scaledBounds.height
    );

    // Border
    this.ctx.strokeStyle = isSelected
      ? 'rgba(255, 200, 0, 0.9)'
      : isHovered
      ? 'rgba(255, 255, 255, 0.6)'
      : isInteractive
      ? 'rgba(100, 255, 100, 0.6)'
      : 'rgba(100, 100, 255, 0.4)';
    this.ctx.lineWidth = isSelected ? 2 : 1;
    this.ctx.strokeRect(
      scaledBounds.left,
      scaledBounds.top,
      scaledBounds.width,
      scaledBounds.height
    );

    // Draw label and/or index
    if ((this.options.showLabels && scaledBounds.width > 20 && scaledBounds.height > 15) ||
        (this.options.showIndices && scaledBounds.width > 20 && scaledBounds.height > 20)) {
      this.drawLabel(node, scaledBounds);
    }

    this.ctx.restore();
  }

  /**
   * Draw label for a node
   */
  private drawLabel(node: A11yNode, bounds: ScaledBounds): void {
    this.ctx.save();

    // Draw index number in center if enabled
    if (this.options.showIndices) {
      const indexText = `${node.index}`;
      this.ctx.font = `bold ${this.options.indexFontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;

      // Draw background circle/rectangle for index
      const metrics = this.ctx.measureText(indexText);
      const bgSize = Math.max(metrics.width + 8, this.options.indexFontSize + 8);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, bgSize / 2, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw index text
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.fillText(indexText, centerX, centerY);
    }

    // Draw text label if enabled
    if (this.options.showLabels) {
      this.ctx.font = `${this.options.labelFontSize}px monospace`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';

      const parts: string[] = [];

      if (node.text) {
        parts.push(node.text);
      } else if (node.className) {
        parts.push(node.className.split('.').pop() || node.className);
      }

      const label = parts.join(' ');
      if (label) {
        const metrics = this.ctx.measureText(label);

        // Only draw if label fits
        if (metrics.width < bounds.width - 4) {
          // Add text background for readability
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          this.ctx.fillRect(
            bounds.left + 2,
            bounds.top + 2,
            metrics.width + 4,
            this.options.labelFontSize + 4
          );

          this.ctx.fillStyle = this.options.textColor;
          this.ctx.fillText(label, bounds.left + 4, bounds.top + this.options.labelFontSize + 2);
        }
      }
    }

    this.ctx.restore();
  }

  /**
   * Get hovered node (for external use)
   */
  getHoveredNode(): A11yNode | null {
    return this.hoveredNode;
  }

  /**
   * Parse bounds string to object
   */
  private parseBounds(boundsStr: string): Bounds {
    const [left, top, right, bottom] = boundsStr.split(',').map(Number);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  /**
   * Scale device coordinates to canvas coordinates
   */
  private scaleToCanvas(bounds: Bounds): ScaledBounds {
    return {
      left: bounds.left * this.scale + this.offsetX,
      top: bounds.top * this.scale + this.offsetY,
      right: bounds.right * this.scale + this.offsetX,
      bottom: bounds.bottom * this.scale + this.offsetY,
      width: bounds.width * this.scale,
      height: bounds.height * this.scale,
    };
  }

  /**
   * Check if a node is interactive
   */
  private isInteractive(node: A11yNode): boolean {
    return INTERACTIVE_CLASSES.some(cls => node.className.includes(cls));
  }

  /**
   * Convert mouse event coordinates to canvas coordinates
   */
  private getCanvasCoordinates(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();

    // Mouse position relative to canvas in CSS pixels
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    // Scale to canvas internal coordinates
    // The canvas might be displayed at a different size than its actual resolution
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: cssX * scaleX,
      y: cssY * scaleY,
    };
  }

  /**
   * Find node at canvas coordinates
   */
  private findNodeAtPoint(x: number, y: number, tree: A11yNode[]): A11yNode | null {
    // Iterate in reverse to prioritize top elements
    for (let i = tree.length - 1; i >= 0; i--) {
      const node = tree[i];
      const bounds = this.parseBounds(node.bounds);
      const scaledBounds = this.scaleToCanvas(bounds);

      if (
        x >= scaledBounds.left &&
        x <= scaledBounds.right &&
        y >= scaledBounds.top &&
        y <= scaledBounds.bottom
      ) {
        return node;
      }
    }
    return null;
  }

  /**
   * Setup mouse event listeners
   */
  private setupEventListeners(): void {
    let currentTree: A11yNode[] = [];

    // Store reference to tree for event handlers
    const originalRender = this.render.bind(this);
    this.render = (tree: A11yNode[], phoneState: PhoneState) => {
      currentTree = tree;
      originalRender(tree, phoneState);
    };

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.getCanvasCoordinates(e);

      const node = this.findNodeAtPoint(x, y, currentTree);
      if (node !== this.hoveredNode) {
        this.hoveredNode = node;
        this.canvas.style.cursor = node ? 'pointer' : 'default';
        // Notify React component of hover change
        this.options.onHoverChange?.(node);
        // Re-render to show hover state
        originalRender(currentTree, this.lastPhoneState);
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const { x, y } = this.getCanvasCoordinates(e);

      const node = this.findNodeAtPoint(x, y, currentTree);
      const newSelection = this.selectedNode === node ? null : node;
      this.selectedNode = newSelection;

      // Notify React component of selection change
      this.options.onSelectChange?.(newSelection);
      originalRender(currentTree, this.lastPhoneState);

      // Emit custom event with selected node (for backward compatibility)
      if (node) {
        const event = new CustomEvent('nodeSelected', { detail: node });
        this.canvas.dispatchEvent(event);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoveredNode !== null) {
        this.hoveredNode = null;
        this.canvas.style.cursor = 'default';
        // Notify React component that hover ended
        this.options.onHoverChange?.(null);
      }
    });
  }

  private lastPhoneState!: PhoneState;

  /**
   * Get currently selected node
   */
  getSelectedNode(): A11yNode | null {
    return this.selectedNode;
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedNode = null;
  }

  /**
   * Export canvas as image
   */
  exportAsImage(format: 'png' | 'jpeg' = 'png'): string {
    return this.canvas.toDataURL(`image/${format}`);
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<VisualizerOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ScaledBounds extends Bounds {}

/**
 * Standalone function to create and render visualization
 */
export function visualizeA11yTree(
  canvas: HTMLCanvasElement,
  tree: A11yNode[],
  phoneState: PhoneState,
  options?: VisualizerOptions
): A11yCanvasVisualizer {
  const visualizer = new A11yCanvasVisualizer(canvas, options);
  visualizer.render(tree, phoneState);
  return visualizer;
}

/**
 * React hook for canvas visualization (optional)
 * Note: Import React in your component file to use this hook
 */
export function useA11yVisualizer(
  canvasRef: { current: HTMLCanvasElement | null },
  options?: VisualizerOptions
) {
  // This function returns helpers that can be used with React hooks
  // The actual hook usage should be done in the component file
  let visualizer: A11yCanvasVisualizer | null = null;

  const initialize = () => {
    if (!canvasRef.current) return;
    visualizer = new A11yCanvasVisualizer(canvasRef.current, options);
    return visualizer;
  };

  const render = (tree: A11yNode[], phoneState: PhoneState) => {
    visualizer?.render(tree, phoneState);
  };

  return {
    initialize,
    render,
    getVisualizer: () => visualizer,
  };
}
