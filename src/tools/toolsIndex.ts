import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAlertsHandler, getForecastHandler } from './weather/weather.js';
import { z } from "zod";

export function registerTools(server: McpServer) {
    server.registerTool(
        "get-alerts",
        {
            description: "Get weather alerts for a state",
            inputSchema: {
                state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
            },
        },
        async ({ state }) => getAlertsHandler(state),
    );

    server.registerTool(
        "get-forecast",
        {
            description: "Get weather forecast for a location",
            inputSchema: {
                latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
                longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
            },
        },
        async ({ latitude, longitude }) => getForecastHandler(latitude, longitude),
    );
}