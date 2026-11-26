function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function profileColumn(name, values, total = values.length) {
  const present = values.map(value => String(value ?? "").trim()).filter(Boolean);
  const numeric = present.length > 0 && present.every(value => Number.isFinite(Number(value)));
  const dates = !numeric && present.length > 0 && present.every(value =>
    /^\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}$/.test(value) && Number.isFinite(Date.parse(value))
  );
  const numbers = numeric ? present.map(Number) : [];
  return {
    name,
    type: numeric ? "Numeric" : dates ? "Date" : "Text",
    missing: Math.max(0, total - present.length),
    unique: new Set(present).size,
    ...(numeric ? {
      min: String(numbers.reduce((value, item) => Math.min(value, item), Number.POSITIVE_INFINITY)),
      max: String(numbers.reduce((value, item) => Math.max(value, item), Number.NEGATIVE_INFINITY)),
      mean: (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2),
      median: median(numbers).toFixed(2)
    } : {})
  };
}

export function profileDataset(headers, rows, totalRows = rows.length) {
  return headers.map((name, index) =>
    profileColumn(name, rows.map(row => row[index] ?? ""), rows.length)
  );
}

export function summarizeDataset(headers, rows, totalRows = rows.length) {
  let missingCells = 0;
  let completeRows = 0;
  const seen = new Set();
  let duplicateRows = 0;
  for (const row of rows) {
    let complete = true;
    for (let index = 0; index < headers.length; index++) {
      if (String(row[index] ?? "").trim() === "") {
        missingCells++;
        complete = false;
      }
    }
    if (complete) completeRows++;
    const key = JSON.stringify(headers.map((_, index) => String(row[index] ?? "")));
    if (seen.has(key)) duplicateRows++;
    else seen.add(key);
  }
  return {
    rows: totalRows,
    columns: headers.length,
    missingCells,
    duplicateRows,
    completeRows
  };
}
