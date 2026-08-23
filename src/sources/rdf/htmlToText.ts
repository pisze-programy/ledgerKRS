const HTML_ENTITY_RE = /&(nbsp|amp|lt|gt|quot|apos|#\d+);/g;

function decodeEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (match, name: string) => {
    switch (name.toLowerCase()) {
      case "nbsp":
        return " ";
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        if (name.startsWith("#")) {
          const code = Number(name.slice(1));
          return Number.isFinite(code) ? String.fromCharCode(code) : match;
        }
        return match;
    }
  });
}

/**
 * Convert PDF-rendered HTML/XHTML statements (banks and firms without XML) to
 * plain data lines. Strips style/script blocks and all tags, decodes entities,
 * collapses whitespace, and drops boilerplate lines (CSS, font-face, page
 * markers). Each returned line is a trimmed string; table cells land on their
 * own line (name and value are typically on adjacent lines).
 */
export function htmlToText(html: string): string[] {
  const withoutBlocks = html
    .replace(/<style[^>]*>.*?<\/style>/gis, " ")
    .replace(/<script[^>]*>.*?<\/script>/gis, " ")
    .replace(/<!--.*?-->/gis, " ");
  const text = decodeEntities(withoutBlocks.replace(/<[^>]+>/g, "\n"));
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 3);
  // Drop pure boilerplate: CSS rules, @-directives, font-face payloads.
  return lines.filter((line) => !/^(\.|\#|@|\{|[a-z-]+:\s*)/i.test(line));
}
