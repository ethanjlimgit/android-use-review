"""
DroidUse Backend CLI - Command line interface for the backend service.
"""

import asyncio
import logging
import os
import sys
import warnings

import click
from rich.console import Console

from droiduse_backend.config_manager import AndroidUseConfig

# Suppress warnings
warnings.filterwarnings("ignore")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["GRPC_ENABLE_FORK_SUPPORT"] = "false"

console = Console()


def configure_logging(debug: bool = False):
    """Configure logging for the CLI."""
    logger = logging.getLogger("droiduse-backend")
    logger.handlers = []

    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(levelname)s %(name)s %(message)s" if debug else "%(message)s", "%H:%M:%S"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG if debug else logging.INFO)
    logger.propagate = False

    return logger


@click.group()
@click.version_option(version="0.5.0", prog_name="droiduse-backend")
def cli():
    """DroidUse Backend - Device automation service."""
    pass


@cli.command()
@click.option("--host", default="0.0.0.0", help="Host to bind the server to")
@click.option("--port", default=8000, help="Port to bind the server to")
@click.option("--admin-port", default=8001, help="Port for admin API server")
@click.option("--enable-admin", is_flag=True, help="Enable admin API server")
@click.option("--debug", is_flag=True, help="Enable debug logging (shows all client messages)")
@click.option(
    "--config",
    "-c",
    help="Path to config file (will merge with base config.yaml, only overwriting specified entries)",
)
def serve(host: str, port: int, admin_port: int, enable_admin: bool, debug: bool, config: str):
    """Start the WebSocket backend server."""
    from droiduse_backend.api.websocket_server import WebSocketServer

    # Configure logging based on debug flag
    logger = configure_logging(debug=debug)

    console.print(f"[green]Starting DroidUse WebSocket server on {host}:{port}[/green]")
    console.print(f"[yellow]Phone should connect to ws://{host}:{port}[/yellow]")
    if debug:
        console.print("[cyan]Debug mode enabled - all client messages will be logged[/cyan]")

    if enable_admin:
        console.print(f"[green]Admin API will be available on http://{host}:{admin_port}[/green]")

    try:
        server = WebSocketServer(override_config_path=config)

        if enable_admin:
            # Start both servers concurrently
            from droiduse_backend.api.admin_server import AdminServer

            async def run_servers():
                admin_server = AdminServer(websocket_server=server, config=server.config)

                # Run both servers concurrently
                import asyncio

                await asyncio.gather(
                    server.start(host=host, port=port),
                    admin_server.start(host=host, port=admin_port),
                )

            asyncio.run(run_servers())
        else:
            asyncio.run(server.start(host=host, port=port))
    except KeyboardInterrupt:
        console.print("\n[yellow]Server stopped[/yellow]")


@cli.command()
@click.option("--host", default="0.0.0.0", help="Host to bind the admin server to")
@click.option("--port", default=8001, help="Port to bind the admin server to")
@click.option("--config", "-c", help="Path to configuration file")
def serve_admin(host: str, port: int, config: str):
    """Start the admin API server only."""
    from droiduse_backend.api.admin_server import AdminServer

    logger = configure_logging(debug=False)

    console.print(f"[green]Starting DroidUse Admin API server on http://{host}:{port}[/green]")
    console.print(
        "[yellow]Note: WebSocket server is not running. Some endpoints may not work.[/yellow]"
    )

    try:
        # Load config if provided
        from droiduse_backend.config_manager import AndroidUseConfig

        if config:
            cfg = AndroidUseConfig.from_yaml(config)
        else:
            cfg = AndroidUseConfig()

        admin_server = AdminServer(config=cfg)
        asyncio.run(admin_server.start(host=host, port=port))
    except KeyboardInterrupt:
        console.print("\n[yellow]Admin server stopped[/yellow]")


@cli.command()
@click.option("--config", "-c", help="Path to configuration file")
def validate_config(config: str):
    """Validate the configuration file."""
    try:
        if config:
            cfg = AndroidUseConfig.from_yaml(config)
        else:
            cfg = AndroidUseConfig.from_yaml("droiduse_backend/config.yaml")

        console.print("[green]✓ Configuration is valid[/green]")
        console.print(
            f"API Keys configured: {bool(cfg.api_keys.anthropic_api_key or cfg.api_keys.google_api_key)}"
        )
    except Exception as e:
        console.print(f"[red]✗ Configuration error: {e}[/red]")
        sys.exit(1)


@cli.command()
def info():
    """Display information about the backend service."""
    console.print("[bold]DroidUse Backend[/bold]")
    console.print("Version: 0.5.0")
    console.print(f"Python: {sys.version.split()[0]}")
    console.print("\n[bold]Available Commands:[/bold]")
    console.print("  serve          - Start the WebSocket server (phone connects to backend)")
    console.print("  validate-config - Validate configuration")
    console.print("  test-llm       - Test LLM configuration and connectivity")
    console.print("  info           - Show this information")


@cli.command()
@click.option("--config", "-c", help="Path to configuration file")
@click.option("--profile", "-p", help="Test specific profile (default: all profiles)")
@click.option("--verbose", "-v", is_flag=True, help="Show detailed response from LLM")
def test_llm(config: str, profile: str, verbose: bool):
    """Test LLM configuration and send a test request."""
    from droiduse_backend.agent.utils.llm_picker import load_llms_from_profiles

    try:
        # Load configuration
        if config:
            cfg = AndroidUseConfig.from_yaml(config)
            console.print(f"[green]✓ Loaded configuration from {config}[/green]")
        else:
            try:
                cfg = AndroidUseConfig.from_yaml("droiduse_backend/config.yaml")
                console.print(
                    "[green]✓ Loaded configuration from droiduse_backend/config.yaml[/green]"
                )
            except FileNotFoundError:
                console.print("[yellow]No config file found, using default configuration[/yellow]")
                cfg = AndroidUseConfig()

        console.print()

        # Determine which profiles to test
        if profile:
            if profile not in cfg.llm_profiles:
                console.print(f"[red]✗ Profile '{profile}' not found[/red]")
                console.print(f"Available profiles: {', '.join(cfg.llm_profiles.keys())}")
                sys.exit(1)
            profiles_to_test = [profile]
        else:
            profiles_to_test = list(cfg.llm_profiles.keys())

        console.print(
            f"[bold]Testing {len(profiles_to_test)} profile(s):[/bold] {', '.join(profiles_to_test)}\n"
        )

        # Load LLMs
        try:
            llms = load_llms_from_profiles(
                cfg.llm_profiles, profile_names=profiles_to_test, config=cfg
            )
        except Exception as e:
            console.print(f"[red]✗ Failed to load LLMs: {e}[/red]")
            sys.exit(1)

        # Test each LLM
        async def test_llm_connectivity():
            test_message = [
                {
                    "role": "user",
                    "content": [{"text": "Reply with only the word 'Hello' and nothing else."}],
                }
            ]

            results = []
            for profile_name, llm in llms.items():
                console.print(f"[cyan]Testing {profile_name}:[/cyan]")
                console.print(f"  Provider: {llm.provider}")
                console.print(f"  Model: {llm.model}")

                try:
                    response = await llm.achat(test_message)
                    results.append((profile_name, True, response))
                    console.print("  [green]✓ Success[/green]")
                    if verbose:
                        console.print(f"  Response: {response.content}")
                    if response.usage:
                        console.print(
                            f"  Tokens: {response.usage.prompt_tokens} prompt + {response.usage.completion_tokens} completion = {response.usage.total_tokens} total"
                        )
                except Exception as e:
                    results.append((profile_name, False, str(e)))
                    console.print(f"  [red]✗ Failed: {e}[/red]")

                console.print()

            return results

        # Run async tests
        results = asyncio.run(test_llm_connectivity())

        # Summary
        success_count = sum(1 for _, success, _ in results if success)
        console.print("[bold]Summary:[/bold]")
        console.print(f"  Total: {len(results)}")
        console.print(f"  [green]Passed: {success_count}[/green]")
        console.print(f"  [red]Failed: {len(results) - success_count}[/red]")

        # Exit with error code if any test failed
        if success_count < len(results):
            sys.exit(1)

    except Exception as e:
        console.print(f"[red]✗ Error: {e}[/red]")
        import traceback

        if verbose:
            console.print(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    cli()
