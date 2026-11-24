type ParseMessage = { source: string; delimiter: string; maxRows: number };
type ParseResult = { headers: string[]; rows: string[][]; totalRows: number; truncated: boolean; error?: string };

self.onmessage = (event: MessageEvent<ParseMessage>) => {
  const { source, delimiter, maxRows } = event.data;
  try {
    const retained: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;
    let headers: string[] = [];
    let totalRows = 0;

    const commitRow = () => {
      row.push(field.replace(/\r$/, ""));
      field = "";
      const physicallyBlank = row.length === 1 && row[0].trim() === "";
      if (!physicallyBlank) {
        if (!headers.length) headers = row.map((value, index) => value.trim() || "Column " + (index + 1));
        else {
          totalRows += 1;
          if (retained.length < maxRows) retained.push(row);
        }
      }
      row = [];
    };

    for (let index = 0; index < source.length; index++) {
      const char = source[index];
      if (quoted) {
        if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && field.length === 0) quoted = true;
      else if (char === delimiter) { row.push(field); field = ""; }
      else if (char === "\n") commitRow();
      else field += char;
    }
    if (field.length || row.length) commitRow();

    if (headers.length === 0 || totalRows === 0) {
      self.postMessage({ error: "This file needs a header row and at least one data row." } satisfies ParseResult);
      return;
    }
    const width = headers.length;
    const rows = retained.map(record => Array.from({ length: width }, (_, index) => record[index] ?? ""));
    (self as DedicatedWorkerGlobalScope).postMessage({
      headers, rows, totalRows, truncated: totalRows > maxRows
    } satisfies ParseResult);
  } catch (error) {
    (self as DedicatedWorkerGlobalScope).postMessage({ error: error instanceof Error ? error.message : "Could not parse this dataset." } satisfies ParseResult);
  }
};
