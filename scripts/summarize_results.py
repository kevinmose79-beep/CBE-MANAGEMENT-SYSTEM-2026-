import json

with open("detailed_analysis.json") as f:
    data = json.load(f)

for page in data:
    p_num = page["page"]
    print(f"\n================ PAGE {p_num} ================")
    for table in page["tables"]:
        t_num = table["table_index"]
        bbox = table["bbox"]
        num_cols = table["num_cols"]
        rows = table["rows"]
        overflows = table["overflows"]
        
        print(f"Table {t_num}: Cols={num_cols}, Bbox={[round(b,2) for b in bbox]}")
        
        # Cols width summary
        widths = [round(b[1] - b[0], 2) for b in table["col_bounds"]]
        print(f" Column Widths (pt): {widths}")
        
        # Row height summary
        heights = [round(r["height"], 2) for r in rows]
        if len(heights) > 1:
            header_h = heights[0]
            data_h = heights[1:]
            print(f" Header Row Height: {header_h} pt ({header_h/2.83465:.2f} mm)")
            print(f" Data Rows Count: {len(data_h)} | Heights: min={min(data_h)} pt, max={max(data_h)} pt (Uniformity diff: {max(data_h)-min(data_h):.2f} pt)")
        
        print(f" Overflows Found: {len(overflows)}")
        for of in overflows:
            hdr_str = "Header" if of["is_header"] else "Data"
            print(f"   [{hdr_str}] '{of['word']}' in Col {of['col_index']} | x0={of['x0']}, x1={of['x1']} | Boundary={of['col_boundary']} | Overflow=+{of['overflow_pt']} pt")
