const { validateSnapshot } = require("./ndx-snapshot-validation");

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function compareBySymbol(left, right) {
  return left.symbol.localeCompare(right.symbol);
}

function buildConstituentMap(snapshot) {
  return new Map(snapshot.constituents.map(function (item) {
    return [item.symbol, item];
  }));
}

function compareNdxSnapshots(previousInput, candidateInput) {
  const previous = validateSnapshot(previousInput);
  const candidate = validateSnapshot(candidateInput);
  if (candidate.effectiveDate <= previous.effectiveDate) {
    throw new Error("Candidate effective date must be after the baseline snapshot");
  }

  const previousBySymbol = buildConstituentMap(previous);
  const candidateBySymbol = buildConstituentMap(candidate);
  const added = [];
  const removed = [];
  const retained = [];

  candidateBySymbol.forEach(function (candidateItem, symbol) {
    const previousItem = previousBySymbol.get(symbol);
    if (!previousItem) {
      added.push(candidateItem);
      return;
    }
    const weightChangePercent = round(candidateItem.weightPercent - previousItem.weightPercent);
    retained.push({
      symbol,
      name: candidateItem.name,
      previousWeightPercent: previousItem.weightPercent,
      candidateWeightPercent: candidateItem.weightPercent,
      weightChangePercent
    });
  });
  previousBySymbol.forEach(function (previousItem, symbol) {
    if (!candidateBySymbol.has(symbol)) removed.push(previousItem);
  });

  const weightChanges = retained
    .filter(function (item) { return item.weightChangePercent !== 0; })
    .sort(function (left, right) {
      return Math.abs(right.weightChangePercent) - Math.abs(left.weightChangePercent) || compareBySymbol(left, right);
    });

  return {
    schemaVersion: "ndx-snapshot-review-v1",
    indexSymbol: candidate.indexSymbol,
    baseline: {
      effectiveDate: previous.effectiveDate,
      publishedAt: previous.publishedAt,
      sourceUrl: previous.sourceUrl,
      constituentCount: previous.constituents.length,
      totalWeightPercent: previous.totalWeightPercent
    },
    candidate: {
      effectiveDate: candidate.effectiveDate,
      publishedAt: candidate.publishedAt,
      sourceUrl: candidate.sourceUrl,
      constituentCount: candidate.constituents.length,
      totalWeightPercent: candidate.totalWeightPercent,
      isProForma: candidate.isProForma
    },
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      weightChangeCount: weightChanges.length,
      grossWeightChangePercent: round(weightChanges.reduce(function (sum, item) {
        return sum + Math.abs(item.weightChangePercent);
      }, 0)),
      netWeightChangePercent: round(candidate.totalWeightPercent - previous.totalWeightPercent)
    },
    added: added.sort(compareBySymbol),
    removed: removed.sort(compareBySymbol),
    weightChanges
  };
}

function hasMaterialMembershipChange(review) {
  return review.summary.addedCount > 0 || review.summary.removedCount > 0;
}

function snapshotsEquivalent(leftInput, rightInput) {
  const left = validateSnapshot(leftInput);
  const right = validateSnapshot(rightInput);
  if (
    left.indexSymbol !== right.indexSymbol
    || left.effectiveDate !== right.effectiveDate
    || left.publishedAt !== right.publishedAt
    || left.sourceUrl !== right.sourceUrl
    || left.weightPrecision !== right.weightPrecision
    || left.isProForma !== right.isProForma
    || left.constituents.length !== right.constituents.length
  ) return false;
  const leftItems = [...left.constituents].sort(compareBySymbol);
  const rightItems = [...right.constituents].sort(compareBySymbol);
  return leftItems.every(function (item, index) {
    const other = rightItems[index];
    return item.symbol === other.symbol && item.name === other.name && item.weightPercent === other.weightPercent;
  });
}

function toConstituentChangeRows(review, snapshotId, priorSnapshotId, instrumentIdBySymbol, capturedAt) {
  const rows = [];
  review.added.forEach(function (item) {
    rows.push({
      snapshot_id: snapshotId,
      prior_snapshot_id: priorSnapshotId,
      instrument_id: instrumentIdBySymbol.get(item.symbol),
      change_kind: "membership_added",
      previous_weight_percent: null,
      current_weight_percent: item.weightPercent,
      captured_at: capturedAt,
      metadata: { securityName: item.name, reviewSchemaVersion: review.schemaVersion }
    });
  });
  review.removed.forEach(function (item) {
    rows.push({
      snapshot_id: snapshotId,
      prior_snapshot_id: priorSnapshotId,
      instrument_id: instrumentIdBySymbol.get(item.symbol),
      change_kind: "membership_removed",
      previous_weight_percent: item.weightPercent,
      current_weight_percent: null,
      captured_at: capturedAt,
      metadata: { securityName: item.name, reviewSchemaVersion: review.schemaVersion }
    });
  });
  review.weightChanges.forEach(function (item) {
    rows.push({
      snapshot_id: snapshotId,
      prior_snapshot_id: priorSnapshotId,
      instrument_id: instrumentIdBySymbol.get(item.symbol),
      change_kind: "weight_changed",
      previous_weight_percent: item.previousWeightPercent,
      current_weight_percent: item.candidateWeightPercent,
      captured_at: capturedAt,
      metadata: {
        securityName: item.name,
        weightChangePercent: item.weightChangePercent,
        reviewSchemaVersion: review.schemaVersion
      }
    });
  });
  return rows.filter(function (row) { return Boolean(row.instrument_id); });
}

module.exports = { compareNdxSnapshots, hasMaterialMembershipChange, snapshotsEquivalent, toConstituentChangeRows };
