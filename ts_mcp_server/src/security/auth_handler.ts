import { expressjwt, Request as RequestJWT } from "express-jwt";
import type { Request } from 'express';
import jwksRsa, { GetVerificationKey } from "jwks-rsa";

export function buildMSALToken({ tenantId, clientId }: { tenantId: string, clientId: string }) {
    // This is the URL where the public keys for the tenant are stored.
    const jwksUri = `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`

    // This issuer and audience are used for API scope with MSAL
    const issuer1 = `https://sts.windows.net/${tenantId}/`
    const audience1 = `api://${clientId}`

    // This issuer and audience are used if authentication is enabled on App Service with token cache.
    const issuer2 = `https://login.microsoftonline.com/${tenantId}/v2.0`
    const audience2 = `${clientId}`

    return expressjwt({
        secret: jwksRsa.expressJwtSecret({
            jwksUri: jwksUri,
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5
        }) as GetVerificationKey,
        audience: [audience1, audience2],
        issuer: [issuer1, issuer2],
        algorithms: ["RS256"],
        credentialsRequired: true
    })
}

export type RequestWithMsalAuth = {
    auth?: RequestJWT["auth"] & {
        name?: string
        unique_name?: string
        upn?: string
        oid?: string
        scp?: string
        roles?: string[]
    }
} & Request