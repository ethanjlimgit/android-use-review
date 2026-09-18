/**
 * Accessibility tree filtering and formatting.
 * Ported from Python: tools/filters/concise_filter.py + tools/formatters/indexed_formatter.py
 */

export interface TreeNode {
  // Compact field names (from Android app)
  cls?: string;
  rid?: string;
  txt?: string;
  desc?: string;
  b?: { l: number; t: number; r: number; b: number };
  ch?: TreeNode[];
  // Legacy field names
  className?: string;
  resourceId?: string;
  text?: string;
  contentDescription?: string;
  boundsInScreen?: { left: number; top: number; right: number; bottom: number };
  children?: TreeNode[];
}

export interface DeviceContext {
  screen_bounds?: { width: number; height: number };
  filtering_params?: { min_element_size?: number };
}

export interface FormattedElement {
  index: number;
  resourceId: string;
  className: string;
  text: string;
  bounds: string;
  children: FormattedElement[];
}

export interface PhoneState {
  currentApp?: string;
  packageName?: string;
  focusedElement?: { text?: string };
  isEditable?: boolean;
  error?: string;
  message?: string;
}

// ── Concise Filter ──

function getBounds(node: TreeNode): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const b = node.b ?? node.boundsInScreen;
  if (!b) return { left: 0, top: 0, right: 0, bottom: 0 };
  if ('l' in b)
    return {
      left: (b as { l: number }).l,
      top: (b as { t: number }).t,
      right: (b as { r: number }).r,
      bottom: (b as { b: number }).b,
    };
  return b as { left: number; top: number; right: number; bottom: number };
}

function intersectsScreen(
  node: TreeNode,
  screenWidth: number,
  screenHeight: number,
): boolean {
  const { left, top, right, bottom } = getBounds(node);
  return !(right <= 0 || bottom <= 0 || left >= screenWidth || top >= screenHeight);
}

function meetsMinSize(node: TreeNode, minSize: number): boolean {
  const { left, top, right, bottom } = getBounds(node);
  return right - left > minSize && bottom - top > minSize;
}

function filterNode(
  node: TreeNode,
  screenWidth: number,
  screenHeight: number,
  minSize: number,
): TreeNode | null {
  if (!intersectsScreen(node, screenWidth, screenHeight)) return null;
  if (!meetsMinSize(node, minSize)) return null;

  const children = node.ch ?? node.children ?? [];
  const filteredChildren: TreeNode[] = [];
  for (const child of children) {
    const filtered = filterNode(child, screenWidth, screenHeight, minSize);
    if (filtered) filteredChildren.push(filtered);
  }

  const childrenKey = 'ch' in node ? 'ch' : 'children';
  return { ...node, [childrenKey]: filteredChildren };
}

export function filterTree(
  tree: TreeNode,
  deviceContext: DeviceContext,
): TreeNode | null {
  const screenBounds = deviceContext.screen_bounds ?? {
    width: 1080,
    height: 2400,
  };
  const minSize = deviceContext.filtering_params?.min_element_size ?? 5;
  return filterNode(
    tree,
    screenBounds.width,
    screenBounds.height,
    minSize,
  );
}

// ── Indexed Formatter ──

function formatNode(node: TreeNode, index: number): FormattedElement {
  const { left, top, right, bottom } = getBounds(node);
  const text =
    node.txt ??
    node.text ??
    node.desc ??
    node.contentDescription ??
    node.rid ??
    node.resourceId ??
    node.cls ??
    node.className ??
    '';
  const className = node.cls ?? node.className ?? '';
  const shortClass = className.includes('.')
    ? className.split('.').pop()!
    : className;
  const resourceId = node.rid ?? node.resourceId ?? '';

  return {
    index,
    resourceId,
    className: shortClass,
    text,
    bounds: `${left},${top},${right},${bottom}`,
    children: [],
  };
}

function flattenWithIndex(
  node: TreeNode,
  counter: { value: number },
): FormattedElement[] {
  const results: FormattedElement[] = [];
  results.push(formatNode(node, counter.value));
  counter.value++;

  const children = node.ch ?? node.children ?? [];
  for (const child of children) {
    results.push(...flattenWithIndex(child, counter));
  }

  return results;
}

function formatUiElements(
  elements: FormattedElement[],
  level = 0,
): string {
  if (!elements.length) return '';

  const lines: string[] = [];
  const indent = '  '.repeat(level);

  for (const el of elements) {
    const parts: string[] = [];
    if (el.index !== undefined) parts.push(`${el.index}.`);
    if (el.className) parts.push(`${el.className}:`);

    const details: string[] = [];
    if (el.resourceId) details.push(`"${el.resourceId}"`);
    if (el.text) details.push(`"${el.text}"`);
    if (details.length) parts.push(details.join(', '));
    if (el.bounds) parts.push(`- (${el.bounds})`);

    lines.push(`${indent}${parts.join(' ')}`);

    if (el.children?.length) {
      const childFormatted = formatUiElements(el.children, level + 1);
      if (childFormatted) lines.push(childFormatted);
    }
  }

  return lines.join('\n');
}

export interface FormattedState {
  formattedText: string;
  focusedText: string;
  elements: FormattedElement[];
  phoneState: PhoneState;
}

export function formatDeviceState(
  filteredTree: TreeNode | null,
  phoneState: PhoneState,
): FormattedState {
  const focusedText = phoneState.focusedElement?.text ?? '';

  const elements = filteredTree
    ? flattenWithIndex(filteredTree, { value: 1 })
    : [];

  // Format phone state
  let phoneStateText: string;
  if (phoneState && !phoneState.error) {
    const currentApp = phoneState.currentApp ?? '';
    const packageName = phoneState.packageName ?? 'Unknown';
    const focusedDesc = focusedText ? `'${focusedText}'` : "''";

    phoneStateText = `**Current Phone State:**
• **App:** ${currentApp} (${packageName})
• **Keyboard:** ${phoneState.isEditable ? 'Visible' : 'Hidden'}
• **Focused Element:** ${focusedDesc}`;
  } else if (phoneState?.error) {
    phoneStateText = `**Phone State Error:** ${phoneState.message ?? 'Unknown error'}`;
  } else {
    phoneStateText = `**Phone State:** ${JSON.stringify(phoneState)}`;
  }

  // Format UI elements
  let uiElementsText: string;
  if (elements.length) {
    const formatted = formatUiElements(elements);
    uiElementsText =
      "Current visible UI elements on the device (className: resourceId, text - bounds). Use text, resourceId, or className to identify elements for semantic actions:\n" +
      formatted;
  } else {
    uiElementsText =
      "Current visible UI elements on the device:\nNo UI elements found";
  }

  return {
    formattedText: `${phoneStateText}\n\n${uiElementsText}`,
    focusedText,
    elements,
    phoneState,
  };
}
