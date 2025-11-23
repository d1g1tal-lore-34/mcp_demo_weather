"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPSSEProxy = void 0;
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
// import {
//     ListToolsRequestSchema,
//     CallToolRequestSchema,
//     ListResourcesRequestSchema,
//     ReadResourceRequestSchema,
//     ListPromptsRequestSchema,
//     GetPromptRequestSchema,
//     ListResourceTemplatesRequestSchema,
// } from "@modelcontextprotocol/sdk/types.js";
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
class MCPSSEProxy {
    sseUrl;
    apiKey;
    appKey;
    serverName;
    client;
    server;
    constructor(server) {
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
        }
        catch (error) {
            throw new Error(`Invalid SSE URL format: ${this.sseUrl} - ${error.message}`);
        }
        // Create the client to connect to the remote SSE server
        this.client = new index_js_1.Client({
            name: "datadog-client",
            version: "1.0.0",
        }, {
            capabilities: {}
        });
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
        const clientTransport = new streamableHttp_js_1.StreamableHTTPClientTransport(urlObject, transportOptions);
        // Connect client to the remote SSE server with better error handling
        console.log(`Attempting to connect to SSE server...`);
        try {
            await this.client.connect(clientTransport);
            console.log(`Successfully connected to SSE server`);
        }
        catch (error) {
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
        if (!this.client || !this.server)
            throw new Error("Client/server not initialized.");
        console.log("Fetching remote tools from client...");
        let raw;
        try {
            raw = await this.client.listTools();
        }
        catch (err) {
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
            const handler = async (args) => {
                try {
                    const callReq = { name, arguments: args ?? {} };
                    const res = await this.client.callTool(callReq);
                    // Normalize wrapped responses
                    if (res && typeof res === "object" && "result" in res)
                        return res.result;
                    return res;
                }
                catch (err) {
                    console.error(`Error forwarding tool call for ${name}:`, err);
                    throw err;
                }
            };
            // Try registering using a descriptor-like API first, then fall back to name+handler signature
            try {
                this.server.registerTool({
                    name,
                    description,
                    parameters,
                    run: handler,
                });
                console.log(`Registered remote tool as local: ${name}`);
            }
            catch (err) {
                try {
                    // Fallback: some servers accept (name, handler)
                    this.server.registerTool(name, handler);
                    console.log(`Registered remote tool (fallback) as local: ${name}`);
                }
                catch (fallbackErr) {
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
}
exports.MCPSSEProxy = MCPSSEProxy;
//# sourceMappingURL=proxy_tools.js.map