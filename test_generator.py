import base64
import io
import unittest
from pathlib import Path

from docx import Document
from PIL import Image

import main


class GeneratorTests(unittest.TestCase):
    def make_equipment(self, count):
        return [
            {
                "unit": f"CH{i}", "model": f"Model {i}", "serial": f"SN{i}",
                "readingTimes": ["08:00", "14:00", "18:00"],
                "readings": [
                    {"key": "power_supply", "values": ["400", "401", "402"]},
                    {"key": "evap_water_enter", "values": ["12", "13", "14"]},
                ],
                "oilQuantity": "Normal", "comments": f"Comment {i}", "suggestion": "Follow up",
            }
            for i in range(1, count + 1)
        ]

    def make_payload(self, count=1, photos=None):
        return main.Payload(
            contractNo="TEST-2026", customer="QA Customer", maintenanceType="both",
            dateFrom="08 Nov 2026", dateTo="08 Nov 2026", content="Maintenance test",
            conclusion="Equipment operating normally", generalSuggestion="Monitor pumps",
            reportBy="QA Engineer", witnessBy="Client witness", equipment=self.make_equipment(count),
            quarterlyChecklist=[{"done": i % 2 == 0, "remarks": ""} for i in range(25)],
            annualChecklist=[{"done": i % 2 == 0, "remarks": ""} for i in range(16)],
            photos=photos or [],
        )

    def test_one_equipment_removes_unused_logsheets(self):
        doc = Document(io.BytesIO(main.build_doc(self.make_payload(1))))
        self.assertEqual(len(doc.tables), 2)
        self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("CENTRIFUGAL CHILLER LOGSHEET")]), 1)
        self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("Data logged by:")]), 1)

    def test_four_equipment_creates_four_logsheets(self):
        doc = Document(io.BytesIO(main.build_doc(self.make_payload(4))))
        self.assertEqual(len(doc.tables), 5)
        self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("CENTRIFUGAL CHILLER LOGSHEET")]), 4)
        self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("Data logged by:")]), 4)

    def test_two_and_three_equipment_counts(self):
        for count in (2, 3):
            with self.subTest(count=count):
                doc = Document(io.BytesIO(main.build_doc(self.make_payload(count))))
                self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("CENTRIFUGAL CHILLER LOGSHEET")]), count)
                self.assertEqual(len([p for p in doc.paragraphs if p.text.startswith("Data logged by:")]), count)

    def test_merged_and_unmerged_reading_cells_are_filled(self):
        doc = Document(io.BytesIO(main.build_doc(self.make_payload(1))))
        # Power supply is merged across both source value columns; water-enter is not.
        self.assertEqual(doc.tables[1].rows[2].cells[4].text, "400 | 401 | 402")
        self.assertEqual(doc.tables[1].rows[10].cells[4].text, "12")
        self.assertEqual(doc.tables[1].rows[10].cells[5].text, "13 | 14")

    def test_photo_section_replaces_template_photos_and_preserves_logo(self):
        image = io.BytesIO()
        Image.new("RGB", (80, 60), (40, 100, 180)).save(image, format="PNG")
        photo = {"name": "site.png", "mime": "image/png", "data": base64.b64encode(image.getvalue()).decode()}
        doc = Document(io.BytesIO(main.build_doc(self.make_payload(1, [photo]))))
        self.assertEqual(len(doc.inline_shapes), 6)  # 5 non-site template images + 1 new photo
        self.assertEqual(len(doc.paragraphs[0]._p.xpath('.//w:drawing')), 1)  # company logo

    def test_checklist_state_is_written(self):
        doc = Document(io.BytesIO(main.build_doc(self.make_payload(1))))
        self.assertTrue(doc.paragraphs[26].text.startswith("☑ "))
        self.assertTrue(doc.paragraphs[27].text.startswith("☐ "))


if __name__ == "__main__":
    unittest.main()
