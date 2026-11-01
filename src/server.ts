import {
    createRequestStateCodec,
    McpServer,
    requireScopes,
    type McpServerOptions,
} from "@modelcontextprotocol/server";
import { registerTools } from './tools/toolsIndex.js';
import { registerPrompts } from './tools/prompts/prompts.js';
import type { WeatherBriefingState } from './tools/weather/briefing.js';

const stateCodec = createRequestStateCodec<WeatherBriefingState>({
    key: crypto.getRandomValues(new Uint8Array(32)),
    ttlSeconds: 600,
});

export function createWeatherServer(roleName?: string): McpServer {
    const serverOptions: McpServerOptions = {
        requestState: { verify: stateCodec.verify },
    };
    // Cap tool input size (DoS hardening, SDK 2.3.0+)
    if (roleName !== undefined) {
        serverOptions.maxToolInputElements = 100;
    }
    
    const server = new McpServer(
        { name: "weather-server", version: "2.4.0" },
        serverOptions,
    );
    registerTools(server, stateCodec, roleName);
    registerPrompts(server, roleName);
    return server;
}
