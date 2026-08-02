import dotenv from 'dotenv';
dotenv.config()
import express, { Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { buildMSALToken, RequestWithMsalAuth } from './security/auth_handler.js';
import { getAlertsHandler, getForecastHandler } from './weather.js';
import { checkAuthorz } from './auth.js';

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

const server = new McpServer({
    name: "weather-server",
    version: "1.0.0",
    capabilites: {
        resources: {},
        tools: {}
    }
});

const app = express();
app.use(buildMSALToken({ tenantId, clientId }).unless({ path: ["/health"] }));

const transports: { [sessionId: string]: SSEServerTransport } = {}

app.get("/sse", async (req: RequestWithMsalAuth, res: Response) => {
    // if (req.auth?.scp != "MCP.All") res.status(401).send(`Your not authorized to access this endpoint. Your current scope is ${req.auth?.scp}`)
    if ( !checkAuthorz(req.auth?.roles, roleName) ) {
        res.status(401).send(`Your not authorized to access this endpoint. Your current scope is ${req.auth?.roles}`)
        return;
    }

    const transport = new SSEServerTransport('/messages', res);
    transports[transport.sessionId] = transport;
    res.on("close", () => {
        delete transports[transport.sessionId];
    })
    await server.connect(transport);
});

app.post("/messages", async (req: RequestWithMsalAuth, res: Response) => {
    // if (req.auth?.scp != "MCP.All") res.status(401).send(`Your not authorized to access this endpoint. Your current scope is ${req.auth?.scp}`)
    if ( !checkAuthorz(req.auth?.roles, roleName) ) {
        res.status(401).send(`Your not authorized to access this endpoint. Your current scope is ${req.auth?.roles}`)
        return;
    }

    const sessionId = req.query.sessionId as string;
    const transport = transports[sessionId];
    if (transport) {
        await transport.handlePostMessage(req, res);
    } else {
        res.status(400).send(`No transport found for sessionId ${sessionId}`)
    }
});

app.get("/health", (req: RequestWithMsalAuth, res: Response) => {
    res.send("Hello World, i'm healthy!!");
});

// Register weather tools
server.tool(
    "get-alerts",
    "Get weather alerts for a state",
    {
        state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
    },
    async ({ state }) => getAlertsHandler(state),
);

server.tool(
    "get-forecast",
    "Get weather forecast for a location",
    {
        latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
        longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
    },
    async ({ latitude, longitude }) => getForecastHandler(latitude, longitude),
);

app.listen(3001);
