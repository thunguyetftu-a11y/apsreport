from __future__ import annotations
import base64, copy, io, os, re
from pathlib import Path
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches

ROOT = Path(__file__).parent
TEMPLATE = ROOT / "master_template.docx"

app = FastAPI(title="Maintenance Report Generator API", version="1.0.0")
allowed = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware, allow_origins=[x.strip() for x in allowed],
    allow_credentials=True, allow_methods=["GET","POST"], allow_headers=["*"]
)

class Payload(BaseModel):
    contractNo: str = ""
    customer: str = ""
    maintenanceType: str = "quarterly"
    dateFrom: str = ""
    dateTo: str = ""
    content: str = ""
    serviceCenter: str = ""
    address: str = ""
    hotline: str = ""
    apHotline: str = ""
    conclusion: str = ""
    generalSuggestion: str = ""
    reportBy: str = ""
    witnessBy: str = ""
    equipment: list[dict[str, Any]] = Field(default_factory=list)
    quarterlyChecklist: list[dict[str, Any]] = Field(default_factory=list)
    annualChecklist: list[dict[str, Any]] = Field(default_factory=list)
    photos: list[dict[str, str]] = Field(default_factory=list)

@app.get("/health")
def health():
    return {"ok": True, "template_exists": TEMPLATE.exists()}

def set_paragraph_text(paragraph, text: str):
    # Keep paragraph properties, the first text run's styling and embedded
    # drawings (e.g. the company logo beside Contract No.).
    runs = paragraph.runs
    text_runs = [r for r in runs if not r._r.xpath('.//w:drawing')]
    if text_runs:
        target = text_runs[0]
        target.text = text
        for run in text_runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(text)

def replace_paragraph_start(doc, prefix: str, value: str):
    for p in doc.paragraphs:
        if p.text.strip().startswith(prefix):
            set_paragraph_text(p, value)
            return True
    return False

def replace_exact_or_prefix(doc, starts, value):
    for p in doc.paragraphs:
        s = p.text.strip()
        if any(s.startswith(x) for x in starts):
            set_paragraph_text(p, value)
            return True
    return False

def set_cell(cell, value):
    cell.text = "" if value is None else str(value)

def add_page_break_before(element):
    p = OxmlElement("w:p")
    r = OxmlElement("w:r")
    br = OxmlElement("w:br")
    br.set(qn("w:type"), "page")
    r.append(br); p.append(r)
    element.addprevious(p)

def normalized(s):
    return re.sub(r"[^a-z0-9]+", "_", (s or "").lower()).strip("_")

# Row labels from the source template. The original CH3 table omits Economizer rows.
ROW_KEYS = {
    "power_supply":"power_supply", "oil_quantity":"oil_quantity",
    "rla":"rla", "igv_position":"igv_position", "ddc_position":"ddc_position",
    "run_hour_starts":"run_hours_starts", "current_a":"current",
    "set_point_0c":"set_point", "enter_0c":"", "leave_0c":"",
    "pressure_kpa":"", "sat_temp_0c":"", "suc_temp_0c":"evap_refrig_suction_temp",
    "sup_heat_0c":"", "liquid_level":"liquid_level", "exv_position":"exv_position"
}

def row_key(row):
    cells = [c.text.strip() for c in row.cells]
    label = cells[2] if len(cells) > 2 else ""
    group1 = cells[0] if cells else ""
    group2 = cells[1] if len(cells) > 1 else ""
    n = normalized(label)
    g1, g2 = normalized(group1), normalized(group2)

    # The supplied template uses slightly different labels across CH1/CH2 and CH3.
    if n in ("volt", "power_supply"): return "power_supply"
    if n in ("sign_glass", "oil_quantity"): return "oil_quantity"
    if n.startswith("rla"): return "rla"
    if n.startswith("igv_position"): return "igv_position"
    if n.startswith("ddc_position"): return "ddc_position"
    if n in ("run_hour_starts", "run_hours_starts"): return "run_hours_starts"
    if n in ("current_a", "current"): return "current"
    if n.startswith("set_point"): return "set_point"
    if n.startswith("enter_"):
        return "condenser_water_enter" if g1 == "condenser" else "evap_water_enter"
    if n.startswith("leave_"):
        return "condenser_water_leave" if g1 == "condenser" else "evap_water_leave"
    if n.startswith("pressure_"):
        if g1 == "evaporator": return "evap_refrig_pressure"
        if g1 == "condenser": return "condenser_refrig_pressure"
        if g1 == "economizer": return "economizer_pressure"
        if g1 == "oil":
            return "oil_pressure_" + ("feed" if "feed" in n else "net" if "net" in n else "sump")
    if n.startswith("sat_temp_"):
        return "condenser_refrig_sat_temp" if g1 == "condenser" else "evap_refrig_sat_temp"
    if n.startswith(("suc_temp_", "suction_temp_")): return "evap_refrig_suction_temp"
    if n.startswith("sup_heat_"):
        return "condenser_refrig_superheat" if g1 == "condenser" else "evap_refrig_superheat"
    if n.startswith("disch_temp_"): return "condenser_refrig_discharge_temp"
    if n.startswith("liquid_temp_"): return "condenser_refrig_liquid_temp"
    if n.startswith("sub_cooling_") or n.startswith("subcooling_"): return "condenser_refrig_subcooling"
    if n.startswith("feed_") and g1 == "oil" and g2 == "temperature": return "oil_temp_feed"
    if n.startswith("sump_") and g1 == "oil" and g2 == "temperature": return "oil_temp_sump"
    if n.startswith("feed_") and g1 == "oil": return "oil_pressure_feed"
    if n.startswith("net_") and g1 == "oil": return "oil_pressure_net"
    if n.startswith("sump_") and g1 == "oil": return "oil_pressure_sump"
    if n.startswith("liquid_level"): return "liquid_level"
    if n.startswith("exv_position"): return "exv_position"
    return ""

def unique_row_cells(row):
    """Return physical Word cells once, excluding repeated proxies for merged cells."""
    result, seen = [], set()
    for cell in row.cells:
        marker = id(cell._tc)
        if marker not in seen:
            seen.add(marker)
            result.append(cell)
    return result


def write_readings(cells, values):
    if not cells:
        return
    vals = [str(v) for v in values if v is not None and str(v) != ""]
    for cell in cells:
        set_cell(cell, "")
    if not vals:
        return
    if len(cells) == 1:
        set_cell(cells[0], " | ".join(vals))
        return
    for i, cell in enumerate(cells):
        if i == len(cells) - 1:
            set_cell(cell, " | ".join(vals[i:]))
        elif i < len(vals):
            set_cell(cell, vals[i])


def fill_logsheet(table, equipment):
    readings = {r.get("key"): r.get("values", []) for r in equipment.get("readings", [])}
    times = equipment.get("readingTimes", [])

    # The supplied template has two reading columns; some rows merge them into one cell.
    # Preserve its exact layout and combine additional readings in the final available cell.
    if len(table.rows) > 1:
        header_values, seen = [], set()
        for cell in table.rows[1].cells[4:]:
            marker = id(cell._tc)
            if marker not in seen:
                seen.add(marker); header_values.append(cell)
        write_readings(header_values, times)

    for ri, row in enumerate(table.rows):
        if ri < 2:
            continue
        key = row_key(row)
        value_cells, seen = [], set()
        for cell in row.cells[4:]:
            marker = id(cell._tc)
            if marker not in seen:
                seen.add(marker); value_cells.append(cell)
        write_readings(value_cells, readings.get(key, []))

        label = " ".join(c.text for c in row.cells[:2]).lower()
        if "comments" in label:
            set_cell(row.cells[1], equipment.get("comments", ""))
        elif "suggestion" in label:
            set_cell(row.cells[1], equipment.get("suggestion", ""))
        elif "oil quantity" in label and equipment.get("oilQuantity"):
            write_readings(value_cells, [equipment["oilQuantity"]])

def get_logsheet_title_paragraphs(doc):
    return [p for p in doc.paragraphs if p.text.strip().startswith("CENTRIFUGAL CHILLER LOGSHEET")]

def replace_checklist(doc, items, annual=False):
    paras = doc.paragraphs
    if annual:
        start_idx = next((i for i,p in enumerate(paras) if "Bảo trì năm/ Annual shutdown" in p.text or "Annual shutdown" in p.text), None)
        end_idx = next((i for i,p in enumerate(paras) if i > (start_idx if start_idx is not None else -1) and "KẾT LUẬN" in p.text), len(paras))
    else:
        start_idx = next((i for i,p in enumerate(paras) if "Bảo trì định kỳ/ Maintenance inspection" in p.text), None)
        end_idx = next((i for i,p in enumerate(paras) if i > (start_idx if start_idx is not None else -1) and "Bảo trì năm/ Annual shutdown" in p.text), len(paras))
    if start_idx is None:
        return

    candidates = []
    section_headers = ("Tổng quát", "Nhớt bôi trơn", "Bộ vi xử lý", "Hệ thống điện", "Hệ thống gas", "Bình ngưng và dàn bay hơi")
    for p in paras[start_idx+1:end_idx]:
        txt = p.text.strip()
        if "/" in txt and len(txt) > 25 and not txt.startswith(section_headers):
            candidates.append(p)

    for i, p in enumerate(candidates):
        if i >= len(items):
            break
        done = bool(items[i].get("done"))
        mark = "☑ " if done else "☐ "
        txt = p.text
        clean = re.sub(r"^[☑☐□✓✔ ]+", "", txt)
        # Remove the template's old fixed checked/unchecked list bullet so the
        # current form response is represented by exactly one checkbox.
        ppr = p._p.pPr
        if ppr is not None:
            num_pr = ppr.find(qn("w:numPr"))
            if num_pr is not None:
                ppr.remove(num_pr)
        set_paragraph_text(p, mark + clean)
        remark = items[i].get("remarks", "")
        if remark:
            p.add_run("  |  " + remark)

def insert_photos(doc, photos):
    paras = doc.paragraphs
    heading_idx = next((i for i,p in enumerate(paras) if "PICTURE OF WORKS" in p.text), None)
    if heading_idx is None:
        return
    end_idx = next((i for i,p in enumerate(paras) if i > heading_idx and "MAINTENANCE WORKS" in p.text), len(paras))

    # Remove sample-site photos from the source report so old customer images
    # never leak into a newly generated maintenance report.
    photo_paragraphs = paras[heading_idx+1:end_idx]
    target = photo_paragraphs[0] if photo_paragraphs else paras[heading_idx]
    for paragraph in photo_paragraphs:
        for drawing in paragraph._p.xpath('.//w:drawing'):
            drawing.getparent().remove(drawing)

    for item in photos:
        try:
            raw = base64.b64decode(item.get("data", ""), validate=True)
            if not raw:
                continue
            run = target.add_run()
            run.add_picture(io.BytesIO(raw), width=Inches(2.3))
            target.add_run("  ")
        except Exception:
            continue

def build_doc(data: Payload) -> bytes:
    if not TEMPLATE.exists():
        raise HTTPException(500, "Master Word template is missing.")
    doc = Document(TEMPLATE)

    replace_paragraph_start(doc, "Contract No.:", f"Contract No.: {data.contractNo}")
    replace_paragraph_start(doc, "Công Trình", f"Công Trình /The Client : {data.customer}")
    date_text = f"From {data.dateFrom} to {data.dateTo}".strip()
    replace_paragraph_start(doc, "Ngày thực hiện", f"Ngày thực hiện / Maintenance date : {date_text}")
    replace_paragraph_start(doc, "SERVICE CENTER", data.serviceCenter)
    replace_paragraph_start(doc, "Address:", f"Address: {data.address}")
    replace_paragraph_start(doc, "Hotline:", f"Hotline: {data.hotline}    AP Hotline: {data.apHotline}")
    replace_paragraph_start(doc, "Thực hiện bảo trì định kỳ", data.content)
    replace_paragraph_start(doc, "Tất cả 03 chillers", data.conclusion)
    replace_paragraph_start(doc, "Cần kiểm tra và giám sát", data.generalSuggestion)
    replace_paragraph_start(doc, "Huynh Trung Tinh", data.reportBy)
    for p in doc.paragraphs:
        if p.text.strip().startswith("Data logged by:"):
            set_paragraph_text(p, f"Data logged by: {data.reportBy}")
        elif p.text.strip() == "Huynh Trung Tinh":
            set_paragraph_text(p, data.reportBy)

    # Update the two original Wingdings checkbox symbols without rebuilding
    # the paragraph (the symbols are stored as w:sym, not ordinary text runs).
    for p in doc.paragraphs:
        if "Annual Shutdown" in p.text and "Maintenance Inspection" in p.text:
            annual = data.maintenanceType in ("annual", "both")
            quarterly = data.maintenanceType in ("quarterly", "both")
            symbols = p._p.xpath('.//w:sym')
            if len(symbols) >= 2:
                symbols[0].set(qn("w:char"), "F0FE" if annual else "F0A8")
                symbols[1].set(qn("w:char"), "F0FE" if quarterly else "F0A8")
            break

    replace_checklist(doc, data.quarterlyChecklist, annual=False)
    replace_checklist(doc, data.annualChecklist, annual=True)
    insert_photos(doc, data.photos)

    # Equipment table: populate the existing 4-column layout, two equipment per row.
    equipment_table = doc.tables[0]
    units = data.equipment
    needed_rows = max(2, (len(units)+1)//2 + 1)
    while len(equipment_table.rows) < needed_rows:
        equipment_table.add_row()
    for ri in range(1, len(equipment_table.rows)):
        for ci in range(4):
            set_cell(equipment_table.rows[ri].cells[ci], "")
    for idx, eq in enumerate(units):
        row_idx = 1 + idx//2
        col_idx = (idx%2)*2
        if row_idx < len(equipment_table.rows):
            set_cell(equipment_table.rows[row_idx].cells[col_idx], eq.get("unit",""))
            set_cell(equipment_table.rows[row_idx].cells[col_idx+1], f'{eq.get("model","")} / {eq.get("serial","")}'.strip(" /"))

    # Original logsheet tables are tables 1..3. Retain as many as needed, clone CH1 table for extra units.
    original_log_tables = doc.tables[1:4]
    titles = get_logsheet_title_paragraphs(doc)
    logged_paragraphs = [p for p in doc.paragraphs if p.text.strip().startswith("Data logged by:")]
    for idx,eq in enumerate(units):
        if idx < len(original_log_tables):
            table = original_log_tables[idx]
            fill_logsheet(table, eq)
            if idx < len(titles):
                set_paragraph_text(titles[idx], f'CENTRIFUGAL CHILLER LOGSHEET {eq.get("unit",f"CH{idx+1}")}')
        else:
            # Clone original CH1 table XML and append it as a new page.
            clone = copy.deepcopy(original_log_tables[0]._tbl)
            body = doc._body._element
            body.append(OxmlElement("w:p"))
            page_p = body[-1]
            run = OxmlElement("w:r"); br = OxmlElement("w:br"); br.set(qn("w:type"),"page")
            run.append(br); page_p.append(run)
            title_p = OxmlElement("w:p")
            r = OxmlElement("w:r"); t = OxmlElement("w:t")
            t.text = f'CENTRIFUGAL CHILLER LOGSHEET {eq.get("unit",f"CH{idx+1}")}'
            r.append(t); title_p.append(r); body.append(title_p)
            body.append(clone)
            logged_p = OxmlElement("w:p")
            logged_r = OxmlElement("w:r")
            logged_t = OxmlElement("w:t")
            logged_t.text = f'Data logged by: {data.reportBy}'
            logged_r.append(logged_t); logged_p.append(logged_r); body.append(logged_p)
            fill_logsheet(Table(clone, doc), eq)

    # Remove surplus original logsheets if fewer than 3 equipment were selected.
    if len(units) < 3:
        # Remove matching title paragraphs for unused units; tables are removed by XML identity.
        for p in titles[len(units):]:
            p._element.getparent().remove(p._element)
        for p in logged_paragraphs[len(units):]:
            p._element.getparent().remove(p._element)
        for tbl in original_log_tables[len(units):]:
            tbl._element.getparent().remove(tbl._element)

    # Add witness name to the signature line if supplied.
    if data.witnessBy:
        for p in doc.paragraphs:
            if "Report by" in p.text and "Witness by" in p.text:
                set_paragraph_text(p, f"Report by: {data.reportBy}                         Witness by: {data.witnessBy}")
                break

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()

@app.post("/generate")
def generate(payload: Payload):
    if not payload.equipment:
        raise HTTPException(400, "Add at least one chiller before generating the report.")
    if len(payload.equipment) > 20:
        raise HTTPException(400, "A report can contain up to 20 equipment units.")
    if len(payload.photos) > 12:
        raise HTTPException(400, "A report can contain up to 12 photos.")
    encoded_photo_bytes = sum(len(item.get("data", "")) for item in payload.photos)
    if encoded_photo_bytes > 20 * 1024 * 1024:
        raise HTTPException(413, "Photo upload payload is too large. Keep total photos under approximately 15 MB.")
    try:
        content = build_doc(payload)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(500, f"Could not generate Word report: {exc}")
    safe = re.sub(r"[^A-Za-z0-9_-]+","_",payload.customer or "Customer").strip("_")
    filename = f"Maintenance_Report_{safe or 'Customer'}.docx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
