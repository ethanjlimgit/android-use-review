import { describe, it, expect } from 'vitest';
import {
  filterTree,
  formatDeviceState,
  type TreeNode,
  type DeviceContext,
} from '../src/tools/tree-filter.js';

describe('Tree Filter', () => {
  const mockDeviceContext: DeviceContext = {
    screen_bounds: { width: 1080, height: 2400 },
    filtering_params: { min_element_size: 5 },
  };

  it('should filter nodes outside screen bounds', () => {
    const tree: TreeNode = {
      cls: 'FrameLayout',
      b: { l: -100, t: -100, r: -50, b: -50 },
      ch: [],
    };

    const result = filterTree(tree, mockDeviceContext);
    expect(result).toBeNull();
  });

  it('should keep nodes inside screen bounds', () => {
    const tree: TreeNode = {
      cls: 'FrameLayout',
      b: { l: 0, t: 0, r: 1080, b: 2400 },
      ch: [
        {
          cls: 'Button',
          txt: 'Click me',
          b: { l: 100, t: 100, r: 300, b: 200 },
          ch: [],
        },
      ],
    };

    const result = filterTree(tree, mockDeviceContext);
    expect(result).not.toBeNull();
    expect(result!.ch).toHaveLength(1);
  });

  it('should filter nodes below minimum size', () => {
    const tree: TreeNode = {
      cls: 'FrameLayout',
      b: { l: 0, t: 0, r: 1080, b: 2400 },
      ch: [
        {
          cls: 'View',
          b: { l: 100, t: 100, r: 102, b: 102 }, // 2x2 - too small
          ch: [],
        },
      ],
    };

    const result = filterTree(tree, mockDeviceContext);
    expect(result).not.toBeNull();
    expect(result!.ch).toHaveLength(0); // Small child filtered out
  });

  it('should support legacy field names', () => {
    const tree: TreeNode = {
      className: 'FrameLayout',
      boundsInScreen: { left: 0, top: 0, right: 1080, bottom: 2400 },
      children: [
        {
          className: 'Button',
          text: 'OK',
          resourceId: 'btn_ok',
          boundsInScreen: { left: 100, top: 100, right: 300, bottom: 200 },
          children: [],
        },
      ],
    };

    const result = filterTree(tree, mockDeviceContext);
    expect(result).not.toBeNull();
    expect(result!.children).toHaveLength(1);
  });
});

describe('Format Device State', () => {
  it('should format phone state and elements', () => {
    const tree: TreeNode = {
      cls: 'Button',
      txt: 'Submit',
      rid: 'btn_submit',
      b: { l: 100, t: 200, r: 300, b: 260 },
      ch: [],
    };

    const phoneState = {
      currentApp: 'MyApp',
      packageName: 'com.example.myapp',
      isEditable: false,
      focusedElement: null,
    };

    const result = formatDeviceState(tree, phoneState);

    expect(result.formattedText).toContain('MyApp');
    expect(result.formattedText).toContain('com.example.myapp');
    expect(result.formattedText).toContain('Hidden'); // keyboard hidden
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0].index).toBe(1);
    expect(result.elements[0].text).toBe('Submit');
    expect(result.elements[0].bounds).toBe('100,200,300,260');
  });

  it('should handle null tree', () => {
    const phoneState = {
      currentApp: 'Test',
      packageName: 'com.test',
    };

    const result = formatDeviceState(null, phoneState);

    expect(result.elements).toHaveLength(0);
    expect(result.formattedText).toContain('No UI elements found');
  });

  it('should extract focused text', () => {
    const phoneState = {
      currentApp: 'Test',
      packageName: 'com.test',
      focusedElement: { text: 'Hello world' },
    };

    const result = formatDeviceState(null, phoneState);
    expect(result.focusedText).toBe('Hello world');
  });
});
