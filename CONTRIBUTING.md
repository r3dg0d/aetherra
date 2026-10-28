# Contributing to AETHERRA

Thanks for helping build AETHERRA. Start with [FEATURES.md](FEATURES.md) for what exists and [ROADMAP.md](ROADMAP.md) for what's next.

## Ground rules

- **Data honesty.** Every value shown must carry one of the six data classes (`LIVE`, `DELAYED`, `HISTORICAL`, `PREDICTED`, `SIMULATED`, `UNAVAILABLE`). Never present simulated or cached data as live, and never fabricate an API response.
- **No fake buttons.** If a feature needs credentials that aren't configured, show an honest unavailable state instead.
- **Providers go through adapters** in `src/providers/`, with licence, attribution, caching, backoff and staleness metadata.
- **Respect upstream terms** for every data source, including rate limits and attribution.
- **Never commit secrets.** Use `.env.local` (git-ignored); document new variables in `.env.example`.

## Workflow

```bash
npm install
npm run dev
npm run lint && npm run typecheck && npm test   # must pass
npm run build                                   # must pass
npm run e2e                                     # with a running server
```

Keep pull requests focused, describe what you verified, and add or update tests for behaviour you change.
