import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
    ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export class MCPSSEProxy {
    sseUrl: string;
    apiKey: string;
    appKey: string;
    serverName: string;
    client: Client | null;
    server: Server | null;
    constructor(server: Server) {
        this.sseUrl = process.env.MCP_SERVER_URL || "";
        this.apiKey = process.env.API_KEY || "";
        this.appKey = process.env.APP_KEY || "";
        this.serverName = "Datadog MCP Proxy";
        this.client = null;
        this.server = server;
    }

    async initialize() {
        // Validate the SSE URL format
        try {
            const url = new URL(this.sseUrl);
            console.log(`Connecting to SSE endpoint: ${this.sseUrl}`);
            console.log(`URL components - protocol: ${url.protocol}, host: ${url.host}, pathname: ${url.pathname}`);
        } catch (error: any) {
            throw new Error(`Invalid SSE URL format: ${this.sseUrl} - ${error.message}`);
        }

        // Create the client to connect to the remote SSE server
        this.client = new Client(
            {
                name: "datadog-client",
                version: "1.0.0",
            },
            {
                capabilities: {}
            }
        );

        // Create the SSE transport for the client
        // The SSEClientTransport expects a URL object, not a string
        console.log(`Creating SSEClientTransport with URL: ${this.sseUrl}`);
        const urlObject = new URL(this.sseUrl);

        // Configure transport options with authentication if provided
        const transportOptions = {
            requestInit: {
                headers: {
                    'DD-API-KEY': this.apiKey,
                    'DD-APPLICATION-KEY': this.appKey
                }
            }
        };

        const clientTransport = new StreamableHTTPClientTransport(urlObject, transportOptions);

        // Connect client to the remote SSE server with better error handling
        console.log(`Attempting to connect to SSE server...`);
        try {
            await this.client.connect(clientTransport);
            console.log(`Successfully connected to SSE server`);
        } catch (error: any) {
            console.error(`Failed to connect to SSE server:`, error);
            if (error.stack) {
                console.error(`Stack trace:`, error.stack);
            }
            throw error;
        }

        // Set up proxy handlers
        await this.setupProxyHandlers();
    }

    async setupProxyHandlers() {
        // Proxy tools
        if (!this.server || !this.client) {
            throw new Error("Server or client not initialized, run initialize() first.");
        } else {
            console.log("Fetching remote tools from client...");
            let raw: any;
            try {
                raw = await this.client.listTools();
                this.server.setRequestHandler(ListToolsRequestSchema, async () => {
                    try {
                        console.log("Attempting to list tools from remote server...");
                        const result = await this.client!.listTools();
                        console.log("Raw client listTools() result:", JSON.stringify(result, null, 2));

                        // Validate the result format
                        if (Array.isArray(result)) {
                            console.log(`Successfully retrieved ${result.length} tools`);
                            return { tools: result };
                        } else if (result && result.tools && Array.isArray(result.tools)) {
                            // Handle case where client already returns wrapped format
                            console.log(`Client returned wrapped format with ${result.tools.length} tools`);
                            return result;
                        } else {
                            console.error("Unexpected result format from client.listTools():", typeof result, result);
                            return { tools: [] };
                        }
                    } catch (error: any) {
                        console.error("Error listing tools:", error);
                        console.error("Error details:", error.message, error.stack);
                        return { tools: [] };
                    }
                });

                this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
                    try {
                        console.log(`Calling tool: ${request.params.name} with args:`, request.params.arguments);
                        const result = await this.client!.callTool(request.params);
                        console.log("Tool call result:", JSON.stringify(result, null, 2));
                        return result;
                    } catch (error: any) {
                        console.error("Error listing tools:", error);
                        console.error("Error details:", error.message, error.stack);
                        throw error;
                    }
                });

                console.log(`Fetched ${raw.tools.length} tools from remote server.`);
            } catch (err) {
                console.error("Error listing and registrying remote tools:", err);
                return;
            }
        }
    }
}