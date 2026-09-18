"""
StructuredOutputAgent - Extract structured data from final answers.

Takes a raw text answer and a Pydantic model, uses structured_predict()
to extract structured data from the text.
"""

import logging
from typing import Type

from pydantic import BaseModel

from droiduse_backend.agent.utils.inference import astructured_predict_with_retries
from droiduse_backend.agent.utils.litellm_adapter import LiteLLMClient
from droiduse_backend.workflow import Context, StartEvent, StopEvent, Workflow, step

logger = logging.getLogger("androiduse")


class StructuredOutputAgent(Workflow):
    """
    Agent that extracts structured output from text answers.

    Uses LLM.structured_predict() to parse text into Pydantic models.
    """

    def __init__(
        self,
        llm: LiteLLMClient,
        pydantic_model: Type[BaseModel],
        answer_text: str,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.llm = llm
        self.pydantic_model = pydantic_model
        self.answer_text = answer_text

    @step
    async def extract_structured_output(self, ctx: Context, ev: StartEvent) -> StopEvent:
        """
        Extract structured output using structured_predict().
        """
        logger.debug("🔍 Extracting structured output from final answer...")

        try:
            # Create prompt for extraction
            prompt = "Extract structured information from the following text:\n\n{text}"

            # Use structured_predict to extract data
            logger.info("[bright_magenta]🔍 StructuredOutput response:[/bright_magenta]")
            structured_output = await astructured_predict_with_retries(
                self.llm,
                self.pydantic_model,
                prompt,
                agent_type="structured_output",
                text=self.answer_text,
            )

            logger.debug("✅ Successfully extracted structured output")

            return StopEvent(
                result={
                    "structured_output": structured_output,
                    "success": True,
                    "error_message": "",
                }
            )

        except Exception as e:
            logger.error(f"❌ Failed to extract structured output: {e}")

            return StopEvent(
                result={
                    "structured_output": None,
                    "success": False,
                    "error_message": str(e),
                }
            )
