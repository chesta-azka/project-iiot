# Backend Planning: IIOT Aqua

## Tujuan
Membangun backend monitoring mesin pabrik Aqua yang:
- mendeteksi mesin `RUNNING/STOPPED`
- mencatat downtime dan alasan stop
- mendeteksi penggunaan tidak wajar / anomali
- menghitung KPI mesin otomatis dari data PLC
- menyediakan alur kerja sesuai role: `OPERATOR`, `SUPERVISOR`, `ADMIN`

## Penilaian Kondisi Sekarang
Yang sudah ada:
- auth JWT dan role dasar
- telemetry real-time dari simulator/Modbus
- pencatatan breakdown event dasar ke PostgreSQL
- metrik dasar seperti `UPDT` dan `UPST`

Yang belum matang:
- reason downtime masih otomatis, belum wajib diisi operator
- belum ada approval / correction flow oleh supervisor
- belum ada audit trail edit data
- belum ada modul report formal
- belum ada definisi bisnis yang tegas untuk “penggunaan tidak wajar”
- belum ada kontrak integrasi resmi ke ADOP System

## Tambahan Scope Report System AQUA
Target sistem bukan hanya logging event, tapi menjadi backend report system yang:
- memonitor `UPDT` dan `UPST` online secara real-time
- menghitung `MTBF` otomatis dari histori mesin
- mengambil data langsung dari PLC, bukan input manual operator
- menampilkan performance dashboard per mesin
- menyediakan visualisasi per shift (`Shift 1/2/3`) dan per line produksi
- melakukan data processing otomatis: cleaning, normalisasi, agregasi, kalkulasi KPI
- mengirim atau menyajikan data siap konsumsi ke sistem existing `ADOP`

## Role dan Hak Akses
### 1. Operator
- melihat status mesin line yang menjadi tanggung jawabnya
- menekan `run/stop` mesin jika integrasi command ke PLC diaktifkan
- saat stop manual, wajib isi `reason`, `category`, dan catatan opsional
- membuat report shift / report kejadian mesin
- melihat histori miliknya atau line-nya dalam mode read-only

### 2. Supervisor
- melihat semua data line yang dia pegang
- memvalidasi downtime event
- mengedit data yang tidak sesuai, termasuk reason downtime
- memberi status `approved`, `corrected`, atau `rejected`
- melihat KPI: `UPDT`, `UPST`, top downtime reason, anomaly list

### 3. Admin
- akses seluruh line, seluruh histori, seluruh report
- melihat dashboard agregat lintas line/shift/hari
- melihat trend utilisasi, downtime, abnormal usage
- tidak perlu banyak edit operasional, fokus ke monitoring dan approval level tinggi

## Flow Data Utama
### 1. PLC to Backend
1. PLC/machine mengirim status, counter, alarm, dan signal run/stop.
2. Backend ingestion layer menerima raw telemetry.
3. Data diproses untuk cleaning, deduplication, dan normalisasi timestamp.
4. Engine menghitung state mesin real-time.
5. Hasil disimpan ke storage operasional dan time-series bila diperlukan.

### 2. Processing to KPI
1. Dari event mesin, backend bentuk `downtime session`.
2. Backend hitung `UPDT`, `UPST`, `MTBF`, dan KPI lain per mesin.
3. Agregasi dibuat per shift, per line, dan per hari.
4. Dashboard dan report membaca hasil agregasi, bukan raw event langsung.

### 3. Backend to ADOP
1. Data yang sudah dibersihkan dan divalidasi dimapping ke format ADOP.
2. Backend kirim via API / queue / batch job sesuai kontrak ADOP.
3. Semua pengiriman harus punya status `queued`, `sent`, `acknowledged`, `failed`.

## Alur User yang Disarankan
### Alur 1: Mesin Stop Otomatis
1. Engine mendeteksi mesin berubah dari `RUNNING` ke `STOPPED`.
2. Sistem membuat `downtime session` dengan status `OPEN`.
3. Jika ada alarm code, sistem isi `detected_reason`.
4. Saat mesin kembali `RUNNING`, sistem hitung durasi dan simpan `UPDT`.
5. Event masuk ke antrean validasi supervisor bila belum ada reason final.

### Alur 2: Stop Manual oleh Operator
1. Operator pilih mesin lalu klik `Stop`.
2. Backend kirim command ke PLC jika fitur control diaktifkan.
3. Backend wajib minta `reason category`, `reason detail`, dan `notes`.
4. Event disimpan sebagai `source=MANUAL_OPERATOR`.
5. Supervisor memverifikasi apakah reason sesuai kondisi lapangan.

### Alur 3: Koreksi oleh Supervisor
1. Supervisor buka daftar downtime pending.
2. Supervisor cek data mesin, alarm, durasi, dan reason operator.
3. Jika salah, supervisor edit reason/durasi/kategori.
4. Sistem simpan siapa yang edit, kapan, dan nilai sebelum/sesudah.
5. Event berubah ke `VALIDATED`.

### Alur 4: Report Shift
1. Operator membuat report shift atau end-of-shift summary.
2. Report berisi kejadian penting: mesin stop, tindakan, hasil restart, catatan produksi.
3. Supervisor review report.
4. Admin melihat report final sebagai dasar evaluasi.

## Definisi Kasus “Penggunaan Tidak Wajar”
Supaya backend jelas, anomali perlu dibagi menjadi beberapa rule:
- `Frequent Stop`: stop terlalu sering dalam 1 shift
- `Long Downtime`: downtime melebihi threshold per mesin
- `Run Without Output`: status running tapi counter tidak naik dalam periode tertentu
- `Counter Jump`: lonjakan counter tidak realistis
- `Manual Stop Abuse`: operator terlalu sering stop manual tanpa alarm
- `Reason Mismatch`: alarm code tidak sesuai dengan reason yang dipilih operator
- `Out of Shift Activity`: mesin aktif di luar jadwal shift yang semestinya

Rule ini sebaiknya configurable per mesin/line, bukan hardcoded global.

## KPI Wajib di Report System
### Real-time KPI
- `UPDT`: total durasi downtime online
- `UPST`: jumlah stop online
- current status mesin: `RUNNING`, `STOPPED`, `IDLE`, `ALARM`
- current alarm code dan active downtime

### Historis KPI
- `MTBF`: mean time between failure
- `MTTR`: mean time to repair
- downtime frequency per machine
- downtime duration per machine
- top reason per shift / line / date
- manual stop ratio vs auto stop ratio

## Dimensi Visualisasi
Backend harus siap melayani query berdasarkan:
- per machine
- per shift: `Shift 1`, `Shift 2`, `Shift 3`
- per line: `Line 1`, `Line 2`, `Line 3`
- per tanggal / range waktu
- per role scope akses

Artinya setiap event dan agregat wajib punya metadata minimal:
- `machine_id`
- `line_id`
- `shift_id`
- `event_date`
- `source_system`

## Data Model yang Perlu Dimatangkan
### Machine
- id, code, name, line, status, plc_address, active

### DowntimeSession
- id, machine_id, shift_id, start_at, end_at, duration_seconds
- detected_alarm_code, detected_reason
- operator_reason_category, operator_reason_detail
- final_reason_category, final_reason_detail
- source (`AUTO`, `MANUAL_OPERATOR`, `SUPERVISOR_CORRECTION`)
- validation_status (`OPEN`, `PENDING_REVIEW`, `VALIDATED`, `REJECTED`)
- created_by, validated_by

### MachineReport
- id, machine_id, shift_id, created_by
- summary, action_taken, production_impact, attachment_url

### MachineKpiSnapshot
- id, machine_id, line_id, shift_id, snapshot_time
- updt_seconds, upst_count, mtbf_seconds, mttr_seconds
- status, alarm_code, counter_value

### AdopSyncLog
- id, entity_type, entity_id, payload_json
- sync_status (`QUEUED`, `SENT`, `ACK`, `FAILED`)
- synced_at, response_message

### AuditLog
- id, entity_type, entity_id, action, before_json, after_json, actor_id, created_at

### AnomalyEvent
- id, machine_id, anomaly_type, severity, started_at, ended_at, detail, status

## KPI dan Output Dashboard
- `UPDT`: total durasi downtime per mesin/line/shift
- `UPST`: jumlah stop per mesin/line/shift
- MTTR: rata-rata waktu recovery
- MTBF: rata-rata waktu antar breakdown
- top 5 downtime reasons
- anomaly count per shift
- manual stop vs automatic stop ratio
- validation backlog supervisor

## Data Processing Rules
- deduplication event jika PLC kirim data sama berulang
- ignore bouncing signal di bawah threshold tertentu
- validasi urutan event: `STOP` tidak boleh ditutup sebelum ada `RUN`
- fallback bila alarm code kosong: tandai `unknown_reason`
- semua perhitungan KPI harus konsisten timezone shift pabrik
- agregasi per shift harus tahan terhadap shift lintas hari

## Integrasi ADOP
Hal yang perlu diputuskan lebih awal:
- ADOP menerima data real-time atau batch?
- format integrasi: REST API, file export, message broker, atau direct DB bridge?
- apakah ADOP butuh raw data, event final, atau KPI agregat?
- apakah data yang dikirim hanya validated event atau semua event?

Rekomendasi backend:
- pisahkan modul `adop-integration`
- pakai tabel `sync_log`
- jangan kirim raw PLC langsung ke ADOP tanpa proses cleaning/validation
- gunakan retry mechanism dan dead-letter handling untuk sync gagal

## API Flow yang Perlu Ada
- `POST /auth/login`
- `POST /machines/:id/commands/stop`
- `POST /machines/:id/commands/run`
- `GET /machines/:id/performance/live`
- `GET /machines/:id/performance/history`
- `POST /downtime-sessions/:id/operator-reason`
- `PATCH /downtime-sessions/:id/validate`
- `PATCH /downtime-sessions/:id/correct`
- `GET /downtime-sessions`
- `GET /dashboard/operations`
- `GET /dashboard/supervisor`
- `GET /dashboard/admin`
- `GET /dashboard/shift/:shiftId`
- `GET /dashboard/line/:lineId`
- `POST /reports/shift`
- `GET /reports/shift`
- `GET /reports/line`
- `GET /anomalies`
- `POST /integrations/adop/sync`
- `GET /integrations/adop/sync-status`

## Keputusan Desain yang Perlu Ditetapkan Dulu
- apakah operator benar-benar boleh kirim command `run/stop` ke mesin, atau hanya input kejadian?
- apakah semua stop wajib dibuat sebagai session, termasuk stop < 5 detik?
- reason final milik siapa: operator atau supervisor?
- apakah admin boleh edit data, atau hanya read-only + approval?
- apakah satu operator dibatasi ke line tertentu?
- apakah report dibuat per mesin, per line, atau per shift?

## Rekomendasi Implementasi Bertahap
### Fase 1
- pertahankan role bisnis `ADMIN` agar konsisten dengan implementasi backend saat ini
- ubah `breakdown_events` menjadi model `downtime_sessions`
- wajibkan input reason untuk stop manual
- tambahkan audit log

### Fase 2
- supervisor validation workflow
- dashboard KPI `UPDT`, `UPST`, MTTR, top reasons
- report shift dan report mesin
- agregasi per shift dan per line
- endpoint dashboard machine-by-machine

### Fase 3
- anomaly engine untuk penggunaan tidak wajar
- threshold per mesin
- notification ke supervisor/admin
- integrasi ADOP
- snapshot KPI dan sinkronisasi terjadwal

## Saran Penting
- jangan gabung data hasil deteksi mesin dengan data validasi user dalam satu field
- pisahkan `detected_reason`, `operator_reason`, dan `final_reason`
- semua edit supervisor harus punya audit trail
- jangan pakai `dropSchema` untuk environment yang dipakai demo atau UAT
- jadikan PLC sebagai source of truth untuk status mesin, bukan input manual operator
- operator hanya melengkapi konteks bisnis: reason, action taken, report
