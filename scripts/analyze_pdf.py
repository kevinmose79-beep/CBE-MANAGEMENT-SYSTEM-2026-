import pdfplumber
from pdf2image import convert_from_path
import os

def analyze_pdf(pdf_path):
    print(f"=== ANALYZING PDF: {pdf_path} ===")
    with pdfplumber.open(pdf_path) as pdf:
        for p_idx, page in enumerate(pdf.pages):
            print(f"\n--- PAGE {p_idx + 1} (Width: {page.width:.2f}pt, Height: {page.height:.2f}pt) ---")
            
            # 1. Extract tables
            tables = page.find_tables()
            if not tables:
                print("No tables found via find_tables(). Extracting explicit grid lines / rects.")
                continue

            for t_idx, table in enumerate(tables):
                print(f"Table {t_idx + 1}: Bounding Box = {table.bbox}")
                
                # Cells matrix
                cells = table.cells
                rows = table.rows
                
                # Column boundaries from table cells/bbox
                col_bboxes = [] # list of (x0, x1) for each column
                if rows:
                    header_row = rows[0]
                    # Get x0, x1 for each cell in first row
                    # Or sort unique x boundaries
                    x_coords = sorted(list(set([c[0] for c in table.cells] + [c[2] for c in table.cells])))
                    print(f"Detected {len(x_coords)-1} columns across table.")
                    
                    col_widths = []
                    for i in range(len(x_coords) - 1):
                        w = x_coords[i+1] - x_coords[i]
                        col_widths.append((i, x_coords[i], x_coords[i+1], w))
                    
                    print("\n[STEP 1: COLUMN WIDTHS (pt & mm)]")
                    for col_i, x0, x1, w in col_widths:
                        print(f"Col {col_i:2d}: x0={x0:6.2f}pt, x1={x1:6.2f}pt | Width = {w:6.2f}pt ({w/2.83465:5.2f}mm)")
                    
                    print("\n[STEP 1: ROW HEIGHTS]")
                    row_heights = []
                    for r_idx, r in enumerate(rows):
                        r_top = r.bbox[1]
                        r_bottom = r.bbox[3]
                        r_h = r_bottom - r_top
                        row_heights.append((r_idx, r_top, r_bottom, r_h))
                        if r_idx < 5 or r_idx == len(rows) - 1:
                            print(f"Row {r_idx:2d}: top={r_top:6.2f}pt, bottom={r_bottom:6.2f}pt | Height = {r_h:5.2f}pt")
                        elif r_idx == 5:
                            print("... (data rows) ...")

                    # Step 2: Check consistency across data rows
                    print("\n[STEP 2: CHECK COLUMN WIDTH & ROW HEIGHT CONSISTENCY]")
                    data_rows = rows[1:] if len(rows) > 1 else rows
                    row_h_values = [r.bbox[3] - r.bbox[1] for r in data_rows]
                    min_rh, max_rh = min(row_h_values), max(row_h_values)
                    print(f"Data row heights min={min_rh:.2f}pt, max={max_rh:.2f}pt (diff={max_rh - min_rh:.2f}pt)")

                    # Step 3: Text overflow detection
                    table_top = table.bbox[1]
                    table_bottom = table.bbox[3]
                    
                    words = page.extract_words()
                    # Filter words strictly inside table vertical bounds
                    table_words = [w for w in words if table_top - 1.0 <= w['top'] <= table_bottom + 1.0]
                    
                    print(f"\n[STEP 3: OVERFLOW DETECTION (Total words in table area: {len(table_words)})]")
                    overflows = []
                    for w in table_words:
                        wx0, wx1 = w['x0'], w['x1']
                        wtext = w['text']
                        wtop, wbot = w['top'], w['bottom']
                        
                        # Find which column this word starts in
                        matching_col = None
                        for col_i, cx0, cx1, cw in col_widths:
                            if cx0 - 0.5 <= wx0 < cx1:
                                matching_col = (col_i, cx0, cx1, cw)
                                break
                        
                        if matching_col:
                            col_i, cx0, cx1, cw = matching_col
                            overflow_amount = wx1 - cx1
                            if overflow_amount > 0.3:
                                is_header = wtop < rows[0].bbox[3] if len(rows) > 0 else False
                                severity = "HEADER_OVERFLOW" if is_header else "DATA_OVERFLOW"
                                overflows.append({
                                    'word': wtext,
                                    'x0': wx0,
                                    'x1': wx1,
                                    'top': wtop,
                                    'col_i': col_i,
                                    'col_right': cx1,
                                    'overflow_pt': overflow_amount,
                                    'severity': severity
                                })

                    if overflows:
                        print(f"FLAGGED {len(overflows)} OVERFLOW INSTANCES:")
                        for of in overflows:
                            print(f" [{of['severity']}] Col {of['col_i']:2d} boundary ({of['col_right']:.2f}pt): word '{of['word']}' (x0={of['x0']:.2f}, x1={of['x1']:.2f}, top={of['top']:.2f}) -> OVERFLOW by {of['overflow_pt']:.2f}pt")
                    else:
                        print("No text overflow detected across column boundaries.")

if __name__ == "__main__":
    analyze_pdf("merit_list.pdf")
