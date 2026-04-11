1. Infrastructure & Core System
- [x] Server Setup: NestJS Framework (Port 3006) - Stable
- [x] Database Primary: PostgreSQL via TypeORM (User & Master Data) - Connected
- [x] Database Time-Series: InfluxDB (Sensor Logging) - Ready
- [x] Containerization: Docker Compose (Postgres, InfluxDB, Adminer) - Active
- [x] Global Configuration: Global Prefix (/api) & CORS Permission - Fixed

2. Security & Authentication
- [x] User Management: Schema Database untuk Tabel USERS - Done
- [x] Auth Logic: Register (Bcrypt Hashing) & Login System - Done
- [ ] Access Control: JWT (JSON Web Token) Implementation - Ready
- [ ] Guards: Protect Private Routes (Hanya user login yang bisa akses) - Ready
- [ ] Role Base Management: Implementasi & pembagian otoritas role OPERATOR, SUPERVISOR, ADMIN

3. Database Schema & Data Modeling (Fase 1)
- [ ] Schema Update: Tabel `machines` (id, name, line, status, plc_address, active)
- [ ] Schema Update: Tabel `downtime_sessions` (pengganti `breakdown_events`, status validasi, reason operator/final) 
- [ ] Schema Update: Tabel `audit_logs` (pencatatan after/before saat supervisor edit data)
- [ ] Schema Update: Tabel `machine_reports` (untuk pencatatan harian shift)
- [ ] Schema Update: Tabel `machine_kpi_snapshots` (untuk aggregat waktu updt, upst, mtbf)
- [ ] Schema Update: Tabel `anomaly_events` (tipe anomali, severity, status)
- [ ] Schema Update: Tabel `adop_sync_logs` (tracking queue report ke sistem ADOP)

4. Telemetry Ingestion & Data Flow Utama (Fase 1)
- [ ] Ingestion Layer: Endpoint untuk terima telemetry status dari PLC/Modbus/Simulator
- [ ] Cleaning & Deduplication Module: Logic handle ignore signal bounce & duplikasi
- [ ] State Machine Calculator: Hitung durasi dan tracking perpindahan state `RUNNING` -> `STOPPED` -> `RUNNING`
- [ ] Auto Session Generator: Saat mesin mati, otomatis buat `downtime session` berstatus `OPEN` sesuai alarm code
- [ ] Operator Manual Operations: Logic mandatory input reason ketika stop manual dari API `POST /machines/:id/commands/stop`

5. Approval Flow & Validator (Fase 2)
- [ ] Supervisor Validation API: Endpoint lihat queue `downtime_session` yang idle / waiting verification
- [ ] Data Correction Engine: Logic supervisor untuk edit urusan waktu durasi / ubah reason asli
- [ ] Audit Middleware Setup: Record otomatis nilai referensi history tiap ada koreksi di `audit_logs`
- [ ] Submit Shift Report: Logic API bagi `OPERATOR` submit End of Shift report dan kejadian di lapangan

6. Metrics, Dashboard & KPI (Fase 2)
- [ ] Engine Hitung Live KPI: Logika pencarian total `UPDT` menit & current `UPST` harian/shift
- [ ] Engine Histori KPI: Rumus cari kalkulasi historis nilai agregat `MTBF` & `MTTR`
- [ ] Metadata Resolver: Fungsional agar result dashboard bisa difilter via parameter `shift`, `date`, `machine_id`, `line_id`
- [ ] API Aggregations Operational: Endpoint visualisasi dasar per-mesin / per-line untuk tipe `OPERATOR`
- [ ] API Aggregations Management: Dashboard overview tinggi untuk klasifikasi `ADMIN` & approval check (top fault reasons)

7. Anomaly Engine System (Fase 3)
- [ ] Deteksi Frequent Stop: Logic check stop terlalu sering dalam 1 shift window
- [ ] Deteksi Long Downtime: Alert di backend bila downtime duration tembus batas threshold standard
- [ ] Deteksi Abuse Stop: Alert deteksi anomali stop tanpa rujukan input yang relevan 
- [ ] Anomaly Report Logging: Simpan data trigger event exception ke database agar bisa direview Supervisor

8. ADOP System Integration (Fase 3)
- [ ] Data Formatting ADOP: Clean-up object dan normalisasi mapping disesuaikan dengan skema ADOP System
- [ ] Sync Logging Transaction: Flow CRUD mencatat metadata payload ke `adop_sync_logs`
- [ ] Cron Job Sync/Push: Dispatch rutin/scheduler mengirim valid item secara queue dan dead-letter handling (Retry Failed)
- [ ] Status Polling ADOP: Penampil status sync success/error/ack via list API integration
