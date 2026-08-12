const { canonicalizeSourceUrl, sourceFingerprint } = require("./unified-market-events");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function validateSnapshot(input) {
  const snapshot = input && typeof input === "object" ? input : {};
  const indexSymbol = String(snapshot.indexSymbol || "").trim().toUpperCase();
  const effectiveDate = String(snapshot.effectiveDate || "").trim();
  const constituents = Array.isArray(snapshot.constituents) ? snapshot.constituents : [];
  if (indexSymbol !== "NDX") throw new Error("Only NDX snapshots are supported");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error("Invalid snapshot effective date");
  if (constituents.length < 100 || constituents.length > 110) throw new Error("NDX snapshot must contain 100-110 securities");
  const symbols = new Set();
  const normalized = constituents.map(function (item) {
    const symbol = String(item?.symbol || "").trim().toUpperCase();
    const name = String(item?.name || "").trim();
    const weightPercent = Number(item?.weightPercent);
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) throw new Error("Invalid NDX symbol: " + symbol);
    if (symbols.has(symbol)) throw new Error("Duplicate NDX symbol: " + symbol);
    if (!name) throw new Error("Missing NDX security name: " + symbol);
    if (!Number.isFinite(weightPercent) || weightPercent < 0 || weightPercent > 25) {
      throw new Error("Invalid NDX weight: " + symbol);
    }
    symbols.add(symbol);
    return { symbol, name, weightPercent: round(weightPercent) };
  });
  const totalWeightPercent = round(normalized.reduce(function (sum, item) { return sum + item.weightPercent; }, 0));
  if (totalWeightPercent < 99 || totalWeightPercent > 101) {
    throw new Error("NDX weights must total approximately 100%, received " + totalWeightPercent);
  }
  return {
    indexSymbol,
    effectiveDate,
    publishedAt: snapshot.publishedAt || null,
    sourceUrl: canonicalizeSourceUrl(snapshot.sourceUrl),
    weightPrecision: Number(snapshot.weightPrecision) || 2,
    isProForma: Boolean(snapshot.isProForma),
    constituents: normalized,
    totalWeightPercent
  };
}

async function upsertReturning(config, table, conflict, body) {
  const rows = await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflict, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body
  });
  return Array.isArray(rows) ? rows : [];
}

async function upsertMinimal(config, table, conflict, rows) {
  for (let index = 0; index < rows.length; index += 250) {
    await requestSupabase(config, "/rest/v1/" + table + "?on_conflict=" + conflict, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: rows.slice(index, index + 250)
    });
  }
}

async function importNdxSnapshot(input, now = new Date()) {
  const snapshot = validateSnapshot(input);
  const config = getSupabaseConfig();
  const capturedAt = now.toISOString();
  const sourceRows = await upsertReturning(config, "sources", "canonical_url", [{
    source_kind: "index_provider",
    provider: "Nasdaq",
    title: "Nasdaq-100 constituent weights as of " + snapshot.effectiveDate,
    canonical_url: snapshot.sourceUrl,
    content_fingerprint: sourceFingerprint(snapshot.sourceUrl),
    published_at: snapshot.publishedAt,
    available_at: snapshot.publishedAt || capturedAt,
    captured_at: capturedAt,
    metadata: { indexSymbol: snapshot.indexSymbol, effectiveDate: snapshot.effectiveDate }
  }]);
  const sourceId = sourceRows[0]?.id;
  if (!sourceId) throw new Error("Failed to persist NDX snapshot source");

  const existing = await requestSupabase(
    config,
    "/rest/v1/instruments?select=id,symbol&symbol=in.(" + snapshot.constituents.map(function (item) {
      return encodeURIComponent(item.symbol);
    }).join(",") + ")"
  );
  const instrumentBySymbol = new Map((existing || []).map(function (item) { return [item.symbol, item.id]; }));
  const missing = snapshot.constituents.filter(function (item) { return !instrumentBySymbol.has(item.symbol); });
  if (missing.length) {
    const inserted = await upsertReturning(config, "instruments", "symbol", missing.map(function (item) {
      return {
        symbol: item.symbol,
        display_name: item.name,
        exchange: "NASDAQ",
        currency: "USD",
        asset_type: "equity",
        instrument_role: "component",
        source: "Nasdaq NDX constituent PDF",
        source_as_of: snapshot.effectiveDate,
        updated_at: capturedAt
      };
    }));
    inserted.forEach(function (item) { instrumentBySymbol.set(item.symbol, item.id); });
  }

  const snapshotRows = await upsertReturning(config, "ndx_constituent_snapshots", "index_symbol,effective_date", [{
    index_symbol: snapshot.indexSymbol,
    effective_date: snapshot.effectiveDate,
    published_at: snapshot.publishedAt,
    source_url: snapshot.sourceUrl,
    source_id: sourceId,
    constituent_count: snapshot.constituents.length,
    total_weight_percent: snapshot.totalWeightPercent,
    weight_precision: snapshot.weightPrecision,
    is_pro_forma: snapshot.isProForma,
    captured_at: capturedAt,
    metadata: { official: true, roundedWeights: true },
    updated_at: capturedAt
  }]);
  const snapshotId = snapshotRows[0]?.id;
  if (!snapshotId) throw new Error("Failed to persist NDX snapshot");

  const ranked = [...snapshot.constituents].sort(function (left, right) {
    return right.weightPercent - left.weightPercent || left.symbol.localeCompare(right.symbol);
  });
  await upsertMinimal(config, "ndx_constituent_members", "snapshot_id,instrument_id", ranked.map(function (item, index) {
    return {
      snapshot_id: snapshotId,
      instrument_id: instrumentBySymbol.get(item.symbol),
      security_name: item.name,
      weight_percent: item.weightPercent,
      rank: index + 1,
      updated_at: capturedAt
    };
  }));

  return {
    snapshotId,
    indexSymbol: snapshot.indexSymbol,
    effectiveDate: snapshot.effectiveDate,
    constituentCount: snapshot.constituents.length,
    totalWeightPercent: snapshot.totalWeightPercent,
    sourceUrl: snapshot.sourceUrl
  };
}

function normalizeAsOf(value) {
  const asOf = String(value || "").trim();
  if (!asOf) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("Invalid as-of date");
  return asOf;
}

async function getNdxSnapshot(asOf) {
  const config = getSupabaseConfig();
  const normalizedAsOf = normalizeAsOf(asOf);
  const snapshots = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_snapshots?select=id,index_symbol,effective_date,published_at,source_url,constituent_count,total_weight_percent,weight_precision,is_pro_forma,captured_at,metadata"
      + "&effective_date=lte." + normalizedAsOf + "&order=effective_date.desc&limit=1"
  );
  const snapshot = Array.isArray(snapshots) ? snapshots[0] : null;
  if (!snapshot) return null;
  const members = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_members?select=security_name,weight_percent,rank,instruments(id,symbol,display_name,exchange,currency)"
      + "&snapshot_id=eq." + snapshot.id + "&order=rank.asc&limit=110"
  );
  return { ...snapshot, asOf: normalizedAsOf, members: Array.isArray(members) ? members : [] };
}

module.exports = { getNdxSnapshot, importNdxSnapshot, normalizeAsOf, validateSnapshot };
