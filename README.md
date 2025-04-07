# Overview
This example application focuses on showcasing a MCP Server protected by [oAuth2.0 OBO](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow) via Azure Entra.

Following example are referenced as part of this example:
- [Model Context Protocol Server Guide](https://modelcontextprotocol.io/quickstart/server)
- [HTTP with SSE](https://github.com/modelcontextprotocol/typescript-sdk?tab=readme-ov-file#http-with-sse)

# Preperation

## Package Installation
```
npm install
```

## Environment Setup
Ensure you populate the following environment variables:
| Name | Description |
|------|-------------|
| TENANT_ID | Azure Entra Tenant ID |
| CLIENT_ID | Azure Application Registration Applicaition (Client) ID|
| ROLE_NAME | Azure Entra User Role name assigned to user| 