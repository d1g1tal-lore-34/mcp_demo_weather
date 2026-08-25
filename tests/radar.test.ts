import { radarUrlFor } from '../src/tools/weather/radar.js';

describe('radarUrlFor', () => {
    it('embeds the coordinates in the canned radar output', () => {
        const output = radarUrlFor(38.9072, -77.0369);
        expect(output).toContain('38.9072,-77.0369');
        expect(output).toContain('radar.weather.gov');
    });

    it('rounds coordinates to four decimal places', () => {
        const output = radarUrlFor(38.907192, -77.036871);
        expect(output).toContain('38.9072,-77.0369');
    });
});
