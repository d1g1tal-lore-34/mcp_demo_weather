import {
    isRadarToolEnabled,
    toggleRadarTool,
    setNotifyToolsChanged,
    resetRegistryForTests,
    triggerToolsChanged,
} from '../src/tools/toolRegistry.js';

describe('toolRegistry', () => {
    beforeEach(() => {
        resetRegistryForTests();
    });

    it('starts with the radar tool disabled', () => {
        expect(isRadarToolEnabled()).toBe(false);
    });

    it('toggles the radar tool flag false -> true -> false', () => {
        expect(toggleRadarTool()).toBe(true);
        expect(isRadarToolEnabled()).toBe(true);
        expect(toggleRadarTool()).toBe(false);
        expect(isRadarToolEnabled()).toBe(false);
    });

    it('resetRegistryForTests disables the radar tool', () => {
        toggleRadarTool();
        resetRegistryForTests();
        expect(isRadarToolEnabled()).toBe(false);
    });

    it('triggerToolsChanged invokes the installed notifier', () => {
        const notifier = jest.fn();
        setNotifyToolsChanged(notifier);
        triggerToolsChanged();
        expect(notifier).toHaveBeenCalledTimes(1);
    });

    it('triggerToolsChanged is a no-op before a notifier is installed', () => {
        resetRegistryForTests();
        expect(() => triggerToolsChanged()).not.toThrow();
    });
});
