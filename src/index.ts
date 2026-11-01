import dotenv from 'dotenv';
dotenv.config()
import { createMcpHandler } from "@modelcontextprotocol/server";
import { createMcpExpressApp, requireBearerAuth } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createEntraTokenVerifier } from './security/auth_handler.js';
import { createWeatherServer } from './server.js';
import { setNotifyToolsChanged } from './tools/toolRegistry.js';

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

const handler = createMcpHandler(() => createWeatherServer(roleName));
setNotifyToolsChanged(() => handler.notify.toolsChanged());
const node = toNodeHandler(handler);

const app = createMcpExpressApp();

app.get("/health", (req, res) => {
    res.send("Hello World, i'm healthy!!");
});

app.use(requireBearerAuth({
    verifier: createEntraTokenVerifier({ tenantId, clientId }),
    expectedResource: new URL(`api://${clientId}`),
}));

app.all('/mcp', (req, res) => {
    void node(req, res, req.body);
});

app.listen(3001);
