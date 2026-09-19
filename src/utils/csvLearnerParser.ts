import Papa from 'papaparse';

export interface CsvParseResult {
  data: any[];
  errors: string[];
  warnings: string[];
  meta: Papa.ParseMeta;
}

/**
 * Robustly parses CSV / TSV / Semicolon / Pipe delimited files or strings
 * with BOM stripping, header trimming, multi-delimiter guessing, and
 * proper differentiation between fatal errors and non-fatal delimiter notices.
 */
export function parseLearnersCsv(input: File | string): Promise<CsvParseResult> {
  return new Promise((resolve) => {
    // If string is passed and empty
    if (typeof input === 'string' && !input.trim()) {
      resolve({
        data: [],
        errors: ['CSV content is empty.'],
        warnings: [],
        meta: {
          delimiter: ',',
          linebreak: '\n',
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      });
      return;
    }

    const config: Papa.ParseConfig = {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      delimitersToGuess: [',', '\t', '|', ';'],
      transformHeader: (header: string) => {
        // Strip BOM (\uFEFF) and surrounding whitespace
        return header.replace(/^\uFEFF/, '').trim();
      },
      complete: (results) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (results.errors && results.errors.length > 0) {
          for (const err of results.errors) {
            // UndetectableDelimiter is an informational fallback notice from PapaParse
            // when a file has 1 column or only 1 line where statistical delimiter guessing defaults to ','
            if (err.code === 'UndetectableDelimiter' || err.type === 'Delimiter') {
              warnings.push(`Notice: Single column or default comma delimiter utilized.`);
            } else if (err.code === 'TooFewFields' || err.code === 'TooManyFields') {
              warnings.push(`Row ${err.row !== undefined ? err.row + 1 : '?'}: ${err.message}`);
            } else {
              // Critical parsing error (e.g. UnclosedQuote, etc.)
              errors.push(err.message || 'Malformed CSV formatting');
            }
          }
        }

        // Filter out completely empty rows that might slip through
        const validRows = (results.data || []).filter((row: any) => {
          if (!row || typeof row !== 'object') return false;
          return Object.values(row).some((val) => val !== null && val !== undefined && String(val).trim() !== '');
        });

        resolve({
          data: validRows,
          errors,
          warnings,
          meta: results.meta,
        });
      },
      error: (err: Papa.ParseError) => {
        resolve({
          data: [],
          errors: [`Failed to read file: ${err.message}`],
          warnings: [],
          meta: {
            delimiter: ',',
            linebreak: '\n',
            aborted: true,
            truncated: false,
            cursor: 0,
          },
        });
      },
    } as Papa.ParseConfig;

    Papa.parse(input as any, config);
  });
}
