import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeRss, summarizeWscn } from "./pulsefin-p0-probe.mjs";

test("RSS parsing reads first item and date", () => {
  const out = summarizeRss('<rss><channel><item><title>A &amp; B</title><pubDate>Tue, 10 Nov 2026 08:30:00 GMT</pubDate></item></channel></rss>');
  assert.equal(out.item_count, 1);
  assert.equal(out.latest_title, "A & B");
  assert.equal(out.latest_published_at, "Tue, 10 Nov 2026 08:30:00 GMT");
});

test("WSCN parsing uses content fallback and exposes cursors", () => {
  const out = summarizeWscn({ code: 20000, data: {
    items: [{ id: 123, title: "", content_text: "Example headline", display_time: 1794299400 }],
    next_cursor: "1794299400", polling_cursor: "123",
  } });
  assert.equal(out.latest_external_id, "123");
  assert.equal(out.latest_title, "Example headline");
  assert.equal(out.polling_cursor, "123");
  assert.equal(out.item_count, 1);
});

test("Malformed payload fails clearly", () => {
  assert.throws(() => summarizeRss("unexpected"), /root/);
  assert.throws(() => summarizeWscn({ code: 20000, data: {} }), /payload/);
});
