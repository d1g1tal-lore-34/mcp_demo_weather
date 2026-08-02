import dotenv from 'dotenv';
dotenv.config()
import { NextFunction, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createEntraTokenVerifier } from './security/auth_handler.js';
import { checkAuthorz } from './auth.js';
import { registerTools } from './tools/toolsIndex.js';

const roleName = process.env.ROLE_NAME
if (!roleName) {
    throw new Error(
        "ROLE_NAME not defined."
    )
}

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

const server = new McpServer(
    { name: "weather-server", version: "1.0.0" },
    { capabilities: { resources: {}, tools: {} } }
);

const app = createMcpExpressApp();

app.get("/health", (req, res: Response) => {
    res.send("Hello World, i'm healthy!!");
});

app.use(requireBearerAuth({
    verifier: createEntraTokenVerifier({ tenantId, clientId }),
}));

app.use((req, res: Response, next: NextFunction) => {
    if ( !checkAuthorz(req.auth?.scopes, roleName) ) {
        res.status(401).send(`Your not authorized to access this endpoint. Your current role is ${req.auth?.scopes}`)
        return;
    }

    next();
});

app.post('/mcp', async (req: Request, res: Response) => {
    try {
        const transport: StreamableHTTPServerTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on('close', () => {
            console.log('Request closed');
            transport.close();
        });
    } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
            res.status(500).json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: 'Internal server error'
                },
                id: null
            });
        }
    }
});

app.get('/mcp', async (req: Request, res: Response) => {
    console.log('Received GET MCP request');
    res.writeHead(405).end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method not allowed.'
            },
            id: null
        })
    );
});

app.delete('/mcp', async (req: Request, res: Response) => {
    console.log('Received DELETE MCP request');
    res.writeHead(405).end(
        JSON.stringify({
            jsonrpc: '2.0',
            error: {
                code: -32000,
                message: 'Method not allowed.'
            },
            id: null
        })
    );
});

registerTools(server);

app.listen(3001);
