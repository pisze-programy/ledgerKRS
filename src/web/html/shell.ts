export interface ShellOptions {
  lang: string;
  title: string;
  description: string;
  bodyHtml: string;
  cssPath: string;
  jsPath: string;
}

export function shell(options: ShellOptions): string {
  const languageLinks = languageNav(options.lang);
  return `<!doctype html>
<html lang="${options.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${options.description}">
  <title>${options.title}</title>
  <link rel="stylesheet" href="${options.cssPath}">
</head>
<body>
  <header>
    <span class="brand">raporty-firmowe</span>
    <nav class="langs">${languageLinks}</nav>
  </header>
  <main>
    <section class="hero">${options.bodyHtml}</section>
  </main>
  <footer>
    <p>raporty-firmowe · public data about Polish companies · <a href="https://github.com/pisze-programy/ledgerKRS" data-embed>GitHub</a> · kontakt@raporty-firmowe.dev</p>
  </footer>
  <script src="${options.jsPath}" defer></script>
</body>
</html>`;
}

function languageNav(current: string): string {
  return [
    navLink("pl", current, "PL"),
    navLink("en", current, "EN"),
  ].join("\n    ");
}

function navLink(lang: string, current: string, label: string): string {
  const active = current === lang ? ' class="active"' : "";
  const href = lang === "pl" ? "/" : "/en";
  return `<a href="${href}"${active} hreflang="${lang}">${label}</a>`;
}
