import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { OAuthError, OAuthErrorCode } from "@modelcontextprotocol/server";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/express";

export function createEntraTokenVerifier({ tenantId, clientId }: { tenantId: string, clientId: string }): OAuthTokenVerifier {
    // This is the URL where the public keys for the tenant are stored.
    const jwksUri = new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)

    // This issuer and audience are used for API scope with MSAL
    const issuer1 = `https://sts.windows.net/${tenantId}/`
    const audience1 = `api://${clientId}`

    // This issuer and audience are used if authentication is enabled on App Service with token cache.
    const issuer2 = `https://login.microsoftonline.com/${tenantId}/v2.0`
    const audience2 = `${clientId}`

    const jwks = createRemoteJWKSet(jwksUri)

    return {
        async verifyAccessToken(token: string) {
            let payload: JWTPayload;
            try {
                ({ payload } = await jwtVerify(token, jwks, {
                    audience: [audience1, audience2],
                    issuer: [issuer1, issuer2],
                    algorithms: ["RS256"],
                }))
            } catch (error) {
                throw new OAuthError(OAuthErrorCode.InvalidToken, `Token verification failed: ${error instanceof Error ? error.message : String(error)}`)
            }

            const roles = rolesClaim(payload)
            const expiresAt = typeof payload.exp === "number" ? payload.exp : undefined

            return {
                token,
                clientId: typeof payload.azp === "string" ? payload.azp : clientId,
                scopes: roles ?? [],
                expiresAt,
                extra: { roles },
            }
        }
    }
}

function rolesClaim(payload: JWTPayload): string[] | undefined {
    const roles = payload.roles
    if (typeof roles === "string") {
        return [roles]
    }
    if (Array.isArray(roles) && roles.every((r): r is string => typeof r === "string")) {
        return roles
    }
    return undefined
}
