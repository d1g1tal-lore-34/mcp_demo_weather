import { completable, type GetPromptResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

export const US_STATES = [
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export function buildWeatherBriefingPrompt(state: string): GetPromptResult {
    const stateCode = state.toUpperCase();
    return {
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `You are a NOAA meteorologist preparing a briefing for ${stateCode}. ` +
                        `Use the get-alerts tool with state ${stateCode} to pull active watches and warnings, ` +
                        `and the get-forecast tool for the state's major city. ` +
                        `Then summarize: active alerts, headline conditions, and a 3-day outlook.`,
                },
            },
        ],
    };
}

export function registerPrompts(server: McpServer) {
    server.registerPrompt(
        "weather-briefing",
        {
            title: "Weather Briefing",
            description: "Produce a severe-weather briefing for a US state",
            argsSchema: z.object({
                state: completable(
                    z.string().length(2).describe("Two-letter US state code (e.g. CA, TX)"),
                    (value) =>
                        US_STATES.filter((state) => state.startsWith(value.toUpperCase())).slice(0, 10),
                ),
            }),
        },
        ({ state }) => buildWeatherBriefingPrompt(state),
    );
}
