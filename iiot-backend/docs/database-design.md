# Database Design: IIOT Aqua Backend

## Overview
Desain ini adalah target schema backend untuk sistem monitoring mesin Aqua. Fokus utamanya:
- telemetry mesin dari PLC
- downtime session yang tervalidasi
- KPI per machine / shift / line
- report operasional
- audit log
- integrasi ADOP

Database utama yang dipakai adalah PostgreSQL. InfluxDB tetap opsional untuk time-series detail, tetapi PostgreSQL menjadi source utama untuk data operasional, validasi, report, dan agregasi bisnis.

## Design Principles
- pisahkan data mesin hasil deteksi otomatis dari input manual user
- gunakan `downtime_sessions`, bukan hanya `breakdown_events`
- semua edit penting harus punya audit trail
- semua data harus bisa diquery per machine, per line, per shift, dan per tanggal
- data final untuk report dan integrasi harus berasal dari event yang sudah tervalidasi

## Main Tables
### 1. users
Menyimpan akun backend dan role akses.

Fields:
- `id` bigint PK
- `username` varchar unique
- `password_hash` varchar
- `full_name` varchar
- `role` enum: `OPERATOR`, `SUPERVISOR`, `ADMIN`
- `is_active` boolean
- `created_at` timestamptz
- `updated_at` timestamptz

Notes:
- bisa ditambah `employee_code`
- bila operator dibatasi per line, jangan simpan langsung di tabel ini; pakai tabel mapping

### 2. production_lines
Master line produksi.

Fields:
- `id` bigint PK
- `code` varchar unique
- `name` varchar
- `description` text nullable
- `is_active` boolean
- `created_at` timestamptz
- `updated_at` timestamptz

Contoh:
- `LINE-1`
- `LINE-2`
- `LINE-3`

### 3. machines
Master mesin per line.

Fields:
- `id` bigint PK
- `line_id` bigint FK -> `production_lines.id`
- `code` varchar unique
- `name` varchar
- `plc_ip` varchar nullable
- `plc_port` integer nullable
- `plc_register_map` jsonb nullable
- `status` enum: `RUNNING`, `STOPPED`, `IDLE`, `ALARM`, `OFFLINE`
- `is_active` boolean
- `created_at` timestamptz
- `updated_at` timestamptz

Notes:
- `status` adalah snapshot status terakhir, bukan histori
- histori status tetap dibentuk dari event/session

### 4. shifts
Master shift pabrik.

Fields:
- `id` bigint PK
- `code` varchar unique
- `name` varchar
- `start_time` time
- `end_time` time
- `sequence` smallint
- `is_active` boolean

Contoh:
- `SHIFT-1`, `07:00 - 15:00`
- `SHIFT-2`, `15:00 - 23:00`
- `SHIFT-3`, `23:00 - 07:00`

### 5. user_line_assignments
Mapping operator/supervisor ke line tertentu.

Fields:
- `id` bigint PK
- `user_id` bigint FK -> `users.id`
- `line_id` bigint FK -> `production_lines.id`
- `created_at` timestamptz

Rules:
- operator bisa dibatasi ke 1 atau lebih line
- supervisor bisa punya beberapa line
- admin tidak wajib pakai assignment

## Operational Tables
### 6. machine_telemetry_snapshots
Snapshot operasional terbaru atau periodik dari PLC.

Fields:
- `id` bigint PK
- `machine_id` bigint FK -> `machines.id`
- `line_id` bigint FK -> `production_lines.id`
- `shift_id` bigint FK -> `shifts.id`
- `event_time` timestamptz
- `run_stop_bit` boolean
- `alarm_code` integer nullable
- `counter_value` bigint nullable
- `payload_json` jsonb nullable
- `source_system` varchar default `PLC`

Notes:
- tabel ini opsional jika raw telemetry utama disimpan di InfluxDB
- jika volume tinggi, sebaiknya partisi by date

### 7. downtime_sessions
Tabel inti untuk semua kejadian downtime.

Fields:
- `id` bigint PK
- `machine_id` bigint FK -> `machines.id`
- `line_id` bigint FK -> `production_lines.id`
- `shift_id` bigint FK -> `shifts.id`
- `start_at` timestamptz
- `end_at` timestamptz nullable
- `duration_seconds` integer nullable
- `source` enum: `AUTO`, `MANUAL_OPERATOR`, `SUPERVISOR_CORRECTION`
- `detection_type` enum: `ALARM_STOP`, `MANUAL_STOP`, `COUNTER_STALL`, `SYSTEM_RULE`
- `detected_alarm_code` integer nullable
- `detected_reason` varchar nullable
- `operator_reason_category` varchar nullable
- `operator_reason_detail` text nullable
- `operator_notes` text nullable
- `final_reason_category` varchar nullable
- `final_reason_detail` text nullable
- `validation_status` enum: `OPEN`, `PENDING_REVIEW`, `VALIDATED`, `REJECTED`
- `created_by_user_id` bigint nullable FK -> `users.id`
- `validated_by_user_id` bigint nullable FK -> `users.id`
- `validated_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

Rules:
- `OPEN` berarti mesin belum dianggap recover
- saat mesin kembali `RUNNING`, `end_at` dan `duration_seconds` harus terisi
- event final untuk KPI sebaiknya hanya memakai session `VALIDATED`, atau minimal policy itu harus tegas

### 8. downtime_reason_catalog
Master kategori/alasan downtime.

Fields:
- `id` bigint PK
- `code` varchar unique
- `category` varchar
- `label` varchar
- `description` text nullable
- `requires_note` boolean
- `is_active` boolean

Contoh category:
- `MECHANICAL`
- `ELECTRICAL`
- `QUALITY`
- `MATERIAL`
- `MANUAL_OPERATION`
- `UNKNOWN`

### 9. machine_reports
Report buatan operator atau supervisor.

Fields:
- `id` bigint PK
- `machine_id` bigint nullable FK -> `machines.id`
- `line_id` bigint nullable FK -> `production_lines.id`
- `shift_id` bigint FK -> `shifts.id`
- `report_type` enum: `SHIFT`, `INCIDENT`, `MACHINE`
- `title` varchar
- `summary` text
- `action_taken` text nullable
- `production_impact` text nullable
- `status` enum: `DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`
- `created_by_user_id` bigint FK -> `users.id`
- `reviewed_by_user_id` bigint nullable FK -> `users.id`
- `reviewed_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

### 10. anomaly_events
Event penggunaan tidak wajar atau anomali hasil rule engine.

Fields:
- `id` bigint PK
- `machine_id` bigint FK -> `machines.id`
- `line_id` bigint FK -> `production_lines.id`
- `shift_id` bigint nullable FK -> `shifts.id`
- `anomaly_type` enum:
  `FREQUENT_STOP`, `LONG_DOWNTIME`, `RUN_WITHOUT_OUTPUT`, `COUNTER_JUMP`, `MANUAL_STOP_ABUSE`, `REASON_MISMATCH`, `OUT_OF_SHIFT_ACTIVITY`
- `severity` enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `started_at` timestamptz
- `ended_at` timestamptz nullable
- `detail` text
- `status` enum: `OPEN`, `ACKNOWLEDGED`, `CLOSED`
- `created_at` timestamptz
- `updated_at` timestamptz

## KPI and Aggregation Tables
### 11. machine_kpi_snapshots
Snapshot KPI yang siap dipakai dashboard.

Fields:
- `id` bigint PK
- `machine_id` bigint FK -> `machines.id`
- `line_id` bigint FK -> `production_lines.id`
- `shift_id` bigint FK -> `shifts.id`
- `snapshot_time` timestamptz
- `updt_seconds` integer default 0
- `upst_count` integer default 0
- `mtbf_seconds` integer nullable
- `mttr_seconds` integer nullable
- `status` enum: `RUNNING`, `STOPPED`, `IDLE`, `ALARM`, `OFFLINE`
- `alarm_code` integer nullable
- `counter_value` bigint nullable
- `created_at` timestamptz

Notes:
- bisa dibuat per interval 1 menit / 5 menit sesuai kebutuhan dashboard

### 12. line_kpi_daily_summaries
Agregasi harian per line.

Fields:
- `id` bigint PK
- `line_id` bigint FK -> `production_lines.id`
- `shift_id` bigint nullable FK -> `shifts.id`
- `summary_date` date
- `updt_seconds` integer
- `upst_count` integer
- `mtbf_seconds` integer nullable
- `mttr_seconds` integer nullable
- `anomaly_count` integer default 0
- `validated_downtime_count` integer default 0
- `created_at` timestamptz
- `updated_at` timestamptz

## Governance Tables
### 13. audit_logs
Mencatat semua perubahan penting.

Fields:
- `id` bigint PK
- `entity_type` varchar
- `entity_id` bigint
- `action` enum: `CREATE`, `UPDATE`, `DELETE`, `VALIDATE`, `REJECT`, `SYNC`
- `before_json` jsonb nullable
- `after_json` jsonb nullable
- `actor_user_id` bigint nullable FK -> `users.id`
- `created_at` timestamptz

Wajib dipakai untuk:
- edit downtime oleh supervisor
- validasi report
- perubahan rule penting
- proses sync ADOP bila perlu

### 14. adop_sync_logs
Mencatat integrasi ke ADOP.

Fields:
- `id` bigint PK
- `entity_type` varchar
- `entity_id` bigint
- `payload_json` jsonb
- `sync_status` enum: `QUEUED`, `SENT`, `ACK`, `FAILED`
- `attempt_count` integer default 0
- `response_message` text nullable
- `last_attempt_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

## Recommended Indexes
### downtime_sessions
- index `(machine_id, start_at desc)`
- index `(line_id, start_at desc)`
- index `(shift_id, start_at desc)`
- index `(validation_status, start_at desc)`
- index `(start_at, end_at)`

### machine_kpi_snapshots
- index `(machine_id, snapshot_time desc)`
- index `(line_id, snapshot_time desc)`
- index `(shift_id, snapshot_time desc)`

### anomaly_events
- index `(machine_id, status)`
- index `(line_id, started_at desc)`
- index `(anomaly_type, status)`

### adop_sync_logs
- index `(sync_status, created_at)`
- index `(entity_type, entity_id)`

## Relationship Summary
- `production_lines 1..n machines`
- `users n..n production_lines` via `user_line_assignments`
- `machines 1..n downtime_sessions`
- `machines 1..n machine_reports`
- `machines 1..n anomaly_events`
- `machines 1..n machine_kpi_snapshots`
- `shifts 1..n downtime_sessions`
- `shifts 1..n machine_reports`
- `shifts 1..n machine_kpi_snapshots`

## Migration from Current Schema
Schema saat ini masih sederhana:
- `USERS`
- `breakdown_events`

Migrasi yang disarankan:
1. pertahankan `users`, lalu tambahkan field yang kurang
2. buat tabel master baru: `production_lines`, `machines`, `shifts`
3. ganti `breakdown_events` menjadi `downtime_sessions`
4. buat `audit_logs`
5. buat `machine_reports`
6. buat `anomaly_events`
7. buat `machine_kpi_snapshots`
8. buat `adop_sync_logs`

## Suggested Enum Set
### user_role
- `OPERATOR`
- `SUPERVISOR`
- `ADMIN`

### machine_status
- `RUNNING`
- `STOPPED`
- `IDLE`
- `ALARM`
- `OFFLINE`

### downtime_validation_status
- `OPEN`
- `PENDING_REVIEW`
- `VALIDATED`
- `REJECTED`

### report_status
- `DRAFT`
- `SUBMITTED`
- `REVIEWED`
- `APPROVED`

## Final Notes
- PostgreSQL sebaiknya jadi database utama untuk semua data bisnis
- InfluxDB hanya dipakai jika memang butuh raw telemetry granular dan trend time-series
- query dashboard tidak boleh selalu membaca raw event; gunakan snapshot/agregasi
- downtime session adalah pusat desain sistem ini
- auditability lebih penting daripada schema yang terlalu ringkas
