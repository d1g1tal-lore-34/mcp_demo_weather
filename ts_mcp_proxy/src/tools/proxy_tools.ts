import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
// import {
//     ListToolsRequestSchema,
//     CallToolRequestSchema,
//     ListResourcesRequestSchema,
//     ReadResourceRequestSchema,
//     ListPromptsRequestSchema,
//     GetPromptRequestSchema,
//     ListResourceTemplatesRequestSchema,
// } from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

export class MCPSSEProxy {
    sseUrl: string;
    apiKey: string;
    appKey: string;
    serverName: string;
    client: Client | null;
    server: McpServer | null;
    constructor(server: McpServer) {
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
        this.setupProxyHandlers();
    }

    // Fetch tools from the remote MCP client and register them on the local server.
    async registerRemoteTools() {
        if (!this.client || !this.server) throw new Error("Client/server not initialized.");

        console.log("Fetching remote tools from client...");
        let raw: any;
        try {
            raw = await this.client.listTools();
        } catch (err) {
            console.error("Error listing remote tools:", err);
            return;
        }

        const tools = Array.isArray(raw)
            ? raw
            : (raw && raw.tools && Array.isArray(raw.tools) ? raw.tools : []);

        console.log(`Remote returned ${tools.length} tools`);

        for (const remoteTool of tools) {
            const name = remoteTool.name ?? remoteTool.id;
            if (!name) {
                console.error("Skipping tool with no name or id:", remoteTool);
                continue;
            }

            const description = remoteTool.description ?? remoteTool.summary ?? "";
            const parameters = remoteTool.parameters ?? remoteTool.schema ?? undefined;

            const handler = async (args: any) => {
                try {
                    const callReq = { name, arguments: args ?? {} } as any;
                    const res = await this.client!.callTool(callReq);
                    // Normalize wrapped responses
                    if (res && typeof res === "object" && "result" in res) return (res as any).result;
                    return res;
                } catch (err) {
                    console.error(`Error forwarding tool call for ${name}:`, err);
                    throw err;
                }
            };

            // Try registering using a descriptor-like API first, then fall back to name+handler signature
            try {
                (this.server as any).registerTool({
                    name,
                    description,
                    parameters,
                    run: handler,
                } as any);
                console.log(`Registered remote tool as local: ${name}`);
            } catch (err) {
                try {
                    // Fallback: some servers accept (name, handler)
                    (this.server as any).registerTool(name, handler);
                    console.log(`Registered remote tool (fallback) as local: ${name}`);
                } catch (fallbackErr) {
                    console.error(`Failed to register tool ${name}:`, fallbackErr);
                }
            }
        }
    }

    setupProxyHandlers() {
        // Proxy tools
        if (!this.server || !this.client) {
            throw new Error("Server or client not initialized, run initialize() first.");
        }

        // Register remote tools as local tools
        this.registerRemoteTools().catch((err) => {
            console.error("Failed to register remote tools:", err);
        });
    }

    //     this.server.setRequestHandler(ListToolsRequestSchema, async () => {
    //       try {
    //         console.error("Attempting to list tools from remote server...");
    //         const result = await this.client.listTools();
    //         console.error("Raw client listTools() result:", JSON.stringify(result, null, 2));

    //         // Validate the result format
    //         if (Array.isArray(result)) {
    //           console.error(`Successfully retrieved ${result.length} tools`);
    //           return { tools: result };
    //         } else if (result && result.tools && Array.isArray(result.tools)) {
    //           // Handle case where client already returns wrapped format
    //           console.error(`Client returned wrapped format with ${result.tools.length} tools`);
    //           return result;
    //         } else {
    //           console.error("Unexpected result format from client.listTools():", typeof result, result);
    //           return { tools: [] };
    //         }
    //       } catch (error) {
    //         console.error("Error listing tools:", error);
    //         console.error("Error details:", error.message, error.stack);
    //         return { tools: [] };
    //       }
    //     });

    //     this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    //       try {
    //         console.error(`Calling tool: ${request.params.name} with args:`, request.params.arguments);
    //         const result = await this.client.callTool(request.params);
    //         console.error("Tool call result:", JSON.stringify(result, null, 2));
    //         return result;
    //       } catch (error) {
    //         console.error("Error calling tool:", error);
    //         throw error;
    //       }
    //     });

    //     // Proxy resources
    //     this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    //       try {
    //         console.error("Attempting to list resources from remote server...");
    //         const result = await this.client.listResources();
    //         console.error("Raw client listResources() result:", JSON.stringify(result, null, 2));

    //         if (Array.isArray(result)) {
    //           console.error(`Successfully retrieved ${result.length} resources`);
    //           return { resources: result };
    //         } else if (result && result.resources && Array.isArray(result.resources)) {
    //           console.error(`Client returned wrapped format with ${result.resources.length} resources`);
    //           return result;
    //         } else {
    //           console.error("Unexpected result format from client.listResources():", typeof result, result);
    //           return { resources: [] };
    //         }
    //       } catch (error) {
    //         console.error("Error listing resources:", error);
    //         console.error("Error details:", error.message, error.stack);
    //         return { resources: [] };
    //       }
    //     });

    //     this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    //       try {
    //         console.error(`Reading resource: ${request.params.uri}`);
    //         const result = await this.client.readResource(request.params);
    //         console.error("Resource read result:", JSON.stringify(result, null, 2));
    //         return result;
    //       } catch (error) {
    //         console.error("Error reading resource:", error);
    //         throw error;
    //       }
    //     });

    //     // Proxy resource templates
    //     this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
    //       try {
    //         console.error("Attempting to list resource templates from remote server...");
    //         const result = await this.client.listResourceTemplates();
    //         console.error("Raw client listResourceTemplates() result:", JSON.stringify(result, null, 2));

    //         if (Array.isArray(result)) {
    //           console.error(`Successfully retrieved ${result.length} resource templates`);
    //           return { resourceTemplates: result };
    //         } else if (result && result.resourceTemplates && Array.isArray(result.resourceTemplates)) {
    //           console.error(`Client returned wrapped format with ${result.resourceTemplates.length} resource templates`);
    //           return result;
    //         } else {
    //           console.error("Unexpected result format from client.listResourceTemplates():", typeof result, result);
    //           return { resourceTemplates: [] };
    //         }
    //       } catch (error) {
    //         console.error("Error listing resource templates:", error);
    //         console.error("Error details:", error.message, error.stack);
    //         return { resourceTemplates: [] };
    //       }
    //     });

    //     // Proxy prompts
    //     this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
    //       try {
    //         console.error("Attempting to list prompts from remote server...");
    //         const result = await this.client.listPrompts();
    //         console.error("Raw client listPrompts() result:", JSON.stringify(result, null, 2));

    //         if (Array.isArray(result)) {
    //           console.error(`Successfully retrieved ${result.length} prompts`);
    //           return { prompts: result };
    //         } else if (result && result.prompts && Array.isArray(result.prompts)) {
    //           console.error(`Client returned wrapped format with ${result.prompts.length} prompts`);
    //           return result;
    //         } else {
    //           console.error("Unexpected result format from client.listPrompts():", typeof result, result);
    //           return { prompts: [] };
    //         }
    //       } catch (error) {
    //         console.error("Error listing prompts:", error);
    //         console.error("Error details:", error.message, error.stack);
    //         return { prompts: [] };
    //       }
    //     });

    //     this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    //       try {
    //         console.error(`Getting prompt: ${request.params.name} with args:`, request.params.arguments);
    //         const result = await this.client.getPrompt(request.params);
    //         console.error("Prompt get result:", JSON.stringify(result, null, 2));
    //         return result;
    //       } catch (error) {
    //         console.error("Error getting prompt:", error);
    //         throw error;
    //       }
    //     });
    //   }

    //   async run() {
    //     // Initialize the proxy
    //     await this.initialize();

    //     // Create stdio transport for the server
    //     const transport = new StdioServerTransport();

    //     // Connect and run the server
    //     await this.server.connect(transport);

    //     console.error(`MCP SSE Proxy "${this.serverName}" running - connecting to ${this.sseUrl}`);
    //   }

    //   async close() {
    //     if (this.client) {
    //       await this.client.close();
    //     }
    //     if (this.server) {
    //       await this.server.close();
    //     }
    //   }
}