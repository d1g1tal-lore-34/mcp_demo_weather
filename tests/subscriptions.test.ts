import { createMcpHandler, type ServerEvent } from '@modelcontextprotocol/server';
import { createWeatherServer } from '../src/server.js';

describe('subscriptions/listen toolsListChanged', () => {
    it('publishes tools_list_changed to subscribed listeners', () => {
        const handler = createMcpHandler(createWeatherServer);
        const listener = jest.fn();
        const unsubscribe = handler.bus.subscribe(listener);

        handler.notify.toolsChanged();

        const expected: ServerEvent = { kind: 'tools_list_changed' };
        expect(listener).toHaveBeenCalledWith(expected);
        unsubscribe();
    });

    it('does not deliver to listeners after they unsubscribe', () => {
        const handler = createMcpHandler(createWeatherServer);
        const listener = jest.fn();
        const unsubscribe = handler.bus.subscribe(listener);

        unsubscribe();
        handler.notify.toolsChanged();

        expect(listener).not.toHaveBeenCalled();
    });

    it('is a no-op when no listeners are subscribed', () => {
        const handler = createMcpHandler(createWeatherServer);
        expect(() => handler.notify.toolsChanged()).not.toThrow();
    });
});
