import { McpServer } from '@modelcontextprotocol/server';
import { US_STATES, buildWeatherBriefingPrompt, registerPrompts } from '../src/tools/prompts/prompts.js';

describe('US_STATES', () => {
    it('contains all 50 US states', () => {
        expect(US_STATES).toHaveLength(50);
    });
});

describe('buildWeatherBriefingPrompt', () => {
    it('builds a user message that mentions the target state', () => {
        const result = buildWeatherBriefingPrompt('ca');
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe('user');
        expect(result.messages[0].content).toMatchObject({ type: 'text' });
        const text = (result.messages[0].content as { type: 'text'; text: string }).text;
        expect(text).toContain('CA');
        expect(text).toContain('get-alerts');
        expect(text).toContain('get-forecast');
    });
});

describe('registerPrompts', () => {
    it('registers the weather-briefing prompt without throwing', () => {
        const server = new McpServer({ name: 'test-server', version: '1.0.0' });
        expect(() => registerPrompts(server)).not.toThrow();
    });
});
