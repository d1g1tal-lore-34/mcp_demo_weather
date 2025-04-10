import dotenv from 'dotenv';
dotenv.config()
import express, { Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { buildMSALToken, RequestWithMsalAuth } from './security/auth_handler.js';

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

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

async function makeNWSRequest<T>(url: string): Promise<T | null> {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
    };

    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! statu: ${response.status}`)
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error("Error making NWS request", error)
        return null;
    }
}

interface AlertFeature {
    properties: {
        event?: string;
        areaDesc?: string;
        severity?: string;
        status?: string;
        headline?: string;
    };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
    const props = feature.properties;
    return [
        `Event: ${props.event || "Unknown"}`,
        `Area: ${props.areaDesc || "Unknown"}`,
        `Severity: ${props.severity || "Unknown"}`,
        `Status: ${props.status || "Unknown"}`,
        `Headline: ${props.headline || "No headline"}`,
        "---",
    ].join("\n");
}

interface ForecastPeriod {
    name?: string;
    temperature?: number;
    temperatureUnit?: string;
    windSpeed?: string;
    windDirection?: string;
    shortForecast?: string;
}

interface AlertsResponse {
    features: AlertFeature[];
}

interface PointsResponse {
    properties: {
        forecast?: string;
    };
}

interface ForecastResponse {
    properties: {
        periods: ForecastPeriod[];
    };
}

// Register weather tools
server.tool(
    "get-alerts",
    "Get weather alerts for a state",
    {
        state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
    },
    async ({ state }) => {
        const stateCode = state.toUpperCase();
        const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
        const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

        if (!alertsData) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve alerts data",
                    },
                ],
            };
        }

        const features = alertsData.features || [];
        if (features.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: `No active alerts for ${stateCode}`,
                    },
                ],
            };
        }

        const formattedAlerts = features.map(formatAlert);
        const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;

        return {
            content: [
                {
                    type: "text",
                    text: alertsText,
                },
            ],
        };
    },
);

server.tool(
    "get-forecast",
    "Get weather forecast for a location",
    {
        latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
        longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
    },
    async ({ latitude, longitude }) => {
        // Get grid point data
        const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
        const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

        if (!pointsData) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
                    },
                ],
            };
        }

        const forecastUrl = pointsData.properties?.forecast;
        if (!forecastUrl) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to get forecast URL from grid point data",
                    },
                ],
            };
        }

        // Get forecast data
        const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
        if (!forecastData) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Failed to retrieve forecast data",
                    },
                ],
            };
        }

        const periods = forecastData.properties?.periods || [];
        if (periods.length === 0) {
            return {
                content: [
                    {
                        type: "text",
                        text: "No forecast periods available",
                    },
                ],
            };
        }

        // Format forecast periods
        const formattedForecast = periods.map((period: ForecastPeriod) =>
            [
                `${period.name || "Unknown"}:`,
                `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
                `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
                `${period.shortForecast || "No forecast available"}`,
                "---",
            ].join("\n"),
        );

        const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

        return {
            content: [
                {
                    type: "text",
                    text: forecastText,
                },
            ],
        };
    },
);

function checkAuthorz(roles: string[] | undefined, roleName: string){
    if(roles){
        roles.includes(roleName);
        return true
    }else{
        return false
    }
}

app.listen(3001);