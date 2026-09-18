"""Detailed filtering - all logic self-contained."""

from typing import Any, Dict, Optional

from droiduse_backend.tools.filters.base import TreeFilter


class DetailedFilter(TreeFilter):
    """Detailed tree filtering with 10% visibility rule."""

    def __init__(
        self,
        visibility_threshold: float = 0.1,
        filter_keyboard: bool = True,
        clip_bounds: bool = False,
    ):
        self.visibility_threshold = visibility_threshold
        self.filter_keyboard = filter_keyboard
        self.clip_bounds = clip_bounds

    def filter(
        self, a11y_tree: Dict[str, Any], device_context: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Filter using detailed logic."""
        screen_bounds = device_context.get("screen_bounds", {})
        screen_width = screen_bounds.get("width", 1080)
        screen_height = screen_bounds.get("height", 2400)

        filtered_tree = a11y_tree

        if self.clip_bounds:
            filtered_tree = self._clip_tree_bounds(filtered_tree, screen_width, screen_height)

        if self.filter_keyboard:
            filtered_tree = self._filter_keyboard_elements(filtered_tree)
            if filtered_tree is None:
                return None

        filtered_tree = self._filter_out_of_bounds(filtered_tree, screen_width, screen_height)

        return filtered_tree

    @staticmethod
    def _get_visible_percentage(
        bounds: Dict[str, int], screen_width: int, screen_height: int
    ) -> float:
        """Calculate what percentage of element is visible on screen.

        Supports both compact {l, t, r, b} and legacy {left, top, right, bottom} field names.
        """
        # Support both compact and legacy field names
        left = bounds.get("l") or bounds.get("left", 0)
        top = bounds.get("t") or bounds.get("top", 0)
        right = bounds.get("r") or bounds.get("right", 0)
        bottom = bounds.get("b") or bounds.get("bottom", 0)

        width = right - left
        height = bottom - top

        if width == 0 and height == 0:
            return 0.0

        overflow = left <= 0 and top <= 0 and right >= screen_width and bottom >= screen_height
        if overflow:
            return 1.0

        visible_x = max(0, min(right, screen_width) - max(left, 0))
        visible_y = max(0, min(bottom, screen_height) - max(top, 0))

        visible_area = visible_x * visible_y
        total_area = width * height

        return visible_area / total_area if total_area > 0 else 0.0

    @staticmethod
    def _clip_bounds_to_screen(
        bounds: Dict[str, int], screen_width: int, screen_height: int
    ) -> Dict[str, int]:
        """Clip element bounds to screen boundaries.

        Preserves the field name format used in input (compact or legacy).
        """
        # Determine if using compact or legacy format
        is_compact = "l" in bounds

        # Support both compact and legacy field names
        left = bounds.get("l") or bounds.get("left", 0)
        top = bounds.get("t") or bounds.get("top", 0)
        right = bounds.get("r") or bounds.get("right", 0)
        bottom = bounds.get("b") or bounds.get("bottom", 0)

        if is_compact:
            return {
                "l": max(left, 0),
                "t": max(top, 0),
                "r": min(right, screen_width),
                "b": min(bottom, screen_height),
            }
        else:
            return {
                "left": max(left, 0),
                "top": max(top, 0),
                "right": min(right, screen_width),
                "bottom": min(bottom, screen_height),
            }

    @classmethod
    def _clip_tree_bounds(
        cls, node: Dict[str, Any], screen_width: int, screen_height: int
    ) -> Dict[str, Any]:
        """Recursively clip all bounds in tree to screen.

        Supports both compact (b, ch) and legacy (boundsInScreen, children) field names.
        """
        node = {**node}

        # Support both compact (b) and legacy (boundsInScreen) field names
        if "b" in node:
            node["b"] = cls._clip_bounds_to_screen(node["b"], screen_width, screen_height)
        elif "boundsInScreen" in node:
            node["boundsInScreen"] = cls._clip_bounds_to_screen(
                node["boundsInScreen"], screen_width, screen_height
            )

        # Support both compact (ch) and legacy (children) field names
        children_key = "ch" if "ch" in node else "children"
        if children_key in node:
            node[children_key] = [
                cls._clip_tree_bounds(child, screen_width, screen_height)
                for child in node[children_key]
            ]

        return node

    @staticmethod
    def _should_filter_keyboard(node: Dict[str, Any]) -> bool:
        """Check if element is from Google keyboard.

        Supports both compact (rid) and legacy (resourceId) field names.
        """
        # Support both compact (rid) and legacy (resourceId) field names
        resource_id = node.get("rid") or node.get("resourceId", "")
        return resource_id.startswith("com.google.android.inputmethod.latin:id/")

    @classmethod
    def _filter_keyboard_elements(cls, node: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Recursively remove keyboard elements from tree.

        Supports both compact (ch) and legacy (children) field names.
        """
        # Support both compact (ch) and legacy (children) field names
        children = node.get("ch") or node.get("children", [])
        filtered_children = []
        for child in children:
            filtered_child = cls._filter_keyboard_elements(child)
            if filtered_child is not None:
                filtered_children.append(filtered_child)

        if cls._should_filter_keyboard(node):
            return None

        # Preserve the original field name used in the input
        children_key = "ch" if "ch" in node else "children"
        return {**node, children_key: filtered_children}

    def _filter_out_of_bounds(
        self, node: Dict[str, Any], screen_width: int, screen_height: int
    ) -> Optional[Dict[str, Any]]:
        """Filter tree by visibility with parent preservation.

        Supports both compact (b, ch) and legacy (boundsInScreen, children) field names.
        """
        if node.get("ignoreBoundsFiltering") == "true":
            return node

        # Support both compact (ch) and legacy (children) field names
        children = node.get("ch") or node.get("children", [])
        filtered_children = []
        for child in children:
            filtered_child = self._filter_out_of_bounds(child, screen_width, screen_height)
            if filtered_child is not None:
                filtered_children.append(filtered_child)

        # Support both compact (b) and legacy (boundsInScreen) field names
        bounds = node.get("b") or node.get("boundsInScreen")
        if bounds is None:
            visible_percentage = 0.0
        else:
            visible_percentage = self._get_visible_percentage(bounds, screen_width, screen_height)

        if visible_percentage < self.visibility_threshold and not filtered_children:
            return None

        # Preserve the original field name used in the input
        children_key = "ch" if "ch" in node else "children"
        return {**node, children_key: filtered_children}

    def get_name(self) -> str:
        """Return filter name."""
        return "detailed"
