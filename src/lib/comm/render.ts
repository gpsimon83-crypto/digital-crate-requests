// Communications Center — turns an EmailDesign into email-client-safe HTML
// (table layout, inline styles, 600px column, Outlook conditionals) plus a
// plain-text version. Pure functions: used by the Email Studio's live
// preview in the browser and by the server when sending, so what you see
// is exactly what goes out.

import type { EmailBlock, EmailDesign, MergeValues } from "./blocks";

interface Palette {
  page: string;
  card: string;
  text: string;
  muted: string;
  heading: string;
  accent: string;
  accentText: string;
  rule: string;
  logo: string;
}

const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    page: "#050505",
    card: "#0F0E0C",
    text: "#E9E1D3",
    muted: "#9C9384",
    heading: "#F6EFE2",
    accent: "#C9A15B",
    accentText: "#14100A",
    rule: "#2A2520",
    logo: "/brand/wing-logo-gold.png"
  },
  light: {
    page: "#F4EFE7",
    card: "#FFFFFF",
    text: "#2B2622",
    muted: "#7A7064",
    heading: "#0A0908",
    accent: "#A6763A",
    accentText: "#FFFFFF",
    rule: "#E7DDCC",
    logo: "/brand/wing-logo-black.png"
  }
};

const FONT = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Only real web/email/phone links are kept; anything else (javascript:, data:) is dropped. */
export function safeUrl(raw: string): string {
  const u = raw.trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  return "";
}

export function fillTokens(s: string, values: MergeValues): string {
  return s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, t: string) => values[t] ?? "");
}

/** Escaped text with **bold**, [label](url) links, paragraphs and line breaks. */
function formatRich(text: string, p: Palette): string {
  const paragraphs = escapeHtml(text.trim()).split(/\n{2,}/);
  return paragraphs
    .map((para) =>
      para
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
          const href = safeUrl(url.replace(/&amp;/g, "&"));
          return href ? `<a href="${escapeHtml(href)}" style="color:${p.accent};text-decoration:underline;">${label}</a>` : label;
        })
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|\n)- /g, "$1• ")
        .replace(/\n/g, "<br>")
    )
    .map((h) => `<p style="margin:0 0 14px;">${h}</p>`)
    .join("");
}

function row(inner: string, padding = "0 40px"): string {
  return `<tr><td style="padding:${padding};">${inner}</td></tr>`;
}

function renderBlock(b: EmailBlock, p: Palette, v: MergeValues, baseUrl: string): string {
  switch (b.type) {
    case "logo":
      return row(
        `<div style="text-align:center;"><img src="${escapeHtml(baseUrl + p.logo)}" width="120" alt="Digital Crate DJs" style="display:inline-block;width:120px;max-width:120px;height:auto;border:0;"></div>`,
        "32px 40px 8px"
      );
    case "heading": {
      const size = b.size === "lg" ? 30 : 22;
      return row(
        `<h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:${size}px;line-height:1.25;color:${p.heading};text-align:${b.align};">${escapeHtml(fillTokens(b.text, v))}</h1>`,
        "18px 40px 10px"
      );
    }
    case "text":
      return row(
        `<div style="font-family:${FONT};font-size:15px;line-height:1.65;color:${p.text};text-align:${b.align};">${formatRich(fillTokens(b.text, v), p)}</div>`,
        "6px 40px 4px"
      );
    case "image": {
      const src = safeUrl(b.url);
      if (!src) return "";
      const w = b.width === "full" ? 600 : b.width === "medium" ? 400 : 240;
      const pad = b.width === "full" ? "0" : "8px 40px";
      const img = `<img src="${escapeHtml(src)}" width="${w}" alt="${escapeHtml(b.alt)}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;margin:0 auto;${b.width === "full" ? "" : "border-radius:6px;"}">`;
      const href = safeUrl(fillTokens(b.link, v));
      return row(`<div style="text-align:center;">${href ? `<a href="${escapeHtml(href)}" target="_blank">${img}</a>` : img}</div>`, pad);
    }
    case "button": {
      const href = safeUrl(fillTokens(b.url, v));
      if (!href) return "";
      const solid = b.style === "solid";
      const bg = solid ? p.accent : "transparent";
      const color = solid ? p.accentText : p.accent;
      const table = `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:${b.align === "center" ? "0 auto" : "0"};"><tr><td style="border-radius:6px;background:${bg};border:2px solid ${p.accent};" bgcolor="${solid ? p.accent : p.card}"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${color};text-decoration:none;border-radius:6px;">${escapeHtml(fillTokens(b.label, v))}</a></td></tr></table>`;
      return row(table, "14px 40px");
    }
    case "divider":
      return row(`<div style="height:1px;line-height:1px;font-size:1px;background:${p.rule};">&nbsp;</div>`, "18px 40px");
    case "spacer":
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:1px;">&nbsp;</td></tr>`;
    case "social": {
      const links = (
        [
          ["Instagram", b.instagram],
          ["Facebook", b.facebook],
          ["TikTok", b.tiktok],
          ["YouTube", b.youtube],
          ["Website", b.website]
        ] as const
      )
        .map(([label, url]) => [label, safeUrl(url)] as const)
        .filter(([, url]) => url)
        .map(([label, url]) => `<a href="${escapeHtml(url)}" target="_blank" style="color:${p.accent};text-decoration:none;font-weight:bold;">${label}</a>`);
      if (!links.length) return "";
      return row(
        `<div style="text-align:center;font-family:${FONT};font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:${p.muted};">${links.join(`&nbsp;&nbsp;·&nbsp;&nbsp;`)}</div>`,
        "16px 40px"
      );
    }
    case "footer":
      return row(
        `<div style="font-family:${FONT};font-size:12px;line-height:1.6;color:${p.muted};text-align:center;">${formatRich(fillTokens(b.text, v), p)}</div>`,
        "22px 40px 30px"
      );
  }
}

export interface RenderOptions {
  /** Absolute origin for hosted brand images, e.g. https://cratesdjs.com */
  baseUrl: string;
}

export function renderEmailHtml(design: EmailDesign, values: MergeValues, opts: RenderOptions): string {
  const p = PALETTES[design.theme];
  const baseUrl = opts.baseUrl.replace(/\/$/, "");
  const body = design.blocks.map((b) => renderBlock(b, p, values, baseUrl)).join("\n");
  const subject = escapeHtml(fillTokens(design.subject, values));
  const pre = escapeHtml(fillTokens(design.preheader, values));
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="${design.theme === "dark" ? "dark" : "light"}">
<meta name="supported-color-schemes" content="${design.theme === "dark" ? "dark" : "light"}">
<title>${subject}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;}
  img{-ms-interpolation-mode:bicubic;}
  a{color:${p.accent};}
  @media (max-width:620px){ .dc-card td{padding-left:22px!important;padding-right:22px!important;} .dc-card h1{font-size:26px!important;} }
</style>
</head>
<body style="margin:0;padding:0;background:${p.page};" bgcolor="${p.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${pre}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:${p.page};" bgcolor="${p.page}">
<tr><td align="center" style="padding:24px 10px;">
<!--[if mso]><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" class="dc-card" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background:${p.card};border:1px solid ${p.rule};border-radius:8px;" bgcolor="${p.card}">
<tr><td style="height:3px;line-height:3px;font-size:1px;background:${p.accent};border-radius:8px 8px 0 0;" bgcolor="${p.accent}">&nbsp;</td></tr>
${body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

/** Plain-text alternative (sent alongside the HTML for deliverability and accessibility). */
export function renderEmailText(design: EmailDesign, values: MergeValues): string {
  const out: string[] = [];
  const plain = (s: string) =>
    fillTokens(s, values)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => `${label} (${url})`)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .trim();
  for (const b of design.blocks) {
    switch (b.type) {
      case "heading":
        out.push(plain(b.text).toUpperCase());
        break;
      case "text":
      case "footer":
        out.push(plain(b.text));
        break;
      case "button": {
        const href = safeUrl(fillTokens(b.url, values));
        if (href) out.push(`${plain(b.label)}: ${href}`);
        break;
      }
      case "image": {
        const href = safeUrl(fillTokens(b.link, values));
        if (href && b.alt) out.push(`${b.alt}: ${href}`);
        break;
      }
      case "social": {
        const links = [b.instagram, b.facebook, b.tiktok, b.youtube, b.website].map(safeUrl).filter(Boolean);
        if (links.length) out.push(links.join("\n"));
        break;
      }
      case "divider":
        out.push("—");
        break;
    }
  }
  return out.filter(Boolean).join("\n\n");
}
