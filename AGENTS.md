# AGENTS.md

TypeScript MCP (Model Context Protocol) weather server exposing `get-alerts` and `get-forecast` tools over HTTP+SSE, protected by Azure Entra OAuth (OBO) via express-jwt.

## Commands

- Build: `npm run build` (runs `tsc` to `./build`, then chmods `build/index.js`)
- Run: `npm run build && node build/index.js` (listens on hardcoded port **3001**)
- No `dev`/`start`/`lint`/`typecheck` scripts exist. `npm test` is a stub that fails with "no test specified" — there are **no tests** yet (see `plans/CreateUnitTets.md`, which calls for jest).
- Debug via VS Code `launch.json` ("Launch MCP Server" runs `build/index.js` with a tsc preLaunchTask).

## Environment (required at startup)

Server throws at import time if missing, so any run needs all three (or a `.env` file — dotenv is loaded and `.env` is gitignored):

- `TENANT_ID`, `CLIENT_ID`, `ROLE_NAME` — Azure Entra tenant/app-registration and the role checked on protected routes.

## Gotchas

- **ESM + `module: Node16`**: relative imports in `src/` must use `.js` extensions (e.g. `./security/auth_handler.js`). Omitting it fails typecheck.
- **`checkAuthorz` bug** in `src/index.ts:281`: `roles.includes(roleName)` discards its result and returns `true` whenever `roles` is truthy — role checks never actually deny. Don't rely on it; fix before treating authz as enforced.
- All routes except `/health` require a valid RS256 Azure token (jwks-rsa validates against tenant keys). `/messages` requires the `sessionId` query param and a live SSE transport created by `/sse`.
- **MCP SDK is pinned at 1.8.0** in the lockfile (with known vulns). `plans/UpgradeMCPSDK.md` targets 1.29.0; newer SDKs moved `SSEServerTransport` (imported from `server/sse.js`), so that migration is breaking. Don't bump it as a side task.
- `McpServer` uses `capabilites` (typo for `capabilities`) at `src/index.ts:36` — harmless, but preserved so as not to diverge.
- Weather tools call `api.weather.gov` with a required `User-Agent` header; the NWS API only covers US locations.

## Structure

- `src/index.ts` — entrypoint: express app, SSE/Messages/health routes, MCP tools.
- `src/security/auth_handler.ts` — `buildMSALToken` middleware factory + `RequestWithMsalAuth` type.
- `plans/` — short feature-plan markdowns (feature/requirements/success-criteria format); read before starting work that matches them.
