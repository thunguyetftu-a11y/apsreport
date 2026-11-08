# Source template and field mapping

Source: `ESTELLA- QM REPORT_2906-21 (BẢO TRÌ).docx` (8 pages).

| Source area | Online field | Output location |
|---|---|---|
| Contract No. | `contractNo` | Page 1 contract line |
| The Client | `customer` | Page 1 customer line |
| Maintenance date | `dateFrom`, `dateTo` | Page 1 maintenance date |
| Maintenance type | `maintenanceType` | Page 1 bilingual type checkboxes |
| Content | `content` | Page 1 content paragraph |
| Service center / address / hotline | corresponding fields | Page 1 service contact |
| Equipment information | `equipment[]` | Equipment information table |
| Picture of works | `photos[]` | Page 3 photo section |
| Quarterly checklist | `quarterlyChecklist[]` | Quarterly inspection checklist |
| Annual checklist | `annualChecklist[]` | Annual shutdown checklist |
| Technical readings | `equipment[].readings[]` | Chiller logsheet tables |
| Reading date/time | `equipment[].readingTimes[]` | Logsheet value-column headings |
| Oil quantity | `equipment[].oilQuantity` | Oil quantity row |
| Comments / suggestion | equipment-level fields | Bottom of each logsheet |
| Conclusion | `conclusion` | Conclusion paragraph |
| General suggestion | `generalSuggestion` | Suggestion paragraph |
| Report by / Witness by | `reportBy`, `witnessBy` | Signature area |

## Technical parameter keys

`power_supply`, `oil_quantity`, `rla`, `igv_position`, `ddc_position`, `run_hours_starts`, `current`, `set_point`, `evap_water_enter`, `evap_water_leave`, `evap_refrig_pressure`, `evap_refrig_sat_temp`, `evap_refrig_suction_temp`, `evap_refrig_superheat`, `economizer_pressure`, `condenser_water_enter`, `condenser_water_leave`, `condenser_refrig_pressure`, `condenser_refrig_sat_temp`, `condenser_refrig_discharge_temp`, `condenser_refrig_superheat`, `condenser_refrig_liquid_temp`, `condenser_refrig_subcooling`, `liquid_level`, `exv_position`, `oil_pressure_feed`, `oil_pressure_net`, `oil_pressure_sump`, `oil_temp_feed`, `oil_temp_sump`.

## Source fidelity notes

- The source contains three logsheet tables with slightly different row structures. CH1/CH2 contain an Economizer pressure row; CH3 does not.
- Some source table cells are merged. The generator fills the existing value cells rather than rebuilding the table. When more than two readings are entered, additional readings are grouped in the second Word value cell because the source template has only two physical reading columns.
- Existing sample-site photos inside the source photo section are removed before uploaded job photos are inserted. The company logo and other non-photo-section artwork are preserved.
- The source checklist glyphs and bilingual text should be visually inspected in Word after generation.
- Some source parameters and ranges vary by chiller. Keep model-specific limits in the master template or approved configuration, not as universal defaults.
