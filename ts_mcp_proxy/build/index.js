"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const proxy_tools_js_1 = require("./tools/proxy_tools.js");
// import { registerWeatherTools } from './tools/weather.js';
// const tenantId = process.env.TENANT_ID
// if (!tenantId) {
//     throw new Error(
//         "TENANT_ID not defined."
//     )
// }
// const clientId = process.env.CLIENT_ID
// if (!clientId) {
//     throw new Error(
//         "CLIENT_ID not defined."
//     )
// }
const server = new mcp_js_1.McpServer({
    name: "datadog-proxy-server",
    version: "1.0.0"
});
const ddProxy = new proxy_tools_js_1.MCPSSEProxy(server);
ddProxy.initialize();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// app.use(buildMSALToken({ tenantId, clientId }).unless({ path: ["/health"] }));
app.post('/mcp', async (req, res) => {
    // In stateless mode, create a new instance of transport and server for each request
    // to ensure complete isolation. A single instance would cause request ID collisions
    // when multiple clients connect concurrently.
    try {
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        res.on('close', () => {
            console.log('Request closed');
            transport.close();
            server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    }
    catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error',
                },
                id: null,
            });
        }
    }
});
// SSE notifications not supported in stateless mode
app.get('/mcp', async (req, res) => {
    console.log('Received GET MCP request');
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});
// Session termination not needed in stateless mode
app.delete('/mcp', async (req, res) => {
    console.log('Received DELETE MCP request');
    res.writeHead(405).end(JSON.stringify({
        jsonrpc: "2.0",
        error: {
            code: -32000,
            message: "Method not allowed."
        },
        id: null
    }));
});
app.get("/health", (req, res) => {
    res.send("Hello World, i'm healthy!!");
});
function checkAuthorz(roles, roleName) {
    if (roles) {
        roles.includes(roleName);
        return true;
    }
    else {
        return false;
    }
}
app.listen(3001);
//# sourceMappingURL=index.js.map