import dotenv from 'dotenv';
dotenv.config()
import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMSALToken, RequestWithMsalAuth } from './security/auth_handler.js';
import { registerWeatherTools } from './tools/weather.js';

// const roleName = process.env.ROLE_NAME
// if (!roleName) {
//     throw new Error(
//         "ROLE_NAME not defined."
//     )
// }

const tenantId = process.env.TENANT_ID
if (!tenantId) {
    throw new Error(
        "TENANT_ID not defined."
    )
}

const clientId = process.env.CLIENT_ID
if (!clientId) {
    throw new Error(
        "CLIENT_ID not defined."
    )
}

const server = new McpServer({
    name: "weather-server",
    version: "1.0.0",
    capabilites: {
        resources: {},
        tools: {}
    }
});

registerWeatherTools(server);

const app = express();
app.use(express.json());
app.use(buildMSALToken({ tenantId, clientId }).unless({ path: ["/health"] }));

app.post('/mcp', async (req: Request, res: Response) => {
    // In stateless mode, create a new instance of transport and server for each request
    // to ensure complete isolation. A single instance would cause request ID collisions
    // when multiple clients connect concurrently.

    try {
        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        res.on('close', () => {
            console.log('Request closed');
            transport.close();
            server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    } catch (error) {
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
app.get('/mcp', async (req: Request, res: Response) => {
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
app.delete('/mcp', async (req: Request, res: Response) => {
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

app.get("/health", (req: RequestWithMsalAuth, res: Response) => {
    res.send("Hello World, i'm healthy!!");
});

function checkAuthorz(roles: string[] | undefined, roleName: string) {
    if (roles) {
        roles.includes(roleName);
        return true
    } else {
        return false
    }
}

app.listen(3001);