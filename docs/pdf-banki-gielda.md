# PDF and Banks — Knowledge Record

## Purpose

This document records what we know about PDF statements and bank data.
It explains the sources and the limits.
It uses Simplified Technical English (ASD-STE100).

## The Problem

Banks do not file e-sprawozdanie XML to the KRS.
We checked the RDF repository for bank documents.
The repository holds PDF and XHTML files for banks.
It never holds XML files for banks.

The RDF document metadata shows the file name.
For Bank Pekao the file names are ".pdf" and ".xhtml".
We never see the ".xml" extension for banks.

## The RDF Documents for Banks

The RDF repository serves two document types for banks.

The first type is a scanned PDF.
The repository holds this type for 2018 and 2019.
The scanned PDF has no text layer.
Text extraction returns zero characters.

The second type is an XHTML file.
The repository holds this type for 2020 and later.
The XHTML file contains text.
The text has the bank statement data.

The XHTML value for total assets is 222 380 996.
This value is in thousands of PLN.
The full value is 222 380 996 000 PLN.

## The Bizraport Values

Bizraport reports different values for the same banks.

For Bank Pekao 2020, Bizraport reports total assets 233 217 182 000 PLN.
For Bank Pekao 2021, Bizraport reports total assets 250 566 605 000 PLN.
These values do not come from the RDF repository.
The RDF XHTML does not contain these values.

## The Compabase Values

Compabase reads the RDF XHTML files.
Compabase reports total assets 222 380 996 000 PLN for Pekao 2020.
This value is the same as our XHTML extraction.
Compabase does not have a separate bank source.

## The Source of Bizraport Values

Bizraport uses the published bank statements.
The banks publish their statements on investor relation sites.
These statements are text PDF files.
The text PDF files contain the real values.

We verified one PDF file from the Pekao investor site.
The file is a text PDF, not a scan.
The file has a text layer.
We can extract text from the file.

The source of the exact Bizraport values is the pb.pl financial reports.
The pb.pl site publishes the bank financial indicators.
The indicators include total assets, equity, and net profit.
The pb.pl values match the Bizraport values.

## The Method

We can extract text from text PDF files.
We use pdfjs to read the text.
We rebuild the table rows from the item coordinates.
We group the items by their Y position.
We sort the items by their X position.

This method works for the balance sheet table.
We found the row "Aktywa razem" with two values.
The values were in thousands of PLN.

We must identify the correct annual report for each bank.
This task is difficult.
The search engines return the wrong files.
We need a reliable instrument list instead.

## The Sources for Bank Data

We have two public sources for bank financial data.

The first source is the pb.pl financial reports.
The URL is notowania.pb.pl/instrument/{ISIN}/{symbol}/raporty-finansowe.
The page has a table with financial indicators.
The table has one column for each quarter.
The data is in the HTML data attributes.
The values are in thousands of PLN.

The second source is the Bankier API.
The URL is api.bankier.pl/quotes/public/company-profile-chart/{ISIN}.
The API returns company identity and market data.
The API needs no authentication.

## The Instrument List

The pb.pl site lists all GPW instruments.
The page is notowania.pb.pl/stocktable/GPWAKCJE.
The list has 354 instruments.
Each instrument has an ISIN and a symbol.

The list includes ten listed banks.
The list includes PZU (the insurer).
The list includes all other listed companies.

## The Limits

The pb.pl source covers listed companies only.
It does not cover unlisted banks.
It does not cover most small companies.

For unlisted banks, we can use the investor relation PDF files.
These files are text PDFs.
We must identify the file URL for each bank.
This task is manual.

Scanned PDF files in the RDF repository are not usable.
The streams are corrupted.
OCR does not work on these files.

## The Rule

We do not give up when one source fails.
We find another public source.
We verify the values against Bizraport.
We add the source as a separate provider.
