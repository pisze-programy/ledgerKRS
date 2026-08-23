import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const errorSchema = z.object({ error: z.string().openapi({ description: "Opis błędu po polsku" }) });
const chargeMeta = {
  credits_spent: z.number().optional().openapi({ description: "Liczba zużytych kredytów (1 za zapytanie, które zwróciło dane)" }),
  credits_remaining: z.number().optional().openapi({ description: "Kredyty pozostałe po zapytaniu" }),
};

const addressSchema = z
  .strictObject({
    street: z.string().nullable().optional().openapi({ description: "Ulica siedziby" }),
    postalCode: z.string().nullable().optional().openapi({ description: "Kod pocztowy" }),
    city: z.string().nullable().optional().openapi({ description: "Miejscowość" }),
    voivodeship: z.string().nullable().optional().openapi({ description: "Województwo" }),
    country: z.string().nullable().optional().openapi({ description: "Kraj" }),
  })
  .openapi("Address");

const companySchema = z
  .strictObject({
    krs: z.string().openapi({ description: "Numer KRS — 10 cyfr" }),
    nip: z.string().nullable().optional().openapi({ description: "Numer NIP" }),
    regon: z.string().nullable().optional().openapi({ description: "Numer REGON" }),
    name: z.string().nullable().optional().openapi({ description: "Pełna nazwa firmy" }),
    legalForm: z.string().nullable().optional().openapi({ description: "Forma prawna" }),
    legalFormNormalized: z.string().nullable().optional().openapi({ description: "Forma prawna — znormalizowana" }),
    address: addressSchema.optional(),
    registrationDate: z.string().nullable().optional().openapi({ description: "Data wpisu do rejestru (YYYY-MM-DD)" }),
    startDate: z.string().nullable().optional().openapi({ description: "Data rozpoczęcia działalności" }),
    capital: z.number().nullable().optional().openapi({ description: "Kapitał zakładowy w złotych" }),
    capitalCurrency: z.string().nullable().optional().openapi({ description: "Waluta kapitału" }),
    statusOpp: z.boolean().optional().openapi({ description: "Czy ma status organizacji pożytku publicznego" }),
    liquidation: z.boolean().optional().openapi({ description: "Czy jest w likwidacji" }),
    bankruptcy: z.boolean().optional().openapi({ description: "Czy jest w upadłości" }),
    restructuring: z.boolean().optional().openapi({ description: "Czy jest w restrukturyzacji" }),
    arrangement: z.boolean().optional().openapi({ description: "Czy jest w postępowaniu układowym" }),
    organRejestrowy: z.string().nullable().optional().openapi({ description: "Sąd rejestrowy prowadzący KRS" }),
    formaWlasnosci: z.string().nullable().optional().openapi({ description: "Forma własności" }),
    sposobReprezentacji: z.string().nullable().optional().openapi({ description: "Sposób reprezentacji spółki" }),
    organReprezentujacy: z.string().nullable().optional().openapi({ description: "Organ reprezentujący spółkę" }),
    organNadzoru: z.string().nullable().optional().openapi({ description: "Organ nadzoru" }),
    celDzialalnosci: z.string().nullable().optional().openapi({ description: "Cel działalności spółki" }),
    website: z.string().nullable().optional().openapi({ description: "Adres strony internetowej" }),
    email: z.string().nullable().optional().openapi({ description: "Adres email kontaktowy" }),
    numerNieruchomosci: z.string().nullable().optional().openapi({ description: "Numer nieruchomości" }),
  })
  .openapi("Company");

const extendedConnectionSchema = z
  .strictObject({
    typPodmiotu: z.enum(["Osoba", "Organizacja"]).openapi({ description: "Typ podmiotu: osoba albo organizacja" }),
    nazwa: z.string().openapi({ description: "Nazwa osoby albo organizacji" }),
    typPowiazania: z.string().openapi({ description: "Typ powiązania (reprezentacja, wspólnik, organ nadzoru, prokurent, inne)" }),
    idPodmiotu: z.string().nullable().optional().openapi({ description: "Identyfikator podmiotu — KRS dla organizacji, wewnętrzny dla osoby" }),
  })
  .openapi("ExtendedConnection");

const connectionSchema = z
  .strictObject({
    typPodmiotu: z.enum(["Osoba", "Organizacja"]).openapi({ description: "Typ podmiotu: osoba albo organizacja" }),
    nazwa: z.string().openapi({ description: "Nazwa osoby albo organizacji" }),
    typPowiazania: z.string().openapi({ description: "Typ powiązania (reprezentacja, wspólnik, organ nadzoru, prokurent, inne)" }),
    idPodmiotu: z.string().nullable().optional().openapi({ description: "Identyfikator podmiotu — KRS dla organizacji, wewnętrzny dla osoby" }),
    organ: z.string().nullable().optional().openapi({ description: "Organ, w którym działa podmiot" }),
    funkcja: z.string().nullable().optional().openapi({ description: "Funkcja pełniona w organie" }),
    powiazaniaRozszerzone: z
      .array(extendedConnectionSchema)
      .optional()
      .openapi({ description: "Powiązania podmiotu, jeden poziom głębiej" }),
  })
  .openapi("Connection");

const ownershipSchema = z
  .strictObject({
    typPodmiotu: z.enum(["Osoba", "Organizacja"]).nullable().optional().openapi({ description: "Typ podmiotu" }),
    nazwa: z.string().nullable().optional().openapi({ description: "Nazwa udziałowca" }),
    procentUdzialow: z.number().nullable().optional().openapi({ description: "Procent udziałów w skali 0–100" }),
    idPodmiotu: z.string().nullable().optional().openapi({ description: "KRS udziałowca, jeśli to organizacja" }),
  })
  .openapi("OwnershipShare");

const pkdSchema = z
  .strictObject({
    code: z.string().openapi({ description: "Kod PKD, np. 62.01.Z" }),
    description: z.string().nullable().optional().openapi({ description: "Opis działalności wg PKD" }),
  })
  .openapi("PkdCode");

const statementSchema = z
  .strictObject({
    periodFrom: z.string().nullable().optional().openapi({ description: "Początek okresu sprawozdawczego" }),
    periodTo: z.string().nullable().optional().openapi({ description: "Koniec okresu sprawozdawczego" }),
    filedAt: z.string().nullable().optional().openapi({ description: "Data złożenia sprawozdania" }),
  })
  .openapi("StatementReference");

const indicatorSchema = z
  .strictObject({
    nazwa_wskaznika: z.string().openapi({ description: "Nazwa wskaźnika, np. przychody, zysk_netto, ebit, ebitda, roe" }),
    kwota: z.number().openapi({ description: "Wartość wskaźnika" }),
  })
  .openapi("Indicator");

const financialYearSchema = z
  .strictObject({
    okresSprawozdawczy: z.string().openapi({ description: "Okres sprawozdawczy, np. 01-01-2024_31-12-2024" }),
    rok: z.number().nullable().openapi({ description: "Rok okresu" }),
    indicators: z.array(indicatorSchema).openapi({ description: "Wskaźniki finansowe za okres" }),
  })
  .openapi("FinancialYear");

const monitorSchema = z
  .strictObject({
    numerOgloszenia: z.string().nullable().optional().openapi({ description: "Numer ogłoszenia" }),
    sygnaturaSprawy: z.string().nullable().optional().openapi({ description: "Sygnatura sprawy" }),
    trescNaglowka: z.string().nullable().optional().openapi({ description: "Treść nagłówka ogłoszenia" }),
    nrMonitora: z.string().nullable().optional().openapi({ description: "Numer Monitora (numer/rok)" }),
    rozdzial: z.string().nullable().optional().openapi({ description: "Rozdział Monitora" }),
    trescOgloszenia: z.string().nullable().optional().openapi({ description: "Treść ogłoszenia" }),
    dataPublikacji: z.string().nullable().optional().openapi({ description: "Data publikacji (YYYY-MM-DD)" }),
    nazwaPodmiotu: z.string().nullable().optional().openapi({ description: "Nazwa podmiotu" }),
    poziomIstotnosci: z
      .enum(["UWAGA", "Rzuć okiem", "Zmiana formalna"])
      .nullable()
      .optional()
      .openapi({ description: "Poziom istotności ogłoszenia" }),
  })
  .openapi("MonitorEntry");

const krzSchema = z
  .strictObject({
    dataKrz: z.string().nullable().optional().openapi({ description: "Data wpisu w KRZ (YYYY-MM-DD)" }),
    grupaKategoriiTytul: z.string().nullable().optional().openapi({ description: "Grupa kategorii obwieszczenia" }),
    kategoriaTytul: z.string().nullable().optional().openapi({ description: "Kategoria obwieszczenia" }),
    numerObwieszczenia: z.string().nullable().optional().openapi({ description: "Numer obwieszczenia" }),
    tytulObwieszczenia: z.string().nullable().optional().openapi({ description: "Tytuł obwieszczenia" }),
    sygnaturaAkt: z.string().nullable().optional().openapi({ description: "Sygnatura akt" }),
    sad: z.string().nullable().optional().openapi({ description: "Sąd" }),
    wydzialSadu: z.string().nullable().optional().openapi({ description: "Wydział sądu" }),
    dluznikTyp: z.string().nullable().optional().openapi({ description: "Typ dłużnika" }),
    tresc: z.string().nullable().optional().openapi({ description: "Treść obwieszczenia" }),
    idOsoby: z.string().nullable().optional().openapi({ description: "Identyfikator osoby" }),
    przypisanieDoKrs: z.string().nullable().optional().openapi({ description: "Przypisanie do KRS" }),
  })
  .openapi("KrzEntry");

const historySchema = z
  .strictObject({
    okresSprawozdawczy: z.string().nullable().optional().openapi({ description: "Okres sprawozdawczy" }),
    rok: z.number().nullable().optional().openapi({ description: "Rok okresu" }),
    terminZlozenia: z.string().nullable().optional().openapi({ description: "Ustawowy termin złożenia" }),
    dataDodaniaDoKrs: z.string().nullable().optional().openapi({ description: "Data dodania do KRS" }),
  })
  .openapi("StatementHistoryEntry");

const descriptionSchema = z
  .strictObject({
    opis: z.string().nullable().optional().openapi({ description: "Opis działalności firmy" }),
    punktKluczowy1: z.string().nullable().optional().openapi({ description: "Punkt kluczowy profilu biznesowego" }),
    punktKluczowy2: z.string().nullable().optional().openapi({ description: "Punkt kluczowy profilu biznesowego" }),
    punktKluczowy3: z.string().nullable().optional().openapi({ description: "Punkt kluczowy profilu biznesowego" }),
    punktKluczowy4: z.string().nullable().optional().openapi({ description: "Punkt kluczowy profilu biznesowego" }),
    punktKluczowy5: z.string().nullable().optional().openapi({ description: "Punkt kluczowy profilu biznesowego" }),
  })
  .openapi("CompanyDescription");

const benchmarkRowSchema = z
  .strictObject({
    okresSprawozdawczy: z.string().nullable().optional().openapi({ description: "Okres sprawozdawczy" }),
    rok: z.number().nullable().optional().openapi({ description: "Rok" }),
    nazwaWskaznika: z.string().openapi({ description: "Nazwa wskaźnika" }),
    percentylWPkd: z.number().openapi({ description: "Percentyl w grupie PKD, ułamek 0–1" }),
    udzialWRynku: z.number().nullable().optional().openapi({ description: "Udział w rynku (tylko dla przychodów)" }),
    przychodyCalejBranzy: z.number().nullable().optional().openapi({ description: "Suma przychodów branży (tylko dla przychodów)" }),
    liczbaFirmWBranzy: z.number().nullable().optional().openapi({ description: "Liczba firm w branży (tylko dla przychodów)" }),
  })
  .openapi("IndustryBenchmarkRow");

const reportSchema = z
  .strictObject({
    company: companySchema.openapi({ description: "Dane rejestrowe firmy" }),
    connections: z.array(connectionSchema).openapi({ description: "Powiązania osobowe i korporacyjne" }),
    ownership: z.array(ownershipSchema).openapi({ description: "Struktura właścicielska" }),
    pkdCodes: z.array(pkdSchema).openapi({ description: "Kody PKD działalności" }),
    statements: z.array(statementSchema).openapi({ description: "Wzmianki o złożonych sprawozdaniach" }),
    financials: z.array(financialYearSchema).openapi({ description: "Wskaźniki finansowe wg okresów" }),
    monitor: z.array(monitorSchema).openapi({ description: "Ogłoszenia z Monitora Sądowego i Gospodarczego" }),
    krz: z.array(krzSchema).openapi({ description: "Wpisy z Krajowego Rejestru Zadłużonych" }),
    history: z.array(historySchema).openapi({ description: "Historia złożonych sprawozdań" }),
    descriptions: z.array(descriptionSchema).openapi({ description: "Opisy działalności firmy" }),
    benchmarks: z.array(benchmarkRowSchema).openapi({ description: "Pozycja firmy na tle branży PKD" }),
  })
  .openapi("CompanyReport");

const dataWrapper = <T extends z.ZodType>(schema: T, description: string) =>
  z
    .strictObject({
      data: z.array(schema).openapi({ description }),
    })
    .openapi("Data");

const katalogRowSchema = z
  .strictObject({
    krs: z.string().openapi({ description: "Numer KRS" }),
    name: z.string().nullable().openapi({ description: "Nazwa firmy" }),
    nip: z.string().nullable().openapi({ description: "Numer NIP" }),
    regon: z.string().nullable().openapi({ description: "Numer REGON" }),
    legal_form: z.string().nullable().openapi({ description: "Forma prawna" }),
    miasto: z.string().nullable().openapi({ description: "Miejscowość" }),
    wojewodztwo: z.string().nullable().openapi({ description: "Województwo" }),
    pkd_podklasa: z.string().nullable().openapi({ description: "Podklasa PKD" }),
    aktywa: z.number().nullable().optional().openapi({ description: "Aktywa (suma bilansowa)" }),
    przychody: z.number().nullable().optional().openapi({ description: "Przychody" }),
    zysk_netto: z.number().nullable().optional().openapi({ description: "Zysk netto" }),
    wartosc_firmy: z.number().nullable().optional().openapi({ description: "Szacowana wartość firmy" }),
  })
  .openapi("CatalogRow");

const katalogResponse = z
  .strictObject({
    data: z.array(katalogRowSchema).openapi({ description: "Lista firm pasujących do filtrów" }),
    count: z.number().openapi({ description: "Łączna liczba pasujących firm" }),
    fetchedCount: z.number().openapi({ description: "Liczba pobranych firm w tym wywołaniu" }),
    ...chargeMeta,
  })
  .openapi("CatalogResponse");

const searchResponse = z
  .strictObject({
    data: z.array(z.strictObject({ krs: z.string().openapi({ description: "Numer KRS" }) })).openapi({ description: "Lista pasujących KRS" }),
    dane_uciete: z.boolean().openapi({ description: "Czy lista jest niekompletna (więcej niż ~100 tys. wyników)" }),
    ...chargeMeta,
  })
  .openapi("SearchResponse");

const statementPositionSchema = z
  .strictObject({
    pozycja_szczegolowa: z.string().nullable().openapi({ description: "Aktywa albo Pasywa — tylko dla Bilansu" }),
    kod_pozycji: z.string().nullable().openapi({ description: "Kod pozycji ze schematu sprawozdania" }),
    poziom_zaglebienia: z.number().nullable().openapi({ description: "Poziom zagłębienia w hierarchii pozycji" }),
    nazwa_pozycji: z.string().nullable().openapi({ description: "Nazwa pozycji" }),
    kwota: z.number().nullable().openapi({ description: "Kwota w złotych" }),
  })
  .openapi("StatementPosition");

const statementSectionSchema = z
  .strictObject({
    sekcja: z.string().openapi({ description: "Bilans, Rachunek zysków i strat, Rachunek przepływów pieniężnych albo Zestawienie zmian w kapitale" }),
    pozycje: z.array(statementPositionSchema).openapi({ description: "Pozycje sekcji w kolejności ze źródła" }),
  })
  .openapi("StatementSection");

const statementPeriodSchema = z
  .strictObject({
    okres_sprawozdawczy: z.string().openapi({ description: "Okres sprawozdawczy, np. 01-01-2024_31-12-2024" }),
    sekcje: z.array(statementSectionSchema).openapi({ description: "Złożone sekcje sprawozdania" }),
  })
  .openapi("StatementPeriod");

const sprawozdaniaResponse = z
  .strictObject({
    ...chargeMeta,
    data: z
      .array(
        z.strictObject({
          krs: z.string().openapi({ description: "Numer KRS" }),
          okresy: z.array(statementPeriodSchema).openapi({ description: "Okresy sprawozdawcze, najnowszy pierwszy" }),
        }),
      )
      .openapi({ description: "Sprawozdania firm" }),
  })
  .openapi("SprawozdaniaResponse");

const branchDivisionSchema = z
  .strictObject({
    code: z.string().openapi({ description: "Kod działu PKD" }),
    name: z.string().openapi({ description: "Nazwa działu PKD" }),
    level: z.string().openapi({ description: "Poziom taksonomii" }),
  })
  .openapi("BranchDivision");

const branchSectionSchema = z
  .strictObject({
    code: z.string().openapi({ description: "Kod sekcji PKD" }),
    name: z.string().openapi({ description: "Nazwa sekcji PKD" }),
    level: z.string().openapi({ description: "Poziom taksonomii" }),
    divisions: z.array(branchDivisionSchema).openapi({ description: "Działy w sekcji" }),
  })
  .openapi("BranchSection");

const branzeResponse = dataWrapper(branchSectionSchema, "Sekcje PKD z działami").extend(chargeMeta);

const pkdTopRowSchema = z
  .strictObject({
    krs: z.string().openapi({ description: "Numer KRS" }),
    name: z.string().nullable().openapi({ description: "Nazwa firmy" }),
    przychody: z.number().nullable().openapi({ description: "Przychody" }),
  })
  .openapi("PkdTopRow");

const growthSchema = z
  .strictObject({
    countGrowthPerYear: z.number().nullable().openapi({ description: "Wzrost liczby firm rocznie" }),
    revenueGrowthPerYear: z.number().nullable().openapi({ description: "Wzrost przychodów branży rocznie" }),
    cagr: z.number().nullable().openapi({ description: "Średnia roczna stopa wzrostu (CAGR)" }),
  })
  .openapi("BranchGrowth");

const percentileBlockSchema = z
  .strictObject({
    "10": z.number().nullable().openapi({ description: "10% największych firm jest powyżej tej wartości" }),
    "20": z.number().nullable().openapi({ description: "20% firm jest powyżej tej wartości" }),
    "50": z.number().nullable().openapi({ description: "Połowa firm jest powyżej tej wartości" }),
    "90": z.number().nullable().openapi({ description: "90% firm jest powyżej tej wartości" }),
  })
  .openapi("PercentileBlock");

const pkdReportSchema = z
  .strictObject({
    code: z.string().openapi({ description: "Kod PKD" }),
    name: z.string().openapi({ description: "Nazwa branży" }),
    level: z.string().openapi({ description: "Poziom taksonomii" }),
    parent: z.string().nullable().openapi({ description: "Kod nadrzędny" }),
    section: z.string().nullable().openapi({ description: "Sekcja PKD" }),
    slug: z.string().openapi({ description: "Slug nazwy branży" }),
    year: z.number().openapi({ description: "Rok raportu" }),
    years: z.array(z.number()).openapi({ description: "Dostępne lata" }),
    summary: z
      .strictObject({
        count: z.number().openapi({ description: "Liczba organizacji w branży" }),
        total_przychody: z.number().nullable().openapi({ description: "Suma przychodów branży" }),
        avg_przychod: z.number().nullable().openapi({ description: "Przeciętny przychód" }),
        avg_zysk: z.number().nullable().openapi({ description: "Przeciętny zysk" }),
      })
      .openapi({ description: "Podsumowanie branży" }),
    size: z
      .strictObject({
        count: z.number().openapi({ description: "Liczba organizacji w branży" }),
        total_przychody: z.number().nullable().openapi({ description: "Suma przychodów branży" }),
        growth: growthSchema.openapi({ description: "Wzrost branży" }),
      })
      .openapi({ description: "Rozmiar branży" }),
    top: z.array(pkdTopRowSchema).openapi({ description: "Największe firmy w branży" }),
    geo: z.record(z.string(), z.number()).openapi({ description: "Liczba firm wg województw" }),
    percentiles: z
      .strictObject({
        przychody: percentileBlockSchema.openapi({ description: "Percentyle przychodów" }),
        zysk: percentileBlockSchema.openapi({ description: "Percentyle zysku" }),
        wartosc: percentileBlockSchema.openapi({ description: "Percentyle wyceny" }),
      })
      .openapi({ description: "Percentyle wskaźników" }),
  })
  .openapi("PkdReport");

const pkdResponse = dataWrapper(pkdReportSchema, "Raport branżowy").extend(chargeMeta);

const transactionSchema = z
  .strictObject({
    id: z.number().openapi({ description: "Identyfikator transakcji" }),
    accountId: z.number().openapi({ description: "Identyfikator konta" }),
    type: z.string().openapi({ description: "Typ transakcji (topup, spend, free)" }),
    amount: z.number().openapi({ description: "Kwota w kredytach (ujemna dla spend)" }),
    ref: z.string().nullable().openapi({ description: "Referencja transakcji" }),
    status: z.string().openapi({ description: "Status (applied, pending)" }),
    applyAt: z.string().nullable().openapi({ description: "Kiedy kredyty zostały doliczone" }),
    createdAt: z.string().openapi({ description: "Data utworzenia" }),
  })
  .openapi("CreditTransaction");

const balanceResponse = z
  .strictObject({ balance: z.number().openapi({ description: "Stan kredytów na koncie" }) })
  .openapi("BalanceResponse");

const zuzycieResponse = z
  .strictObject({
    model: z.string().openapi({ description: "Model rozliczeniowy (payg)" }),
    price_per_credit_pln: z.number().openapi({ description: "Cena jednego kredytu w złotych" }),
    balance: z.number().openapi({ description: "Stan kredytów" }),
    zuzycie: z.record(z.string(), z.number()).openapi({ description: "Liczba odpytań per endpoint" }),
    transactions: z.array(transactionSchema).openapi({ description: "Transakcje kredytowe" }),
  })
  .openapi("ZuzycieResponse");

const accountResponse = z
  .strictObject({
    account_id: z.number().openapi({ description: "Identyfikator konta" }),
    email: z.string().openapi({ description: "Adres email" }),
    api_key: z.string().openapi({ description: "Klucz API — wysyłaj w nagłówku X-API-Key" }),
    balance: z.number().openapi({ description: "Kredyty na koncie (100 gratis)" }),
  })
  .openapi("AccountResponse");

const checkoutResponse = z
  .strictObject({
    checkout_url: z.string().openapi({ description: "Adres płatności Stripe" }),
    mode: z.enum(["mock", "live"]).openapi({ description: "Tryb płatności" }),
    credits: z.number().openapi({ description: "Liczba kredytów w pakiecie" }),
    price_pln: z.number().openapi({ description: "Cena pakietu w złotych" }),
    confirm_after_ms: z.number().optional().openapi({ description: "Po ilu ms kredyty dochodzą (tryb mock)" }),
    pending: z.boolean().optional().openapi({ description: "Czy kredyty są w trakcie doliczania" }),
  })
  .openapi("CheckoutResponse");

const webhookResponse = z
  .strictObject({ ok: z.boolean().openapi({ description: "Czy webhook został przyjęty" }) })
  .openapi("WebhookResponse");

const catalogQuery = z
  .object({
    przychody_od: z.string().optional().openapi({ description: "Minimalne przychody (zł)" }),
    przychody_do: z.string().optional().openapi({ description: "Maksymalne przychody (zł)" }),
    zysk_netto_od: z.string().optional().openapi({ description: "Minimalny zysk netto (zł)" }),
    zysk_netto_do: z.string().optional().openapi({ description: "Maksymalny zysk netto (zł)" }),
    pkd_sekcja: z.string().optional().openapi({ description: "Sekcja PKD, np. J" }),
    pkd_dzial: z.string().optional().openapi({ description: "Dział PKD, np. 62" }),
    pkd_podklasa: z.string().optional().openapi({ description: "Podklasa PKD, np. 62.01.Z" }),
    wojewodztwo: z.string().optional().openapi({ description: "Województwo, np. MAZOWIECKIE" }),
    miasto: z.string().optional().openapi({ description: "Fragment nazwy miasta" }),
    adres: z.string().optional().openapi({ description: "Fragment nazwy ulicy" }),
    roa_od: z.string().optional().openapi({ description: "ROA od — liczba całkowita, np. 15 = 15%" }),
    roe_od: z.string().optional().openapi({ description: "ROE od — liczba całkowita" }),
    nie_wykreslona: z.enum(["tak"]).optional().openapi({ description: "Tylko aktywne firmy" }),
    cit_estonski: z.enum(["tak"]).optional().openapi({ description: "Prawdopodobnie CIT estoński" }),
    ostatni_krz: z.string().optional().openapi({ description: "Wpis w KRZ z ostatnich N dni" }),
    ostatni_monitor: z.string().optional().openapi({ description: "Wpis w MSiG z ostatnich N dni" }),
    sort: z.string().optional().openapi({ description: "Kolumna sortowania" }),
    order: z.enum(["asc", "desc"]).optional().openapi({ description: "Kierunek sortowania" }),
    limit: z.string().optional().openapi({ description: "Limit wyników (domyślnie 100)" }),
    offset: z.string().optional().openapi({ description: "Pominięte wyniki" }),
  })
  .openapi("CatalogQuery");

const krsOrNip = z
  .object({
    krs: z.string().optional().openapi({ description: "Numer KRS (1–10 cyfr)" }),
    nip: z.string().optional().openapi({ description: "Numer NIP (10 cyfr)" }),
  })
  .refine((d) => d.krs || d.nip, { message: "podaj krs albo nip" })
  .openapi("KrsOrNip");

const pkdParams = z
  .object({
    code: z.string().openapi({ description: "Kod PKD: sekcja, dział, grupa albo podklasa, np. 62, 62.01.Z, J" }),
    rok: z.string().optional().openapi({ description: "Rok sprawozdawczy" }),
  })
  .openapi("PkdParams");

const accountBody = z
  .strictObject({ email: z.string().email().openapi({ description: "Adres email" }) })
  .openapi("AccountBody");

const webhookBody = z
  .strictObject({ type: z.string().optional().openapi({ description: "Typ zdarzenia Stripe" }) })
  .openapi("WebhookBody");

export const accountRoute = createRoute({
  method: "post",
  path: "/api/account",
  description: "Załóż konto — POST, zwraca api_key i 100 kredytów",
  request: { body: { content: { "application/json": { schema: accountBody } } } },
  responses: {
    200: { description: "Konto utworzone", content: { "application/json": { schema: accountResponse } } },
    400: { description: "Brak email", content: { "application/json": { schema: errorSchema } } },
  },
});

export const balanceRoute = createRoute({
  method: "get",
  path: "/api/balance",
  description: "Stan kredytów na koncie",
  responses: {
    200: { description: "Stan kredytów", content: { "application/json": { schema: balanceResponse } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
  },
});

export const zuzycieRoute = createRoute({
  method: "get",
  path: "/api/zuzycie",
  description: "Zużycie kredytów per endpoint i transakcje",
  responses: {
    200: { description: "Zużycie i transakcje", content: { "application/json": { schema: zuzycieResponse } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
  },
});

export const checkoutRoute = createRoute({
  method: "post",
  path: "/api/billing/checkout",
  description: "Adres płatności za pakiet kredytów",
  responses: {
    200: { description: "Adres płatności", content: { "application/json": { schema: checkoutResponse } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
  },
});

export const webhookRoute = createRoute({
  method: "post",
  path: "/api/billing/webhook",
  description: "Potwierdzenie płatności z Stripe",
  request: { body: { content: { "application/json": { schema: webhookBody } } } },
  responses: {
    200: { description: "Webhook przyjęty", content: { "application/json": { schema: webhookResponse } } },
    400: { description: "Zły payload", content: { "application/json": { schema: errorSchema } } },
  },
});

export const sprawozdaniaRoute = createRoute({
  method: "get",
  path: "/api/sprawozdania",
  description: "Sprawozdania finansowe, pozycja po pozycji",
  request: { query: krsOrNip },
  responses: {
    200: { description: "Sprawozdania", content: { "application/json": { schema: sprawozdaniaResponse } } },
    400: { description: "Brak krs albo nip", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const katalogRoute = createRoute({
  method: "get",
  path: "/api/katalog",
  description: "Filtry firm: finanse, PKD, lokalizacja, wskaźniki",
  request: { query: catalogQuery },
  responses: {
    200: { description: "Lista firm", content: { "application/json": { schema: katalogResponse } } },
    400: { description: "Brak filtra", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const szukajRoute = createRoute({
  method: "get",
  path: "/api/szukaj",
  description: "Szukanie po nazwie, NIP, KRS albo REGON",
  request: { query: z.object({ q: z.string().min(1).openapi({ description: "Fraza: nazwa, NIP, KRS albo REGON" }) }).openapi("SearchQuery") },
  responses: {
    200: { description: "Lista pasujących KRS", content: { "application/json": { schema: searchResponse } } },
    400: { description: "Brak q", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const branzeRoute = createRoute({
  method: "get",
  path: "/api/branze",
  description: "Sekcje i działy PKD",
  responses: {
    200: { description: "Sekcje i działy PKD", content: { "application/json": { schema: branzeResponse } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const pkdRoute = createRoute({
  method: "get",
  path: "/api/pkd/{code}",
  description: "Raport branżowy dla kodu PKD",
  request: { params: pkdParams },
  responses: {
    200: { description: "Raport branżowy", content: { "application/json": { schema: pkdResponse } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Branża nie znaleziona", content: { "application/json": { schema: errorSchema } } },
  },
});

export const API_EXAMPLES: Record<string, { request: string; response: string }> = {
  account: {
    request: `curl -X POST -H "Content-Type: application/json" \\
  -d '{"email":"ty@przyklad.pl"}' "{{BASE}}/api/account"`,
    response: `{
  "account_id": 1,
  "email": "ty@przyklad.pl",
  "api_key": "5c52…",
  "balance": 100
}`,
  },
  balance: {
    request: `curl "{{BASE}}/api/balance" \\
  -H "x-api-key: $KEY"`,
    response: `{ "balance": 98 }`,
  },
  zuzycie: {
    request: `curl "{{BASE}}/api/zuzycie" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "model": "payg",
  "balance": 98,
  "zuzycie": { "/dane": 1, "/katalog": 1 },
  "transactions": [ … ]
}`,
  },
  checkout: {
    request: `curl -X POST "{{BASE}}/api/billing/checkout" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "checkout_url": "https://checkout.stripe.com/…",
  "mode": "mock",
  "credits": 1000,
  "price_pln": 9.99,
  "confirm_after_ms": 5000,
  "pending": true
}`,
  },
  dane: {
    request: `curl "{{BASE}}/api/dane?krs=0000222483" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [{
    "company": { "krs": "0000222483", "name": "JERONIMO MARTINS POLSKA S.A." },
    "connections": [ … ],
    "ownership": [ … ],
    "pkdCodes": [ … ],
    "statements": [ … ],
    "financials": [ … ],
    "monitor": [ … ],
    "krz": [],
    "history": [ … ]
  }]
}`,
  },
  sprawozdania: {
    request: `curl "{{BASE}}/api/sprawozdania?krs=0000597711" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [{
    "krs": "0000597711",
    "okresy": [{
      "okres_sprawozdawczy": "01-03-2024_28-02-2025",
      "sekcje": [{
        "sekcja": "Bilans",
        "pozycje": [ { "pozycja_szczegolowa": "Aktywa", "kod_pozycji": "Aktywa",
          "poziom_zaglebienia": 1, "nazwa_pozycji": "Aktywa razem", "kwota": 20171082000 } ]
      }]
    }]
  }]
}`,
  },
  katalog: {
    request: `curl "{{BASE}}/api/katalog?przychody_od=10000000000&amp;wojewodztwo=WIELKOPOLSKIE" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "count": 4,
  "fetchedCount": 4,
  "data": [{
    "krs": "0000222483", "name": "JERONIMO MARTINS POLSKA S.A.",
    "przychody": 108317454729, "zysk_netto": 3600000000,
    "aktywa": 30341528084, "wartosc_firmy": 90900000000
  }]
}`,
  },
  szukaj: {
    request: `curl "{{BASE}}/api/szukaj?q=baseli" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [ { "krs": "0000795513" }, { "krs": "0000581581" } ],
  "dane_uciete": false
}`,
  },
  branze: {
    request: `curl "{{BASE}}/api/branze" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [{
    "code": "A", "name": "Rolnictwo, leśnictwo, łowiectwo i rybactwo",
    "divisions": [ { "code": "01", "name": "Uprawy rolne, chów i hodowla zwierząt" } ]
  }]
}`,
  },
  pkd: {
    request: `curl "{{BASE}}/api/pkd/47.11.Z?rok=2024" \\
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [{
    "code": "47.11.Z", "year": 2024,
    "summary": { "count": 3400, "total_przychody": 120000000000 },
    "percentiles": { "przychody": { "50": 1500000, "90": 23000000 } },
    "top": [ { "krs": "0000222483", "name": "JERONIMO MARTINS POLSKA S.A." } ]
  }]
}`,
  },
  raport: {
    request: `curl "{{BASE}}/api/raport?krs=0000222483" \
  -H "x-api-key: $KEY"`,
    response: `{
  "data": [{
    "krs": "0000222483",
    "summary": { "przychody": 108317454729, "zysk_netto": 3600000000, "wartosc_firmy": 90900000000 },
    "finansowe": [ { "okres_sprawozdawczy": "01-01-2024_31-12-2024", "wskazniki": { … },
      "wycena": { "srednia": … }, "kredyt_kupiecki": { … }, "ryzyko": { … } } ],
    "terminowosc": { "razem": 3, "w_terminie": 2, "po_terminie": 1, "srednie_opoznienie_dni": 21 },
    "pozycja_na_tle_branzy": [ … ],
    "opisy_firmy": [ … ],
    "powiazania_pochodne": { "identyczny_nip": [ … ], "zwrotne": [ … ] },
    "podobne_organizacje": [ { "krs": "…", "name": "…" } ]
  }]
}`,
  },
};

export const ENDPOINT_ORDER = [
  "account",
  "dane",
  "sprawozdania",
  "katalog",
  "szukaj",
  "branze",
  "pkd",
  "balance",
  "zuzycie",
] as const;


const summarySchema = z
  .strictObject({
    aktywa: z.number().nullable().openapi({ description: "Suma bilansowa (aktywa) za ostatni rok" }),
    przychody: z.number().nullable().openapi({ description: "Przychody za ostatni rok" }),
    zysk_netto: z.number().nullable().openapi({ description: "Zysk netto za ostatni rok" }),
    wartosc_firmy: z.number().nullable().openapi({ description: "Szacowana wartość firmy (średnia)" }),
    zatrudnienie: z.number().nullable().openapi({ description: "Zatrudnienie" }),
    branza_glowna: z
      .strictObject({ kod: z.string().nullable().openapi({ description: "Kod głównej branży PKD" }), opis: z.string().nullable().openapi({ description: "Opis głównej branży" }) })
      .openapi({ description: "Główna branża PKD" }),
    rok: z.number().nullable().openapi({ description: "Rok podsumowania" }),
  })
  .openapi("ReportSummary");

const financialSeriesSchema = z
  .strictObject({
    okres_sprawozdawczy: z.string().openapi({ description: "Okres sprawozdawczy" }),
    rok: z.number().nullable().openapi({ description: "Rok" }),
    wskazniki: z.record(z.string(), z.number()).openapi({ description: "Wskaźniki finansowe za okres (nazwa -> kwota)" }),
    wycena: z
      .strictObject({
        minimalna: z.number().nullable().openapi({ description: "Wycena minimalna" }),
        srednia: z.number().nullable().openapi({ description: "Wycena średnia" }),
        maksymalna: z.number().nullable().openapi({ description: "Wycena maksymalna" }),
      })
      .openapi({ description: "Wycena firmy" }),
    kredyt_kupiecki: z
      .strictObject({
        minimalny: z.number().nullable().openapi({ description: "Kredyt kupiecki minimalny" }),
        sredni: z.number().nullable().openapi({ description: "Kredyt kupiecki średni" }),
        maksymalny: z.number().nullable().openapi({ description: "Kredyt kupiecki maksymalny" }),
      })
      .openapi({ description: "Kredyt kupiecki" }),
    ryzyko: z
      .strictObject({
        prawdopodobienstwo_24m: z.number().nullable().openapi({ description: "Prawdopodobieństwo niewypłacalności w ciągu 24 miesięcy (0-1)" }),
        wiarygodnosc: z.number().nullable().openapi({ description: "Wiarygodność 1-5 (1 = najwyższa)" }),
      })
      .openapi({ description: "Ryzyko i wiarygodność" }),
  })
  .openapi("FinancialSeries");

const terminowoscSchema = z
  .strictObject({
    razem: z.number().openapi({ description: "Liczba złożonych sprawozdań" }),
    w_terminie: z.number().openapi({ description: "Złożone w terminie" }),
    po_terminie: z.number().openapi({ description: "Złożone po terminie" }),
    srednie_opoznienie_dni: z.number().nullable().openapi({ description: "Średnie opóźnienie w dniach (ujemne = przed terminem)" }),
  })
  .openapi("Terminowosc");

const similarOrgSchema = z
  .strictObject({
    krs: z.string().openapi({ description: "Numer KRS" }),
    name: z.string().nullable().openapi({ description: "Nazwa" }),
    pkd_podklasa: z.string().nullable().openapi({ description: "Podklasa PKD" }),
    przychody: z.number().nullable().openapi({ description: "Przychody" }),
    zysk_netto: z.number().nullable().openapi({ description: "Zysk netto" }),
  })
  .openapi("SimilarOrganization");

const derivedConnectionsSchema = z
  .strictObject({
    identyczny_nip: z.array(z.strictObject({ krs: z.string(), name: z.string().nullable() })).openapi({ description: "Firmy o identycznym NIP" }),
    identyczny_regon: z.array(z.strictObject({ krs: z.string(), name: z.string().nullable() })).openapi({ description: "Firmy o identycznym REGON" }),
    zwrotne: z.array(z.strictObject({ krs: z.string(), name: z.string().nullable(), typ: z.string() })).openapi({ description: "Powiązania zwrotne" }),
  })
  .openapi("DerivedConnections");

const raportSchema = z
  .strictObject({
    krs: z.string().openapi({ description: "Numer KRS" }),
    nip: z.string().nullable().openapi({ description: "NIP" }),
    regon: z.string().nullable().openapi({ description: "REGON" }),
    kod_pkd: z.string().nullable().openapi({ description: "Kod głównej branży PKD" }),
    opis_pkd: z.string().nullable().openapi({ description: "Opis głównej branży" }),
    informacje_o_firmie: companySchema.openapi({ description: "Pełne dane rejestrowe" }),
    summary: summarySchema.openapi({ description: "Podsumowanie (4 karty + branża)" }),
    finansowe: z.array(financialSeriesSchema).openapi({ description: "Serie finansowe per rok" }),
    monitor: z.array(monitorSchema).openapi({ description: "Monitor Sądowy i Gospodarczy" }),
    krz: z.array(krzSchema).openapi({ description: "Krajowy Rejestr Zadłużonych" }),
    historia_sprawozdan: z.array(historySchema).openapi({ description: "Historia złożonych sprawozdań" }),
    terminowosc: terminowoscSchema.openapi({ description: "Terminowość sprawozdań" }),
    pozycja_na_tle_branzy: z.array(benchmarkRowSchema).openapi({ description: "Percentyle na tle branży PKD per rok" }),
    opisy_firmy: z.array(descriptionSchema).openapi({ description: "Opisy działalności" }),
    powiazania: z.array(connectionSchema).openapi({ description: "Powiązania" }),
    powiazania_pochodne: derivedConnectionsSchema.openapi({ description: "Powiązania pochodne (graf)" }),
    udzialowcy: z.array(ownershipSchema).openapi({ description: "Struktura właścicielska" }),
    podobne_organizacje: z.array(similarOrgSchema).openapi({ description: "Podobne organizacje" }),
  })
  .openapi("CompanyRaport");

const daneResponse = dataWrapper(raportSchema, "Bogaty raport firmy — po krs maksymalnie jeden element").extend(chargeMeta);
const raportResponse = z
  .strictObject({ data: z.array(raportSchema).openapi({ description: "Bogaty raport firmy" }), ...chargeMeta })
  .openapi("RaportResponse");

export const raportRoute = createRoute({
  method: "get",
  path: "/api/raport",
  request: { query: krsOrNip },
  responses: {
    200: { description: "Bogaty raport firmy", content: { "application/json": { schema: raportResponse } } },
    400: { description: "Brak krs albo nip", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const daneRoute = createRoute({
  method: "get",
  path: "/api/dane",
  description: "Bogaty raport firmy po KRS albo NIP (finanse, terminowość, powiązania, podobne organizacje)",
  request: { query: krsOrNip },
  responses: {
    200: { description: "Bogaty raport firmy", content: { "application/json": { schema: daneResponse } } },
    400: { description: "Brak krs albo nip", content: { "application/json": { schema: errorSchema } } },
    401: { description: "Brak klucza API", content: { "application/json": { schema: errorSchema } } },
    402: { description: "Brak wystarczających kredytów", content: { "application/json": { schema: errorSchema } } },
  },
});

export const API_SCHEMAS = {
  dane: daneResponse,
  sprawozdania: sprawozdaniaResponse,
  katalog: katalogResponse,
  szukaj: searchResponse,
  branze: branzeResponse,
  pkd: pkdResponse,
  balance: balanceResponse,
  zuzycie: zuzycieResponse,
  account: accountResponse,
};

export function buildOpenApiDocument(): Record<string, unknown> {
  const app = new OpenAPIHono();
  const dummy = (c: { json: (body: unknown) => unknown }) => c.json({});
  app.openapi(accountRoute, dummy as never);
  app.openapi(balanceRoute, dummy as never);
  app.openapi(zuzycieRoute, dummy as never);
  app.openapi(checkoutRoute, dummy as never);
  app.openapi(webhookRoute, dummy as never);
  app.openapi(daneRoute, dummy as never);
  app.openapi(sprawozdaniaRoute, dummy as never);
  app.openapi(katalogRoute, dummy as never);
  app.openapi(szukajRoute, dummy as never);
  app.openapi(branzeRoute, dummy as never);
  app.openapi(pkdRoute, dummy as never);
  app.openapi(raportRoute, dummy as never);
  return app.getOpenAPIDocument({
    openapi: "3.1.0",
    info: { title: "raporty-firmowe API", version: "0.1.0" },
  }) as unknown as Record<string, unknown>;
}
