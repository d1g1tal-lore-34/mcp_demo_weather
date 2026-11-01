import type { RequestStateCodec } from '@modelcontextprotocol/server';
import {
    buildConfirmRequest,
    extractConfirmation,
    weatherBriefingHandler,
    type BriefingRound,
    type WeatherBriefingState,
} from '../src/tools/weather/briefing.js';

function makeRound(inputResponses?: Record<string, unknown>): BriefingRound {
    return {
        inputResponses,
        requestState: () => undefined,
    };
}

function makeCodec(): RequestStateCodec<WeatherBriefingState> {
    return {
        mint: jest.fn().mockResolvedValue('state-token'),
        verify: jest.fn(),
    } as unknown as RequestStateCodec<WeatherBriefingState>;
}

describe('buildConfirmRequest', () => {
    it('builds an input_required result with an elicitation request and requestState', () => {
        const result = buildConfirmRequest('CA', 'state-token');
        expect(result.resultType).toBe('input_required');
        expect(result.requestState).toBe('state-token');
        expect(result.inputRequests?.confirm).toBeDefined();
    });
});

describe('extractConfirmation', () => {
    it('returns accepted content for an accept action', () => {
        const round = makeRound({ confirm: { action: 'accept', content: { confirm: true } } });
        expect(extractConfirmation(round)).toEqual({ confirm: true });
    });

    it('returns undefined when the response is missing', () => {
        expect(extractConfirmation(makeRound())).toBeUndefined();
    });

    it('returns undefined when the response is declined', () => {
        const round = makeRound({ confirm: { action: 'decline' } });
        expect(extractConfirmation(round)).toBeUndefined();
    });
});

describe('weatherBriefingHandler', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ features: [] }),
        }) as unknown as typeof fetch;
    });

    it('asks for confirmation when the request carries no input responses', async () => {
        const codec = makeCodec();
        const result = await weatherBriefingHandler('CA', codec, makeRound());
        expect(result).toMatchObject({ resultType: 'input_required' });
        expect(codec.mint).toHaveBeenCalledWith({ step: 'confirm', state: 'CA' });
    });

    it('re-asks for confirmation when the user declines', async () => {
        const codec = makeCodec();
        const round = makeRound({ confirm: { action: 'decline' } });
        const result = await weatherBriefingHandler('CA', codec, round);
        expect(result).toMatchObject({ resultType: 'input_required' });
        expect(codec.mint).toHaveBeenCalledTimes(1);
    });

    it('re-asks for confirmation when the user accepts with confirm: false', async () => {
        const codec = makeCodec();
        const round = makeRound({ confirm: { action: 'accept', content: { confirm: false } } });
        const result = await weatherBriefingHandler('CA', codec, round);
        expect(result).toMatchObject({ resultType: 'input_required' });
    });

    it('proceeds to the alerts handler when the user confirms', async () => {
        const codec = makeCodec();
        const round = makeRound({ confirm: { action: 'accept', content: { confirm: true } } });
        const result = await weatherBriefingHandler('CA', codec, round);
        expect(result).not.toHaveProperty('resultType');
        expect(result.content[0]).toMatchObject({ type: 'text', text: 'No active alerts for CA' });
        expect(codec.mint).not.toHaveBeenCalled();
    });
});
