# Shogun Public Documentation

This repository contains the public Docusaurus documentation registry for Shogun.dev.

## Local Development

```bash
npm install
npm run start
```

## Production Build

```bash
npm run build
npm run serve
```

The production server serves only the generated `build/` directory. It applies
framing, MIME, referrer and HTTPS transport protections to pages, assets and
errors. Its content policy allows local scripts and hashes of inline scripts
emitted by the static build; arbitrary inline scripts and `eval` are blocked.
Inline styles remain allowed for Docusaurus theme and code rendering. Rebuild
and restart the server together when updating documentation.

After building, run `npm run test:security` to verify response headers, clean
URLs, range requests and the static publication boundary. `PORT` defaults to 3000.

## Registry Entries

Public documentation surfaces are registered in `src/data/registry.ts`. Keep entries concise, add ownership metadata, and link only to documentation intended for public readers.
