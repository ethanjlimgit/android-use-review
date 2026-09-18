"""Indexed formatter - Standard AndroidUse format."""

from typing import Any, Dict, List, Optional, Tuple

from droiduse_backend.tools.formatters.base import TreeFormatter


class IndexedFormatter(TreeFormatter):
    """Format tree in the standard AndroidUse format."""

    def format(
        self, filtered_tree: Optional[Dict[str, Any]], phone_state: Dict[str, Any]
    ) -> Tuple[str, str, List[Dict[str, Any]], Dict[str, Any]]:
        """Format device state with indices and hierarchy."""
        focused_text = self._get_focused_text(phone_state)

        if filtered_tree is None:
            a11y_tree = []
        else:
            a11y_tree = self._flatten_with_index(filtered_tree, [1])

        phone_state_text = self._format_phone_state(phone_state)
        ui_elements_text = self._format_ui_elements_text(a11y_tree)

        formatted_text = f"{phone_state_text}\n\n{ui_elements_text}"

        return (formatted_text, focused_text, a11y_tree, phone_state)

    @staticmethod
    def _get_focused_text(phone_state: Dict[str, Any]) -> str:
        """Extract focused element text."""
        focused_element = phone_state.get("focusedElement")
        if focused_element:
            return focused_element.get("text", "")
        return ""

    @staticmethod
    def _format_phone_state(phone_state: Dict[str, Any]) -> str:
        """Format phone state."""
        if isinstance(phone_state, dict) and "error" not in phone_state:
            current_app = phone_state.get("currentApp", "")
            package_name = phone_state.get("packageName", "Unknown")
            focused_element = phone_state.get("focusedElement")
            is_editable = phone_state.get("isEditable", False)

            if focused_element and focused_element.get("text"):
                focused_desc = f"'{focused_element.get('text', '')}'"
            else:
                focused_desc = "''"

            phone_state_text = f"""**Current Phone State:**
• **App:** {current_app} ({package_name})
• **Keyboard:** {"Visible" if is_editable else "Hidden"}
• **Focused Element:** {focused_desc}"""
        else:
            if isinstance(phone_state, dict) and "error" in phone_state:
                phone_state_text = (
                    f"📱 **Phone State Error:** {phone_state.get('message', 'Unknown error')}"
                )
            else:
                phone_state_text = f"📱 **Phone State:** {phone_state}"

        return phone_state_text

    @staticmethod
    def _format_ui_elements_text(a11y_tree: List[Dict[str, Any]]) -> str:
        """Format UI elements text."""
        if a11y_tree:
            formatted_ui = IndexedFormatter._format_ui_elements(a11y_tree)
            ui_elements_text = (
                "Current Clickable UI elements from the device in the schema "
                "'index. className: resourceId, text - bounds(x1,y1,x2,y2)':\n"
                f"{formatted_ui}"
            )
        else:
            ui_elements_text = (
                "Current Clickable UI elements from the device in the schema "
                "'index. className: resourceId, text - bounds(x1,y1,x2,y2)':\n"
                "No UI elements found"
            )
        return ui_elements_text

    @staticmethod
    def _format_ui_elements(ui_data: List[Dict[str, Any]], level: int = 0) -> str:
        """Format UI elements."""
        if not ui_data:
            return ""

        formatted_lines = []
        indent = "  " * level

        elements = ui_data if isinstance(ui_data, list) else [ui_data]

        for element in elements:
            if not isinstance(element, dict):
                continue

            index = element.get("index", "")
            class_name = element.get("className", "")
            resource_id = element.get("resourceId", "")
            text = element.get("text", "")
            bounds = element.get("bounds", "")
            children = element.get("children", [])

            line_parts = []
            if index != "":
                line_parts.append(f"{index}.")
            if class_name:
                line_parts.append(class_name + ":")

            details = []
            if resource_id:
                details.append(f'"{resource_id}"')
            if text:
                details.append(f'"{text}"')

            if details:
                line_parts.append(", ".join(details))

            if bounds:
                line_parts.append(f"- ({bounds})")

            formatted_line = f"{indent}{' '.join(line_parts)}"
            formatted_lines.append(formatted_line)

            if children:
                child_formatted = IndexedFormatter._format_ui_elements(children, level + 1)
                if child_formatted:
                    formatted_lines.append(child_formatted)

        return "\n".join(formatted_lines)

    def _flatten_with_index(self, node: Dict[str, Any], counter: List[int]) -> List[Dict[str, Any]]:
        """Recursively flatten tree with index assignment.

        Supports both compact (ch) and legacy (children) field names.
        """
        results = []

        formatted = self._format_node(node, counter[0])
        results.append(formatted)
        counter[0] += 1

        # Support both compact (ch) and legacy (children) field names
        children = node.get("ch") or node.get("children", [])
        for child in children:
            results.extend(self._flatten_with_index(child, counter))

        return results

    @staticmethod
    def _format_node(node: Dict[str, Any], index: int) -> Dict[str, Any]:
        """Format single node to AndroidUse format.

        Supports both compact field names (rid, cls, txt, desc, b) and
        legacy field names (resourceId, className, text, contentDescription, boundsInScreen).
        """
        # Support both compact (b) and legacy (boundsInScreen) field names
        bounds = node.get("b") or node.get("boundsInScreen", {})

        # Support both compact and legacy field names with fallback chain
        text = (
            node.get("txt")  # Compact text field
            or node.get("text")  # Legacy text field
            or node.get("desc")  # Compact contentDescription
            or node.get("contentDescription")  # Legacy contentDescription
            or node.get("rid")  # Compact resourceId
            or node.get("resourceId")  # Legacy resourceId
            or node.get("cls")  # Compact className
            or node.get("className", "")  # Legacy className
        )

        # Support both compact (cls) and legacy (className) field names
        class_name = node.get("cls") or node.get("className", "")
        short_class = class_name.split(".")[-1] if class_name else ""

        # Support both compact (rid) and legacy (resourceId) field names
        resource_id = node.get("rid") or node.get("resourceId", "")

        # Bounds can be in compact format {l, t, r, b} or legacy format {left, top, right, bottom}
        left = bounds.get("l") or bounds.get("left", 0)
        top = bounds.get("t") or bounds.get("top", 0)
        right = bounds.get("r") or bounds.get("right", 0)
        bottom = bounds.get("b") or bounds.get("bottom", 0)

        return {
            "index": index,
            "resourceId": resource_id,
            "className": short_class,
            "text": text,
            "bounds": f"{left},{top},{right},{bottom}",
            "children": [],
        }
