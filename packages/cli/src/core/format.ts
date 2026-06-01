export type TableInput = {
  headers: string[];
  rows: string[][];
};

export function formatTable(input: TableInput): string {
  if (input.headers.length === 0 && input.rows.length === 0) {
    return "";
  }

  const allRows =
    input.headers.length > 0 ? [input.headers, ...input.rows] : input.rows;
  const columnCount = Math.max(...allRows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, columnIndex) =>
    Math.max(...allRows.map((row) => row[columnIndex]?.length ?? 0)),
  );

  return allRows.map((row) => formatRow(row, widths)).join("\n");
}

export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function formatRow(row: string[], widths: number[]): string {
  return widths
    .map((width, columnIndex) => {
      const value = row[columnIndex] ?? "";
      const isLastColumn = columnIndex === widths.length - 1;

      return isLastColumn ? value : value.padEnd(width + 2, " ");
    })
    .join("")
    .trimEnd();
}
