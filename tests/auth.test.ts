import { checkAuthorz } from '../src/auth.js';

describe('checkAuthorz', () => {
    it('returns false when roles is undefined', () => {
        expect(checkAuthorz(undefined, 'Weather.User')).toBe(false);
    });

    it('returns true when the roles array contains the role', () => {
        expect(checkAuthorz(['Weather.User', 'Other'], 'Weather.User')).toBe(true);
    });

    it('returns false when roles is present but does not contain the role', () => {
        expect(checkAuthorz(['Other'], 'Weather.User')).toBe(false);
    });

    it('returns false for an empty roles array', () => {
        expect(checkAuthorz([], 'Weather.User')).toBe(false);
    });
});
