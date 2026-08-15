const { sourceFingerprint } = require("./unified-market-events");
const { getSupabaseConfig, requestSupabase } = require("./supabase-server");
const { compareNdxSnapshots, snapshotsEquivalent, toConstituentChangeRows } = require("./ndx-snapshot-review");
const { validateSnapshot } = require("./ndx-snapshot-validation");

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

async function getPriorSnapshot(config, indexSymbol, effectiveDate) {
  const snapshots = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_snapshots?select=id,index_symbol,effective_date,published_at,source_url,weight_precision,is_pro_forma"
      + "&index_symbol=eq." + encodeURIComponent(indexSymbol)
      + "&effective_date=lt." + effectiveDate
      + "&order=effective_date.desc&limit=1"
  );
  const snapshot = Array.isArray(snapshots) ? snapshots[0] : null;
  if (!snapshot) return null;
  const members = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_members?select=instrument_id,security_name,weight_percent,instruments(symbol)"
      + "&snapshot_id=eq." + snapshot.id
      + "&order=rank.asc&limit=110"
  );
  return {
    id: snapshot.id,
    snapshot: {
      indexSymbol: snapshot.index_symbol,
      effectiveDate: snapshot.effective_date,
      publishedAt: snapshot.published_at,
      sourceUrl: snapshot.source_url,
      weightPrecision: snapshot.weight_precision,
      isProForma: snapshot.is_pro_forma,
      constituents: (members || []).map(function (member) {
        return {
          symbol: member.instruments?.symbol,
          name: member.security_name,
          weightPercent: Number(member.weight_percent)
        };
      })
    },
    instrumentIdBySymbol: new Map((members || []).map(function (member) {
      return [member.instruments?.symbol, member.instrument_id];
    }).filter(function (entry) { return Boolean(entry[0] && entry[1]); }))
  };
}

async function getSnapshotAtEffectiveDate(config, indexSymbol, effectiveDate) {
  const snapshots = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_snapshots?select=id,index_symbol,effective_date,published_at,source_url,weight_precision,is_pro_forma"
      + "&index_symbol=eq." + encodeURIComponent(indexSymbol)
      + "&effective_date=eq." + effectiveDate
      + "&limit=1"
  );
  const snapshot = Array.isArray(snapshots) ? snapshots[0] : null;
  if (!snapshot) return null;
  const members = await requestSupabase(
    config,
    "/rest/v1/ndx_constituent_members?select=instrument_id,security_name,weight_percent,instruments(symbol)"
      + "&snapshot_id=eq." + snapshot.id
      + "&order=rank.asc&limit=110"
  );
  return {
    id: snapshot.id,
    snapshot: {
      indexSymbol: snapshot.index_symbol,
      effectiveDate: snapshot.effective_date,
      publishedAt: snapshot.published_at,
      sourceUrl: snapshot.source_url,
      weightPrecision: snapshot.weight_precision,
      isProForma: snapshot.is_pro_forma,
      constituents: (members || []).map(function (member) {
        return {
          symbol: member.instruments?.symbol,
          name: member.security_name,
          weightPercent: Number(member.weight_percent)
        };
      })
    }
  };
}

async function importNdxSnapshot(input, now = new Date()) {
  const snapshot = validateSnapshot(input);
  const config = getSupabaseConfig();
  const capturedAt = now.toISOString();
  const existingAtDate = await getSnapshotAtEffectiveDate(config, snapshot.indexSymbol, snapshot.effectiveDate);
  if (existingAtDate) {
    if (!snapshotsEquivalent(existingAtDate.snapshot, snapshot)) {
      throw new Error("Refusing to overwrite an existing NDX snapshot with different historical content");
    }
    return {
      snapshotId: existingAtDate.id,
      indexSymbol: snapshot.indexSymbol,
      effectiveDate: snapshot.effectiveDate,
      constituentCount: snapshot.constituents.length,
      totalWeightPercent: snapshot.totalWeightPercent,
      sourceUrl: snapshot.sourceUrl,
      priorSnapshotId: null,
      changeSummary: null,
      idempotent: true
    };
  }
  const prior = await getPriorSnapshot(config, snapshot.indexSymbol, snapshot.effectiveDate);
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
  prior?.instrumentIdBySymbol.forEach(function (instrumentId, symbol) {
    if (!instrumentBySymbol.has(symbol)) instrumentBySymbol.set(symbol, instrumentId);
  });
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

  let changeSummary = null;
  if (prior) {
    const review = compareNdxSnapshots(prior.snapshot, snapshot);
    const changes = toConstituentChangeRows(review, snapshotId, prior.id, instrumentBySymbol, capturedAt);
    await requestSupabase(config, "/rest/v1/ndx_constituent_changes?snapshot_id=eq." + snapshotId, { method: "DELETE" });
    if (changes.length) {
      await upsertMinimal(config, "ndx_constituent_changes", "snapshot_id,instrument_id,change_kind", changes);
    }
    changeSummary = review.summary;
  }

  return {
    snapshotId,
    indexSymbol: snapshot.indexSymbol,
    effectiveDate: snapshot.effectiveDate,
    constituentCount: snapshot.constituents.length,
    totalWeightPercent: snapshot.totalWeightPercent,
    sourceUrl: snapshot.sourceUrl,
    priorSnapshotId: prior?.id || null,
    changeSummary,
    idempotent: false
  };
}

function normalizeAsOf(value) {
  const asOf = String(value || "").trim();
  if (!asOf) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error("Invalid as-of date");
  return asOf;
}

async function getNdxSnapshot(asOf, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  const normalizedAsOf = normalizeAsOf(asOf);
  const snapshots = await requestImpl(
    config,
    "/rest/v1/ndx_constituent_snapshots?select=id,index_symbol,effective_date,published_at,source_url,constituent_count,total_weight_percent,weight_precision,is_pro_forma,captured_at,metadata"
      + "&effective_date=lte." + normalizedAsOf + "&order=effective_date.desc&limit=1"
  );
  const snapshot = Array.isArray(snapshots) ? snapshots[0] : null;
  if (!snapshot) return null;
  const members = await requestImpl(
    config,
    "/rest/v1/ndx_constituent_members?select=security_name,weight_percent,rank,instruments(id,symbol,display_name,exchange,currency)"
      + "&snapshot_id=eq." + snapshot.id + "&order=rank.asc&limit=110"
  );
  return { ...snapshot, asOf: normalizedAsOf, members: Array.isArray(members) ? members : [] };
}

const NDX_CHANGE_KIND_ORDER = {
  membership_added: 0,
  membership_removed: 1,
  weight_changed: 2
};

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNdxConstituentChanges(rows) {
  return (Array.isArray(rows) ? rows : []).map(function (row) {
    const changeKind = String(row?.change_kind || "");
    if (!(changeKind in NDX_CHANGE_KIND_ORDER)) return null;
    const instrument = row?.instruments || {};
    const previousWeightPercent = finiteNumber(row?.previous_weight_percent);
    const currentWeightPercent = finiteNumber(row?.current_weight_percent);
    return {
      changeKind,
      symbol: String(instrument.symbol || "").trim().toUpperCase(),
      displayName: String(instrument.display_name || row?.metadata?.securityName || "").trim() || null,
      previousWeightPercent,
      currentWeightPercent,
      weightChangePercent: previousWeightPercent !== null && currentWeightPercent !== null
        ? Number((currentWeightPercent - previousWeightPercent).toFixed(6))
        : null
    };
  }).filter(function (row) {
    return Boolean(row && row.symbol);
  }).sort(function (left, right) {
    const kindDifference = NDX_CHANGE_KIND_ORDER[left.changeKind] - NDX_CHANGE_KIND_ORDER[right.changeKind];
    if (kindDifference) return kindDifference;
    const magnitudeDifference = Math.abs(right.weightChangePercent || 0) - Math.abs(left.weightChangePercent || 0);
    return magnitudeDifference || left.symbol.localeCompare(right.symbol);
  });
}

function summarizeNdxConstituentChanges(changes) {
  const summary = {
    total: 0,
    membershipAdded: 0,
    membershipRemoved: 0,
    weightChanged: 0
  };
  (Array.isArray(changes) ? changes : []).forEach(function (change) {
    summary.total += 1;
    if (change.changeKind === "membership_added") summary.membershipAdded += 1;
    if (change.changeKind === "membership_removed") summary.membershipRemoved += 1;
    if (change.changeKind === "weight_changed") summary.weightChanged += 1;
  });
  return summary;
}

async function getNdxConstituentChangeSummary(snapshot, config = getSupabaseConfig(), requestImpl = requestSupabase) {
  if (!snapshot?.id || !snapshot?.effective_date) {
    return {
      status: "no_snapshot",
      effectiveDate: null,
      baselineEffectiveDate: null,
      summary: summarizeNdxConstituentChanges([]),
      changes: []
    };
  }
  const [priorRows, changeRows] = await Promise.all([
    requestImpl(
      config,
      "/rest/v1/ndx_constituent_snapshots?select=effective_date"
        + "&index_symbol=eq." + encodeURIComponent(snapshot.index_symbol || "NDX")
        + "&effective_date=lt." + encodeURIComponent(snapshot.effective_date)
        + "&order=effective_date.desc&limit=1"
    ),
    requestImpl(
      config,
      "/rest/v1/ndx_constituent_changes?select=change_kind,previous_weight_percent,current_weight_percent,metadata,instruments(symbol,display_name)"
        + "&snapshot_id=eq." + encodeURIComponent(snapshot.id)
        + "&limit=250"
    )
  ]);
  const changes = normalizeNdxConstituentChanges(changeRows);
  const baselineEffectiveDate = Array.isArray(priorRows) ? priorRows[0]?.effective_date || null : null;
  return {
    status: baselineEffectiveDate ? (changes.length ? "changes_recorded" : "no_recorded_change") : "first_snapshot",
    effectiveDate: snapshot.effective_date,
    baselineEffectiveDate,
    summary: summarizeNdxConstituentChanges(changes),
    changes
  };
}

module.exports = {
  getNdxConstituentChangeSummary,
  getNdxSnapshot,
  getPriorSnapshot,
  getSnapshotAtEffectiveDate,
  importNdxSnapshot,
  normalizeAsOf,
  normalizeNdxConstituentChanges,
  summarizeNdxConstituentChanges,
  validateSnapshot
};
