# 01 — Overview

## What this project does

This project collects public data about Polish companies.
It stores the data in a database.
It serves the data through a local API.

The data is free and public.
It comes from official Polish registers.
The main register is KRS. KRS is the National Court Register.

## Why the project exists

We studied a Polish company called BizRaport.
BizRaport sells company reports.
Their data comes from public registers.
We learned how they work.
We decided to build the same thing for ourselves.

See [02-bizraport-study.md](02-bizraport-study.md).

## The core idea

The raw data is public. Anyone can download it.
The value is in the work we do with the raw data.

We do this work:

1. We parse the raw data into a clean model.
2. We calculate financial indicators.
3. We build industry benchmarks.
4. We build a graph of connections between companies.

This work is the "derived value layer".
It is hard to copy.
It is our advantage. It is our moat.

## What the system has now

- A client for the KRS OpenAPI.
- A parser for KRS company reports.
- A parser for financial statements in XML.
- A client for REGON. It needs a key.
- A client for CEIDG. It covers sole proprietors.
- A client for MSiG and KRZ announcements.
- A local database. It uses Cloudflare D1.
- A data ingestion pipeline.
- Financial indicators and benchmarks.
- A local HTTP API.
- Tests. Unit tests and integration tests.

## What is not finished

- The REGON key is not here yet.
- The RDF transport is not live yet.
- The CEIDG endpoint is not confirmed yet.

See [08-whats-left.md](08-whats-left.md).

## How to run it

```bash
npm install
npm run db:migrate
npm run dev
```

See [06-api.md](06-api.md) for the API.
