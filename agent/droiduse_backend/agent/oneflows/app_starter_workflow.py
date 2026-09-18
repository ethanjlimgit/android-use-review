"""
Simple workflow to open an app based on a description.
"""

import json
import logging

from droiduse_backend.agent.utils.inference import acall_with_retries
from droiduse_backend.tools.tools import Tools
from droiduse_backend.workflow import Context, StartEvent, StopEvent, Workflow, step

logger = logging.getLogger("androiduse")


class AppStarter(Workflow):
    """
    A simple workflow that opens an app based on a description.

    The workflow uses an LLM to intelligently match the app description
    to an installed app's package name, then opens it.
    """

    def __init__(self, tools: Tools, llm, timeout: int = 60, stream: bool = False, **kwargs):
        """
        Initialize the OpenAppWorkflow.

        Args:
            tools: An instance of Tools (e.g., AdbTools) to interact with the device
            llm: An LLM instance (e.g., OpenAI) to determine which app to open
            timeout: Workflow timeout in seconds (default: 60)
            stream: If True, stream LLM response to console in real-time
            **kwargs: Additional arguments passed to Workflow
        """
        super().__init__(timeout=timeout, **kwargs)
        self.tools = tools
        self.llm = llm
        self.stream = stream

    @step
    async def open_app_step(self, ctx: Context, ev: StartEvent) -> StopEvent:
        """
        Opens an app based on the provided description.

        Expected StartEvent attributes:
            - app_description (str): The name or description of the app to open

        Returns:
            StopEvent with the result of the open_app operation
        """
        app_description = ev.app_description

        # Get list of installed apps
        apps = await self.tools.get_apps(include_system=True)

        # Format apps list for LLM
        apps_list = "\n".join(
            [
                f"- {app['label']} (package: {app['package_name'] if 'package_name' in app else app['package']})"
                for app in apps
            ]
        )

        # Construct prompt for LLM
        prompt = f"""Given the following list of installed apps and a user's description, determine which app package name to open.

Installed Apps:
{apps_list}

User's Request: "{app_description}"

Return ONLY a JSON object with the following structure:
{{
    "package": "com.example.package"
}}

Choose the most appropriate app based on the description. Return the package name of the best match."""

        logger.debug(f"Prompt: {prompt}")

        # Get LLM response
        logger.debug("[blue]📱 AppOpener response:[/blue]")
        messages = [{"role": "user", "content": [{"text": prompt}]}]
        response = await acall_with_retries(
            self.llm, messages, stream=False, agent_type="app_opener"
        )
        response_text = response.content.strip()

        # Parse JSON response - extract content between { and }
        try:
            start = response_text.find("{")
            end = response_text.rfind("}") + 1
            json_str = response_text[start:end]
            result_json = json.loads(json_str)
            package_name = result_json["package"]
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            return StopEvent(result=f"Error parsing LLM response: {e}. Response: {response_text}")

        logger.info(f"Starting app {package_name}")
        result = await self.tools.start_app(package_name)

        return StopEvent(result=result)


# Example usage
async def main():
    """
    Example of how to use the OpenAppWorkflow.

    NOTE: TcpClientTool has been removed. This example is no longer functional.
    Use WebSocketConnectionTool with the WebSocket server instead.
    """
    raise NotImplementedError(
        "TcpClientTool has been removed. "
        "Use WebSocketConnectionTool with the WebSocket server instead."
    )


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
