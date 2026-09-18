'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  A11yCanvasVisualizer,
  visualizeA11yTree,
  type A11yNode,
  type PhoneState,
  type VisualizerOptions,
  type DeviceScreenSize,
} from '../lib/a11y-canvas-visualizer';
import { Card } from '@droiduse/shared-ui';

interface TaskStepVisualizerProps {
  tree: A11yNode[];
  phoneState: PhoneState;
  stepNumber?: number;
  stepDescription?: string;
  options?: VisualizerOptions;
  onNodeSelect?: (node: A11yNode) => void;
  className?: string;
}

export function TaskStepVisualizer({
  tree,
  phoneState,
  stepNumber,
  stepDescription,
  options,
  onNodeSelect,
  className = '',
}: TaskStepVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visualizerRef = useRef<A11yCanvasVisualizer | null>(null);
  const [selectedNode, setSelectedNode] = useState<A11yNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<A11yNode | null>(null);

  // Initialize visualizer
  useEffect(() => {
    if (!canvasRef.current) return;

    const defaultOptions: VisualizerOptions = {
      useActualSize: false, // Use scaled version for full component
      width: 400,
      height: 800,
      padding: 20,
      showLabels: true,
      showIndices: true,
      highlightInteractive: true,
      showPhoneState: true,
      phoneStatePosition: 'overlay',
      backgroundColor: '#0a0a0a',
      elementColor: 'rgba(59, 130, 246, 0.2)', // blue-500
      interactiveColor: 'rgba(34, 197, 94, 0.3)', // green-500
      textColor: '#ffffff',
      labelFontSize: 9,
      indexFontSize: 24,
      onHoverChange: setHoveredNode, // React callback for hover
      onSelectChange: (node) => {
        setSelectedNode(node);
        if (node) onNodeSelect?.(node);
      },
      ...options,
    };

    visualizerRef.current = visualizeA11yTree(
      canvasRef.current,
      tree,
      phoneState,
      defaultOptions
    );

    // Listen for node selection (backward compatibility)
    const handleNodeSelection = (e: Event) => {
      const customEvent = e as CustomEvent<A11yNode>;
      setSelectedNode(customEvent.detail);
      onNodeSelect?.(customEvent.detail);
    };

    canvasRef.current.addEventListener('nodeSelected', handleNodeSelection);

    return () => {
      canvasRef.current?.removeEventListener('nodeSelected', handleNodeSelection);
    };
  }, [tree, phoneState, options, onNodeSelect]);

  // Re-render when data changes
  useEffect(() => {
    if (visualizerRef.current) {
      visualizerRef.current.render(tree, phoneState);
    }
  }, [tree, phoneState]);

  const handleExport = () => {
    if (visualizerRef.current) {
      const dataUrl = visualizerRef.current.exportAsImage('png');
      const link = document.createElement('a');
      link.download = `task-step-${stepNumber || 'screenshot'}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  const handleClearSelection = () => {
    visualizerRef.current?.clearSelection();
    setSelectedNode(null);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Step Header */}
      {(stepNumber !== undefined || stepDescription) && (
        <div className="flex items-center justify-between">
          <div>
            {stepNumber !== undefined && (
              <span className="text-sm font-medium text-muted-foreground">
                Step {stepNumber}
              </span>
            )}
            {stepDescription && (
              <p className="text-sm text-foreground mt-1">{stepDescription}</p>
            )}
          </div>
          <div className="flex gap-2">
            {selectedNode && (
              <button
                onClick={handleClearSelection}
                className="text-xs px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Clear Selection
              </button>
            )}
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Export Image
            </button>
          </div>
        </div>
      )}

      {/* Canvas Container */}
      <Card className="overflow-hidden bg-card border border-border">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ imageRendering: 'crisp-edges' }}
          />

          {/* Hover Info */}
          {hoveredNode && !selectedNode && <HoverInfo node={hoveredNode} />}

          {/* Overlay Info */}
          {tree.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <p className="text-sm text-muted-foreground">
                No accessibility tree data available
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card className="p-4 bg-card border border-border">
          <h3 className="text-sm font-semibold mb-3">Selected Element Details</h3>
          <dl className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div>
              <dt className="text-muted-foreground mb-1">Index</dt>
              <dd className="text-foreground font-semibold">{selectedNode.index}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground mb-1">Class</dt>
              <dd className="text-foreground truncate" title={selectedNode.className}>
                {selectedNode.className.split('.').pop()}
              </dd>
            </div>
            {selectedNode.text && (
              <div className="col-span-2">
                <dt className="text-muted-foreground mb-1">Text</dt>
                <dd className="text-foreground">{selectedNode.text}</dd>
              </div>
            )}
            {selectedNode.resourceId && (
              <div className="col-span-2">
                <dt className="text-muted-foreground mb-1">Resource ID</dt>
                <dd className="text-foreground break-all">{selectedNode.resourceId}</dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-muted-foreground mb-1">Bounds</dt>
              <dd className="text-foreground">{selectedNode.bounds}</dd>
            </div>
          </dl>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 text-xs">
        <Card className="p-3 bg-card border border-border">
          <div className="text-muted-foreground mb-1">Total Elements</div>
          <div className="text-2xl font-bold text-foreground">{tree.length}</div>
        </Card>
        <Card className="p-3 bg-card border border-border">
          <div className="text-muted-foreground mb-1">Interactive</div>
          <div className="text-2xl font-bold text-green-500">
            {
              tree.filter((node) =>
                ['Button', 'Switch', 'EditText', 'ImageButton'].some((cls) =>
                  node.className.includes(cls)
                )
              ).length
            }
          </div>
        </Card>
        <Card className="p-3 bg-card border border-border">
          <div className="text-muted-foreground mb-1">Current App</div>
          <div className="text-sm font-semibold text-foreground truncate" title={phoneState.currentApp}>
            {phoneState.currentApp}
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Hover info component displayed outside canvas
 */
function HoverInfo({ node }: { node: A11yNode | null }) {
  if (!node) return null;

  const bounds = node.bounds.split(',').map(Number);
  const [left, top, right, bottom] = bounds;
  const width = right - left;
  const height = bottom - top;

  return (
    <Card className="absolute top-2 right-2 p-3 bg-background/95 border-2 border-primary shadow-lg z-10 max-w-xs">
      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{node.index}</span>
          </div>
          <span className="font-semibold text-foreground">Element Info</span>
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Class:</span>
          <span className="text-foreground break-all">{node.className.split('.').pop()}</span>

          {node.text && (
            <>
              <span className="text-muted-foreground">Text:</span>
              <span className="text-foreground break-words">{node.text}</span>
            </>
          )}

          {node.resourceId && (
            <>
              <span className="text-muted-foreground">Resource:</span>
              <span className="text-foreground break-all text-[10px]">{node.resourceId}</span>
            </>
          )}

          <span className="text-muted-foreground">Position:</span>
          <span className="text-foreground">{left}, {top}</span>

          <span className="text-muted-foreground">Size:</span>
          <span className="text-foreground">{width} × {height}</span>

          <span className="text-muted-foreground">Bounds:</span>
          <span className="text-foreground text-[10px]">{node.bounds}</span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Simplified version for inline display in task steps
 */
export function TaskStepVisualizerCompact({
  tree,
  phoneState,
  deviceScreenSize,
  className = '',
}: Pick<TaskStepVisualizerProps, 'tree' | 'phoneState' | 'className'> & {
  deviceScreenSize?: DeviceScreenSize;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<A11yNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<A11yNode | null>(null);

  useEffect(() => {
    if (!canvasRef.current || tree.length === 0) return;

    visualizeA11yTree(canvasRef.current, tree, phoneState, {
      useActualSize: true, // Use actual device dimensions
      deviceScreenSize, // Pass device screen size from device type
      padding: 0,
      showLabels: false,
      showIndices: true, // Show index numbers
      highlightInteractive: true,
      showPhoneState: false, // Don't show phone state overlay
      backgroundColor: '#0a0a0a',
      elementColor: 'rgba(59, 130, 246, 0.2)',
      interactiveColor: 'rgba(34, 197, 94, 0.3)',
      textColor: '#ffffff',
      indexFontSize: 24,
      onHoverChange: setHoveredNode, // React callback for hover
      onSelectChange: setSelectedNode, // React callback for selection
    });
  }, [tree, phoneState, deviceScreenSize]);

  if (tree.length === 0) {
    return (
      <div className={`flex items-center justify-center h-[600px] bg-secondary/20 rounded-lg ${className}`}>
        <p className="text-sm text-muted-foreground">No UI state</p>
      </div>
    );
  }

  const displayNode = selectedNode || hoveredNode;

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-auto rounded-lg border border-border bg-[#0a0a0a]"
        style={{ imageRendering: 'auto', maxWidth: '100%' }}
      />
      <HoverInfo node={displayNode} />
    </div>
  );
}
