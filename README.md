Basic AI Chat

Need ollama locally running on http://localhost:11434 with model `qwen3.5:latest`
Need MCP server running on http://localhost:5000 if you want it to use his tools

OAuth2 login via Auth0 (bearer token sent to protected MCP)

Login then chat with model in whatever language, ask him "give me the meteo alert in Los Angeles" and he should reply after calling the MCP to retrieve info from us gov api

You can personnalize the prompt reply persona in `system-prompt.txt`
