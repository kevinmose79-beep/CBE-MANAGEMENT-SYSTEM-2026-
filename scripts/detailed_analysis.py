import pdfplumber
import json

def DetailedAnalysis():
    with pdfplumber.open("merit_list.pdf") as pdf:
        report = []
        for p_idx, page in enumerate(pdf.pages):
            p_data = {
                "page": p_idx + 1,
                "width": page.width,
                "height": page.height,
                "tables": []
            }
            tables = page.find_tables()
            words = page.extract_words()

            for t_idx, table in enumerate(tables):
                t_bbox = table.bbox
                x_coords = sorted(list(set([c[0] for c in table.cells] + [c[2] for c in table.cells])))
                col_bounds = [(x_coords[i], x_coords[i+1]) for i in range(len(x_coords)-1)]
                
                rows_info = []
                for r_idx, r in enumerate(table.rows):
                    r_top = r.bbox[1]
                    r_bot = r.bbox[3]
                    r_h = r_bot - r_top
                    rows_info.append({
                        "row_index": r_idx,
                        "top": r_top,
                        "bottom": r_bot,
                        "height": r_h
                    })
                
                # Filter words in table area
                t_words = [w for w in words if t_bbox[1] - 1.0 <= w['top'] <= t_bbox[3] + 1.0]
                
                overflows = []
                for w in t_words:
                    wx0, wx1 = w['x0'], w['x1']
                    wtext = w['text']
                    wtop = w['top']
                    
                    # Find starting column
                    col_found = None
                    for c_idx, (cx0, cx1) in enumerate(col_bounds):
                        if cx0 - 0.5 <= wx0 < cx1:
                            col_found = c_idx
                            col_right = cx1
                            break
                    
                    if col_found is not None:
                        overflow_pt = wx1 - col_right
                        if overflow_pt > 0.3:
                            is_header = wtop < table.rows[0].bbox[3] if len(table.rows) > 0 else False
                            overflows.append({
                                "word": wtext,
                                "x0": round(wx0, 2),
                                "x1": round(wx1, 2),
                                "col_index": col_found,
                                "col_boundary": round(col_right, 2),
                                "overflow_pt": round(overflow_pt, 2),
                                "is_header": is_header
                            })
                
                p_data["tables"].append({
                    "table_index": t_idx + 1,
                    "bbox": t_bbox,
                    "num_cols": len(col_bounds),
                    "col_bounds": col_bounds,
                    "rows": rows_info,
                    "overflows": overflows
                })
            report.append(p_data)
        
        with open("detailed_analysis.json", "w") as f:
            json.dump(report, f, indent=2)

if __name__ == "__main__":
    DetailedAnalysis()
