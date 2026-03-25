# HTTP Convenience Endpoints

Daemon-first HTTP mode now provides two convenience aliases over the registry-backed tool surface:

- `POST /v1/execute` -> `figma_execute`
- `POST /v1/screenshot` -> `figma_capture_screenshot`

These endpoints do not introduce a separate execution path. They call the same registry-backed tools as `POST /v1/tools/:name`.

## Body Shapes

Both aliases accept either:

1. a direct input object
2. the standard tool envelope `{ "input": ..., "options": ... }`

## Examples

Direct execute:

```bash
curl -s -X POST http://127.0.0.1:3847/v1/execute \
  -H 'Content-Type: application/json' \
  -d '{"code":"return { ok: true };","timeout":5000}'
```

Direct screenshot:

```bash
curl -s -X POST http://127.0.0.1:3847/v1/screenshot \
  -H 'Content-Type: application/json' \
  -d '{"nodeId":"123:456","format":"PNG","scale":2}'
```

Envelope form:

```bash
curl -s -X POST http://127.0.0.1:3847/v1/execute \
  -H 'Content-Type: application/json' \
  -d '{"input":{"code":"return { ok: true };"},"options":{"verbosity":"summary"}}'
```

Use these aliases for fast "execute then screenshot" loops, but keep `GET /v1/tools/:name` as the canonical source for schema and examples.
