import { createRequestStateCodec, McpServer } from "@modelcontextprotocol/server";
import { registerTools } from './tools/toolsIndex.js';
import { registerPrompts } from './tools/prompts/prompts.js';
import type { WeatherBriefingState } from './tools/weather/briefing.js';

const stateCodec = createRequestStateCodec<WeatherBriefingState>({
    key: crypto.getRandomValues(new Uint8Array(32)),
    ttlSeconds: 600,
});

export function createWeatherServer(): McpServer {
    const server = new McpServer(
        { name: "weather-server", version: "2.0.0" },
        { requestState: { verify: stateCodec.verify } },
    );
    registerTools(server, stateCodec);
    registerPrompts(server);
    return server;
}
