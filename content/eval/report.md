# Evaluation

Run on 2026-10-24. 74 labelled listings scored; 7 excluded, 5 not labelled.

- Correct: 74 of 74 (100%)
- Flag precision: 100% (15 of 15 flags name the expected recall)
- Flag recall: 100% (15 of 15 expected flags found)

Flags are recalled and check_label verdicts. Rows are the expected verdict, columns what Vetted said.

| expected \ got | recalled | check_label | clear | failed |
|---|---:|---:|---:|---:|
| recalled | 0 | 0 | 0 | 0 |
| check_label | 0 | 15 | 0 | 0 |
| clear | 0 | 0 | 59 | 0 |

## Wrong cases

None.

## Before fixes

The first run, before the Roman numeral and model matching fixes, kept as it was recorded. Its labels differ from the current ones: vin-001 was then expected check_label, and vin-019 and lbc-037 were not labelled yet.

Run on 2026-10-24. 74 labelled listings scored; 4 excluded, 2 not labelled.

- Correct: 67 of 74 (91%)
- Flag precision: 100% (8 of 8 flags name the expected recall)
- Flag recall: 53% (8 of 15 expected flags found)

Flags are recalled and check_label verdicts. Rows are the expected verdict, columns what Vetted said.

| expected \ got | recalled | check_label | clear | failed |
|---|---:|---:|---:|---:|
| recalled | 0 | 0 | 0 | 0 |
| check_label | 0 | 8 | 7 | 0 |
| clear | 0 | 0 | 59 | 0 |

### Wrong cases

| id | mistake | expected | expected recall | got | got recall |
|---|---|---|---|---|---|
| vin-001 | missed recall | check_label | rc:23843 | clear | rc:23843 |
| lbc-009 | missed recall | check_label | rc:22625 | clear | rc:11907 |
| lbc-010 | missed recall | check_label | rc:22625 | clear | rc:11907 |
| lbc-011 | missed recall | check_label | rc:22625 | clear | rc:11907 |
| vin-004 | missed recall | check_label | rc:22625 | clear | rc:11907 |
| vin-005 | missed recall | check_label | rc:22625 | clear |  |
| lbc-020 | missed recall | check_label | rc:22017 | clear | rc:22017 |
