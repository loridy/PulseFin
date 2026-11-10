#!/usr/bin/env node
/**
 * PulseFin P0 read-only source probe.
 * node scripts/pulsefin-p0-probe.mjs [--only=wscn-global,fed-monetary] [--timeout=12000]
 *
 * No database writes, ingestion, AI calls or copying of third-party content.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

export const SOURCES = [
  { id: "wscn-global", region: "GLOBAL", role: "media", kind: "wscn_json", url: "https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&client=pc&limit=50&first_page=true" },
  { id: "fed-monetary", region: "US", role: "official", kind: "rss", url: "https://www.federalreserve.gov/feeds/press_monetary.xml" },
  { id: "bls-cpi", region: "US", role: "official", kind: "rss", url: "https://www.bls.gov/feed/cpi.rss" },
  { id: "bls-employment", region: "US", role: "official", kind: "rss", url: "https://www.bls.gov/feed/empsit.rss" },
  { id: "bls-jolts", region: "US", role: "official", kind: "rss", url: "https://www.bls.gov/feed/jolts.rss" },
  { id: "bea-news", region: "US", role: "official", kind: "rss", url: "https://apps.bea.gov/rss/rss.xml" },
  { id: "nbs-releases", region: "CN", role: "official", kind: "rss", url: "https://www.stats.gov.cn/sj/zxfb/rss.xml" },
  { id: "nbs-analysis", region: "CN", role: "official", kind: "rss", url: "https://www.stats.gov.cn/sj/sjjd/rss.xml" },
];

function getTag(xml, tag) {
  const re = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i");
  const match = re.exec(xml);
  if (!match) return null;
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, "").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() || null;
}

export function summarizeRss(xml) {
  if (typeof xml !== "string" || !/<(rss|feed)\b/i.test(xml)) {
    throw new Error("RSS/Atom root not found");
  }
  const items = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  const first = items[0] || "";
  return {
    item_count: items.length,
    latest_title: getTag(first, "title"),
    latest_published_at: getTag(first, "pubDate") || getTag(first, "published") || getTag(first, "updated"),
  };
}

export function summarizeWscn(raw) {
  const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (payload?.code !== 20000 || !Array.isArray(payload?.data?.items)) {
    throw new Error("Unexpected WallStreetCN payload");
  }
  const items = payload.data.items;
  const first = items[0];
  return {
    item_count: items.length,
    latest_external_id: first?.id == null ? null : String(first.id),
    latest_title: first ? String(first.title || first.content_text || "").slice(0, 160) : null,
    latest_published_at: Number.isFinite(Number(first?.display_time))
      ? new Date(Number(first.display_time) * 1000).toISOString() : null,
    next_cursor: payload.data.next_cursor ?? null,
    polling_cursor: payload.data.polling_cursor ?? null,
  };
}

export async function inspectSource(source, timeoutMs = 12000) {
  const started = performance.now();
  try {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
      headers: {
        "User-Agent": "PulseFinProbe/0.1 (+https://github.com/loridy/PulseFin)",
        "Accept": "application/json, application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
      },
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.text();
    const info = source.kind === "wscn_json" ? summarizeWscn(payload) : summarizeRss(payload);
    return {
      source_id: source.id, region: source.region, role: source.role,
      status: "ok", latency_ms: Math.round(performance.now() - started), ...info,
    };
  } catch (error) {
    return {
      source_id: source.id, region: source.region, role: source.role,
      status: "error", latency_ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function main(args = process.argv.slice(2)) {
  const onlyFlag = args.find((a) => a.startsWith("--only="));
  const only = onlyFlag ? new Set(onlyFlag.slice(7).split(",")) : null;
  const timeoutFlag = args.find((a) => a.startsWith("--timeout="));
  const timeout = timeoutFlag ? Number(timeoutFlag.slice(10)) : 12000;
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) {
    throw new Error("--timeout must be between 1000 and 60000 milliseconds");
  }
  const chosen = SOURCES.filter((s) => !only || only.has(s.id));
  if (!chosen.length) throw new Error("No matching source IDs");
  const results = await Promise.all(chosen.map((source) => inspectSource(source, timeout)));
  const healthy = results.filter((r) => r.status === "ok").length;
  process.stdout.write(JSON.stringify({
    project: "PulseFin", purpose: "P0 source probe (not ingestion)",
    checked_at: new Date().toISOString(),
    total: chosen.length, healthy, results,
  }, null, 2) + "\n");
  if (healthy !== chosen.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
