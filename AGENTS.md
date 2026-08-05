# AGENTS.md

TypeScript MCP (Model Context Protocol) weather server exposing `get-alerts` and `get-forecast` tools over Streamable HTTP (`/mcp`), protected by Azure Entra OAuth (OBO) via `requireBearerAuth` + a `jose`-based token verifier.

## Commands

- Test: `npm test` (jest via ts-jest, runs `tests/**/*.test.ts` — 2 suites, 19 tests). No lint or typecheck script exists; type errors only surface via `npm run build`.
- Build: `npm run build` (runs `tsc` to `./build`, then chmods `build/index.js`).
- Run: `npm run build && node build/index.js` (listens on hardcoded port **3001**).
- Debug via VS Code `launch.json` ("Launch MCP Server" runs `build/index.js` with a tsc preLaunchTask).

## Environment (required at startup)

Server throws at import time if missing, so any run needs all three (or a `.env` file — dotenv is loaded and `.env` is gitignored):

- `TENANT_ID`, `CLIENT_ID`, `ROLE_NAME` — Azure Entra tenant/app-registration and the role checked on protected routes.

## Gotchas

- **ESM + `module: Node16`**: relative imports in `src/` and `tests/` must use `.js` extensions (e.g. `./tools/toolsIndex.js`, `../src/tools/weather/weather.js`). Omitting it fails typecheck. `jest.config.cjs`'s `moduleNameMapper` strips the `.js` suffix for ts-jest. The config file must stay `.cjs` because `package.json` has `"type": "module"`.
- **Auth is global, `/health` is the only open route**: `requireBearerAuth` (from `@modelcontextprotocol/express`) and the `checkAuthorz` role gate are `app.use` middleware covering every route registered after `/health`. `/mcp` returns 401 without a valid token, and 401 if the token's roles lack `ROLE_NAME`.
- **`/mcp` is POST-only and stateless per request**: an `app.all('/mcp', ...)` catch-all wraps `toNodeHandler(createMcpHandler(buildServer))`. `buildServer()` runs once per request and returns a fresh `McpServer` with tools registered (`createMcpHandler` owns the per-request transport lifecycle). GET and DELETE on `/mcp` return 405 via explicit handlers registered before the catch-all. Do not refactor to a single server/transport connected once at startup without understanding the stateless design.
- `createEntraTokenVerifier` (`src/security/auth_handler.ts`) verifies RS256 via tenant JWKS and accepts two issuer/audience pairs. Failed `jwtVerify` is rethrown as `OAuthError(InvalidToken)` so bad tokens return 401 (any uncaught throw would surface as 500). The token's `roles` claim is surfaced as `req.auth.scopes`, which is what the gate reads: `checkAuthorz(req.auth?.scopes, roleName)`. v2 `requireBearerAuth` also returns 401 if `expiresAt` is unset — Entra tokens always carry `exp`.
- `checkAuthorz` in `src/auth.ts` enforces `roles?.includes(roleName) === true` (fixed — it previously returned `true` for any truthy `roles`).
- The express app is built with `createMcpExpressApp()` from `@modelcontextprotocol/express` (DNS-rebinding/host-header protection; binds loopback by default). No CORS middleware is configured; the `cors` dependency in `package.json` is installed but unused.
- **MCP SDK is at v2 (2.0.0)**: the monolith `@modelcontextprotocol/sdk` is split into `@modelcontextprotocol/server` (`McpServer`, `createMcpHandler`, `OAuthError`/`OAuthErrorCode`), `@modelcontextprotocol/express` (`createMcpExpressApp`, `requireBearerAuth`, `OAuthTokenVerifier` type), and `@modelcontextprotocol/node` (`toNodeHandler`, `NodeStreamableHTTPServerTransport`). See `plans/UpgradeMCPSDK.md`. v2 requires Node 20+ and zod ^4 (peer dep of the server package); `SSEServerTransport` was removed. Don't bump packages as a side task.
- `McpServer` in `src/index.ts` is constructed with only `{ name, version }` — capabilities are auto-derived from registrations (no `ServerOptions`/`capabilities` argument). Tool `inputSchema` must be a `z.object({...})` (raw-shape form is deprecated).
- Weather tools call `api.weather.gov` with a required `User-Agent` header; the NWS API only covers US locations.

## Structure

- `src/index.ts` — entrypoint: env validation, per-request `buildServer()` factory (`McpServer` + `registerTools(server)`) wrapped by `createMcpHandler` + `toNodeHandler`, express app (`createMcpExpressApp`), `/health`, global bearer-auth + role-gate middleware, `/mcp` catch-all (405 for GET/DELETE), `app.listen(3001)`.
- `src/tools/toolsIndex.ts` — `registerTools(server)`: registers `get-alerts` (2-letter state) and `get-forecast` (lat/lon) with zod input schemas.
- `src/tools/weather/weather.ts` — pure NWS logic (fetch + formatting + tool handlers), extracted for testability.
- `src/auth.ts` — `checkAuthorz`.
- `src/security/auth_handler.ts` — `createEntraTokenVerifier` (`jose`-backed `OAuthTokenVerifier` for `requireBearerAuth`).
- `tests/` — jest unit tests (`weather.test.ts`, `auth.test.ts`); excluded from `tsc` via `tsconfig.json` `include: ["src/**"]`.
- `plans/` — short feature-plan markdowns (feature/requirements/success-criteria format); read before starting work that matches them. `ModernizeEntraSecurity.md` documents the current auth setup; `AddUnitTests.md` documents the test setup.
