import dotenv from 'dotenv';
dotenv.config()
import { NextFunction, Request, Response } from "express";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpExpressApp, requireBearerAuth } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createEntraTokenVerifier } from './security/auth_handler.js';
import { checkAuthorz } from './auth.js';
import { createWeatherServer } from './server.js';
import { setNotifyToolsChanged } from './tools/toolRegistry.js';

// const roleName = process.env.ROLE_NAME
// if (!roleName) {
//     throw new Error(
//         "ROLE_NAME not defined."
//     )
// }

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

const handler = createMcpHandler(createWeatherServer);
setNotifyToolsChanged(() => handler.notify.toolsChanged());
const node = toNodeHandler(handler);

const app = createMcpExpressApp();

app.get("/health", (req, res: Response) => {
    res.send("Hello World, i'm healthy!!");
});

// app.use(requireBearerAuth({
//     verifier: createEntraTokenVerifier({ tenantId, clientId }),
// }));

// app.use((req, res: Response, next: NextFunction) => {
//     if ( !checkAuthorz(req.auth?.scopes, roleName) ) {
//         res.status(401).send(`Your not authorized to access this endpoint. Your current role is ${req.auth?.scopes}`)
//         return;
//     }

//     next();
// });

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

app.all('/mcp', (req: Request, res: Response) => {
    void node(req, res, req.body);
});

app.listen(3001);
