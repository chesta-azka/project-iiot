# Repository Guidelines

## Project Structure & Module Organization
This repository is a NestJS backend for IIoT machine monitoring. Application code lives in `src/`: `auth/` for JWT and roles, `machine-api/` for telemetry/history endpoints, `core-engine/` for business logic, `database/` for TypeORM entities and Influx services, `simulator/` for Modbus simulation, and `common/` for shared guards, middleware, and interceptors. Unit tests sit beside the source as `*.spec.ts`; end-to-end tests live in `test/` as `*.e2e-spec.ts`. Root files such as `docker-compose.yml`, `Dockerfile`, and `nest-cli.json` handle tooling.

## Build, Test, and Development Commands
Use `npm run start:dev` for local development with file watching. Use `npm run build` to compile to `dist/`, and `npm run start:prod` to run the compiled app. Run `npm run lint` to apply ESLint fixes and `npm run format` for Prettier. Run `npm test` for unit tests, `npm run test:cov` for coverage output, and `npm run test:e2e` for API-level tests. Use `docker compose up --build` when you need PostgreSQL and InfluxDB locally.

## Coding Style & Naming Conventions
Write TypeScript using standard NestJS patterns: one module/service/controller per feature area, DTOs in `dto/`, and guards/decorators grouped by concern. Let Prettier control formatting; this repo uses single quotes and trailing commas. File names should stay kebab-case with Nest suffixes such as `auth.service.ts`, `roles.guard.ts`, and `history-query.dto.ts`. Use PascalCase for classes, camelCase for methods and properties, and keep controllers thin.

## Testing Guidelines
Jest is configured for both unit and e2e testing. Name unit tests `*.spec.ts` and keep them close to the code they verify; name integration flows `*.e2e-spec.ts` in `test/`. There is no enforced coverage threshold in config, so cover every changed service, controller, or guard with focused tests before opening a PR.

## Commit & Pull Request Guidelines
Current history uses short, imperative subjects such as `Revise README for IIoT Monitoring System details`. Follow that pattern, keep the first line specific, and avoid mixing unrelated changes in one commit. Pull requests should include a concise summary, affected modules, any `.env` or schema changes, test commands run, and sample request/response details when API behavior changes.

## Security & Configuration Tips
Keep secrets in `.env`, not in code or commit messages. `docker-compose.yml` provisions PostgreSQL and InfluxDB for local use; treat `postgres_data/` as generated state and do not edit it manually. If you change ports, JWT settings, or database credentials, note that in the PR and verify Swagger still loads at `/docs`.
