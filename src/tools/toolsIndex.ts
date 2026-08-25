import { McpServer, type RequestStateCodec } from "@modelcontextprotocol/server";
import { getAlertsHandler, getForecastHandler } from './weather/weather.js';
import { radarUrlFor } from './weather/radar.js';
import { weatherBriefingHandler, type WeatherBriefingState } from './weather/briefing.js';
import { isRadarToolEnabled, toggleRadarTool, triggerToolsChanged } from './toolRegistry.js';
import { z } from "zod";

export function registerTools(server: McpServer, stateCodec: RequestStateCodec<WeatherBriefingState>) {
    server.registerTool(
        "get-alerts",
        {
            description: "Get weather alerts for a state",
            inputSchema: z.object({
                state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
            }),
        },
        async ({ state }) => getAlertsHandler(state),
    );

    server.registerTool(
        "get-forecast",
        {
            description: "Get weather forecast for a location",
            inputSchema: z.object({
                latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
                longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
            }),
        },
        async ({ latitude, longitude }) => getForecastHandler(latitude, longitude),
    );

    server.registerTool(
        "get-weather-briefing",
        {
            description: "Get a weather briefing for a state (asks for confirmation first)",
            inputSchema: z.object({
                state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
            }),
        },
        async ({ state }, ctx) =>
            weatherBriefingHandler(state, stateCodec, {
                inputResponses: ctx.mcpReq.inputResponses,
                requestState: ctx.mcpReq.requestState,
            }),
    );

    server.registerTool(
        "toggle-radar-tool",
        {
            description: "Enable or disable the get-radar tool and notify subscribed clients",
            inputSchema: z.object({}),
        },
        async () => {
            const enabled = toggleRadarTool();
            triggerToolsChanged();
            return {
                content: [
                    {
                        type: "text",
                        text: `Radar tool ${enabled ? "enabled" : "disabled"} — sent notifications/tools/list_changed`,
                    },
                ],
            };
        },
    );

    if (isRadarToolEnabled()) {
        server.registerTool(
            "get-radar",
            {
                description: "Get a canned radar loop for a location",
                inputSchema: z.object({
                    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
                    longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
                }),
            },
            async ({ latitude, longitude }) => ({
                content: [{ type: "text", text: radarUrlFor(latitude, longitude) }],
            }),
        );
    }
}
