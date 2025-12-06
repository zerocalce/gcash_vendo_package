# Gemini Vision Bill Classification POC Notes

## Current Configuration (POC)

- `GEMINI_ALLOW_DENOM_ONLY=1`: Accept based on denomination alone for quick demo.
- Model: `gemini-2.0-flash` (primary fallback list includes gemini-1.5-flash, gemini-pro-vision, etc.).
- API: Generative Language API via `GOOGLE_API_KEY` (AI Studio key).
- Image source: `CAM_SAMPLE_PATH` pointing to a sample 100-peso image.

## Behavior

- If Gemini returns a numeric `denomination` (even without `confidence`/`is_genuine`), the system emits `bill.detected` and the UI increments by that amount.
- Confidence and genuineness are treated as optional in denom-only mode.
- WebSocket broadcasts:
  - `bill.detected` (same as hardware path)
  - `vision.result` includes raw response, model, and normalized fields.

## To Revert to Strict Scoring (Post-POC)

1. Remove or set `GEMINI_ALLOW_DENOM_ONLY=0` in `.env`.
2. Ensure thresholds are set:
   - `GEMINI_CONF_MIN=0.85` (or desired)
   - `GEMINI_GENUINE_MIN=0.80` (or desired)
3. Optionally tighten prompt to force numeric `confidence` and `is_genuine` fields.

## Usage

- Manual test:

  ```powershell
  powershell -Command "$r = Invoke-RestMethod -Uri 'http://localhost:3000/api/vision/classify?emit=1' -Method Post; $r | ConvertTo-Json -Depth 8 -Compress"
  ```

- IR trigger (future): Have firmware send `IR:TRIGGER` over serial; backend will call Gemini automatically.

## Security

- `GOOGLE_API_KEY` and `GEMINI_API_KEY` are server-side only. Never expose to frontend.
- No PII or user images are persisted beyond the in-memory request.

## Fallbacks

- If a model returns 404/not supported, the utility tries the next candidate in the list.
- If all models fail, the endpoint returns 500 with the last error.

## Next Steps (Optional Enhancements)

- Add `generationConfig.responseMimeTypetext/plain` or `application/json` to force structured output.
- Add retry with backoff on rate limits.
- Add logging of request/response for debugging (sanitized).
- Add UI feedback for `vision.result` (accepted/rejected/error) while testing.

## Dependencies

- `@google/generative-ai` (installed)
- `axios` (already present)
- No changes to hardware or firmware required for POC.
