"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMSALToken = buildMSALToken;
const express_jwt_1 = require("express-jwt");
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
function buildMSALToken({ tenantId, clientId }) {
    // This is the URL where the public keys for the tenant are stored.
    const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
    // This issuer and audience are used for API scope with MSAL
    const issuer1 = `https://sts.windows.net/${tenantId}/`;
    const audience1 = `api://${clientId}`;
    // This issuer and audience are used if authentication is enabled on App Service with token cache.
    const issuer2 = `https://login.microsoftonline.com/${tenantId}/v2.0`;
    const audience2 = `${clientId}`;
    return (0, express_jwt_1.expressjwt)({
        secret: jwks_rsa_1.default.expressJwtSecret({
            jwksUri: jwksUri,
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5
        }),
        audience: [audience1, audience2],
        issuer: [issuer1, issuer2],
        algorithms: ["RS256"],
        credentialsRequired: true
    });
}
//# sourceMappingURL=auth_handler.js.map