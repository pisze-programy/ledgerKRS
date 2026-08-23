# Notowania pb.pl and Bankier — Data Sources

## Purpose

This document describes two public data sources.
The sources serve data about listed Polish companies.
We use these sources to fill the gaps in our report.
The gaps are the banks and the listed companies.

This document uses Simplified Technical English (ASD-STE100).

## The pb.pl Financial Reports

The pb.pl service publishes financial reports.
The service covers all companies listed on the Warsaw Stock Exchange.

The URL for one company is:
`https://notowania.pb.pl/instrument/{ISIN}/{symbol}/raporty-finansowe`

The page has a table.
The table has one row for each financial indicator.
The table has one column for each quarter.

The indicators include:
- Net interest income.
- Fee and commission income.
- Gross profit.
- Net profit.
- Total assets.
- Equity.
- Number of shares.
- Book value per share.
- Profit per share.

The table has four tabs.
The tabs are:
- Quarterly (consolidated).
- Annual (consolidated).
- Quarterly (separate).
- Annual (separate).

The annual tab URL is:
`/raporty-finansowe/skonsolidowany/roczny`
and
`/raporty-finansowe/jednostkowy/roczny`

## The Data in the HTML

The page stores the values in the HTML attributes.
Each value cell has a data attribute.
The attribute name is "data-raw-value".
The attribute contains a JSON object.
The object has a field named "value".

Example:
`data-raw-value="{&quot;value&quot;:&quot;233217182&quot;}"`

The chart data is in another attribute.
The attribute name is "data-chart-data".
The chart data is a JSON array.
The array has the period and the value.

The values are in thousands of PLN.
We multiply the value by 1000 to get the full PLN value.

## The Annual Value

The quarterly table shows cumulative values.
The fourth quarter value is the annual value.
We use the fourth quarter value as the fiscal year value.

Example for Bank Pekao:
- The fourth quarter 2020 value for total assets is 233 217 182.
- The full value is 233 217 182 000 PLN.
- This value matches the Bizraport value.

## The Bankier API

The Bankier service provides a public API.
The API needs no authentication.
The API returns data as JSON.

The URL for one company is:
`https://api.bankier.pl/quotes/public/company-profile-chart/{ISIN}/?today=true&intraday=true`

The API returns:
- The company name.
- The ISIN.
- The symbol.
- The market capitalization.
- The share price.
- The trading volume.

We use this API to confirm the instrument identity.
We use this API to get the market data for the report.

## The Instrument List

The pb.pl service lists all GPW instruments.
The URL is:
`https://notowania.pb.pl/stocktable/GPWAKCJE`

The list has 354 instruments.
Each instrument has an ISIN and a symbol.
We use this list to build the instrument inventory.

The list includes ten listed banks:
- Pekao (PLPEKAO00016, pekao).
- PKO BP (PLPKO0000016, pkobp).
- mBank (PLBRE0000012, mbank).
- Erste Bank (PLBZ00000044, erstepl).
- ING Bank Slaski (PLBSK0000017, ingbsk).
- Alior Bank (PLALIOR00045, alior).
- Millennium (PLBIG0000016, millennium).
- BOŚ (PLBOS0000019, bos).
- Bank Handlowy (PLBH00000012, handlowy).
- BNP Paribas (PLBGZ0000010, bnpppl).

The list includes the insurer PZU (PLPZU0000011, PZU).

## The Integration Plan

We add a new provider module to the source layer.
The module name is "pbpl".
The module has these files:

- `instruments.ts`: the instrument inventory and the KRS to ISIN map.
- `client.ts`: the HTTP client for the pb.pl pages and the Bankier API.
- `parse.ts`: the parser for the financial report table.
- `period.ts`: the mapping from quarters to fiscal years.
- `map.ts`: the mapping from report indicators to our indicators.
- `ingest.ts`: the ingestion of the report data.

We add the provider to the pipeline.
We add the provider to the report.
We verify the values against Bizraport.

## The Rules

We follow the repository rules.
We write unit tests for each module.
We test the normal path, the exceptions, and the conflicts.
We do not copy the source service.
We make our own parser and our own model.

## The Next Step

The next step is the pb.pl instruments module.
We implement the module after the unit tests pass.
The PDF extraction is the follow-up step.
