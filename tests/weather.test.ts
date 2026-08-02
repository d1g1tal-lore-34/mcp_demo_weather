import {
    makeNWSRequest,
    formatAlert,
    formatForecast,
    getAlertsHandler,
    getForecastHandler,
} from '../src/weather.js';

const fetchMock = jest.fn();

function mockFetchResponse(ok: boolean, json?: unknown) {
    fetchMock.mockResolvedValue({
        ok,
        json: async () => json,
    });
}

describe('makeNWSRequest', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('returns parsed JSON for a successful response', async () => {
        mockFetchResponse(true, { foo: 'bar' });
        await expect(makeNWSRequest<{ foo: string }>('http://example.test')).resolves.toEqual({ foo: 'bar' });
        expect(fetchMock).toHaveBeenCalledWith('http://example.test', {
            headers: {
                'User-Agent': 'weather-app/1.0',
                Accept: 'application/geo+json',
            },
        });
    });

    it('returns null when the response is not ok', async () => {
        mockFetchResponse(false);
        await expect(makeNWSRequest('http://example.test')).resolves.toBeNull();
    });

    it('returns null when fetch throws', async () => {
        fetchMock.mockRejectedValue(new Error('network down'));
        await expect(makeNWSRequest('http://example.test')).resolves.toBeNull();
    });
});

describe('formatAlert', () => {
    it('formats a fully populated alert feature', () => {
        const feature = {
            properties: {
                event: 'Flood Watch',
                areaDesc: 'San Diego County',
                severity: 'Moderate',
                status: 'Actual',
                headline: 'Flood Watch issued',
            },
        };
        expect(formatAlert(feature)).toBe(
            [
                'Event: Flood Watch',
                'Area: San Diego County',
                'Severity: Moderate',
                'Status: Actual',
                'Headline: Flood Watch issued',
                '---',
            ].join('\n'),
        );
    });

    it('uses defaults for missing fields', () => {
        expect(formatAlert({ properties: {} })).toBe(
            [
                'Event: Unknown',
                'Area: Unknown',
                'Severity: Unknown',
                'Status: Unknown',
                'Headline: No headline',
                '---',
            ].join('\n'),
        );
    });
});

describe('formatForecast', () => {
    it('formats a fully populated forecast period', () => {
        const periods = [
            {
                name: 'Tonight',
                temperature: 45,
                temperatureUnit: 'F',
                windSpeed: '5 mph',
                windDirection: 'SE',
                shortForecast: 'Clear',
            },
        ];
        expect(formatForecast(periods)).toBe(
            ['Tonight:', 'Temperature: 45°F', 'Wind: 5 mph SE', 'Clear', '---'].join('\n'),
        );
    });

    it('uses defaults for missing fields', () => {
        expect(formatForecast([{}])).toBe(
            ['Unknown:', 'Temperature: Unknown°F', 'Wind: Unknown ', 'No forecast available', '---'].join('\n'),
        );
    });
});

describe('getAlertsHandler', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = fetchMock as unknown as typeof fetch;
        fetchMock.mockReset();
    });

    it('returns failure text when the alerts request fails', async () => {
        mockFetchResponse(false);
        const result = await getAlertsHandler('CA');
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'Failed to retrieve alerts data' });
    });

    it('returns a no-alerts message when there are no features', async () => {
        mockFetchResponse(true, { features: [] });
        const result = await getAlertsHandler('ca');
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'No active alerts for CA' });
    });

    it('formats active alerts for a state', async () => {
        const feature = {
            properties: {
                event: 'Flood',
                areaDesc: 'Test Area',
                severity: 'Severe',
                status: 'Actual',
                headline: 'Test headline',
            },
        };
        mockFetchResponse(true, { features: [feature] });
        const result = await getAlertsHandler('CA');
        const expected = `Active alerts for CA:\n\n${formatAlert(feature)}`;
        expect(result.content[0]).toMatchObject({ type: 'text', text: expected });
    });
});

describe('getForecastHandler', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = fetchMock as unknown as typeof fetch;
        fetchMock.mockReset();
    });

    it('returns failure text when the grid point request fails', async () => {
        mockFetchResponse(false);
        const result = await getForecastHandler(38.9, -77.0);
        expect(result.content[0]).toMatchObject({
            type: 'text',
            text: expect.stringContaining('Failed to retrieve grid point data for coordinates: 38.9, -77'),
        });
    });

    it('returns failure text when the grid point data has no forecast URL', async () => {
        mockFetchResponse(true, { properties: {} });
        const result = await getForecastHandler(38.9, -77.0);
        expect(result.content[0]).toMatchObject({
            type: 'text',
            text: 'Failed to get forecast URL from grid point data',
        });
    });

    it('returns failure text when the forecast request fails', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { forecast: 'http://forecast.test' } }) })
            .mockResolvedValueOnce({ ok: false });
        const result = await getForecastHandler(38.9, -77.0);
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'Failed to retrieve forecast data' });
    });

    it('returns a no-periods message when the forecast has no periods', async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { forecast: 'http://forecast.test' } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { periods: [] } }) });
        const result = await getForecastHandler(38.9, -77.0);
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'No forecast periods available' });
    });

    it('formats the full forecast for a location', async () => {
        const period = {
            name: 'Tonight',
            temperature: 45,
            temperatureUnit: 'F',
            windSpeed: '5 mph',
            windDirection: 'SE',
            shortForecast: 'Clear',
        };
        fetchMock
            .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { forecast: 'http://forecast.test' } }) })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ properties: { periods: [period] } }) });
        const result = await getForecastHandler(38.9, -77.0);
        const expected = `Forecast for 38.9, -77:\n\n${formatForecast([period])}`;
        expect(result.content[0]).toMatchObject({ type: 'text', text: expected });
    });
});
