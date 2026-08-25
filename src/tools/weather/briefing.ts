import {
    acceptedContent,
    inputRequired,
    type InputRequiredResult,
    type RequestStateCodec,
} from "@modelcontextprotocol/server";
import { getAlertsHandler } from './weather.js';

export const CONFIRM_SCHEMA = {
    type: 'object',
    properties: { confirm: { type: 'boolean' } },
    required: ['confirm'],
} as {
    type: 'object';
    properties: { confirm: { type: 'boolean' } };
    required: string[];
};

export interface WeatherBriefingState {
    step: 'confirm';
    state: string;
}

export interface BriefingRound {
    inputResponses?: Record<string, unknown>;
    requestState: () => unknown;
}

export function buildConfirmRequest(state: string, requestState: string): InputRequiredResult {
    return inputRequired({
        inputRequests: {
            confirm: inputRequired.elicit({
                message: `Fetch the current weather briefing for ${state}?`,
                requestedSchema: CONFIRM_SCHEMA,
            }),
        },
        requestState,
    });
}

export function extractConfirmation(round: BriefingRound): { confirm: boolean } | undefined {
    return acceptedContent<{ confirm: boolean }>(round.inputResponses, 'confirm');
}

export async function weatherBriefingHandler(
    state: string,
    stateCodec: RequestStateCodec<WeatherBriefingState>,
    round: BriefingRound,
): Promise<InputRequiredResult | Awaited<ReturnType<typeof getAlertsHandler>>> {
    const roundState = round.requestState() as WeatherBriefingState | undefined;
    const step = roundState?.step ?? 'confirm';

    if (step === 'confirm') {
        const confirmed = extractConfirmation(round);
        if (!confirmed?.confirm) {
            return buildConfirmRequest(state, await stateCodec.mint({ step: 'confirm', state }));
        }
    }

    return getAlertsHandler(state);
}
