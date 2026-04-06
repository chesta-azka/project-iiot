# IIOT Aqua Backend Flow and Rules

## Overview
Dokumen ini adalah versi project-specific dari workflow pada `Project Workflow BE TC.docx`. Fokusnya bukan workflow backend umum, tapi alur implementasi backend untuk sistem monitoring mesin Aqua: telemetry PLC, downtime tracking, KPI machine performance, role-based validation, reporting, dan integrasi ADOP.

## Main Backend Flow
### 1. Requirement and Scope Lock
- validasi kebutuhan bisnis: monitoring `UPDT`, `UPST`, `MTBF`, report, anomaly, dan dashboard
- pastikan role final: `OPERATOR`, `SUPERVISOR`, `ADMIN`
- tetapkan scope phase awal: backend dulu, frontend menyusul
- definisikan batas antara auto-detection dari PLC dan input manual dari user

Output:
- daftar fitur wajib
- definisi KPI
- definisi role dan hak akses

### 2. Data and Architecture Design
- desain entity utama: `users`, `machines`, `downtime_sessions`, `reports`, `audit_logs`, `anomaly_events`
- tentukan relasi machine ke line dan shift
- pastikan data model mendukung query per machine, per shift, per line
- tentukan arsitektur module NestJS: auth, machine-api, core-engine, database, simulator/integration

Output:
- ERD final
- module boundaries
- API contract awal

### 3. PLC Ingestion Flow
1. PLC mengirim status mesin, counter, dan alarm.
2. Backend menerima raw telemetry dari Modbus/PLC gateway.
3. Data dibersihkan: deduplication, timestamp normalization, anti-bounce.
4. Engine menentukan status mesin: `RUNNING`, `STOPPED`, `ALARM`, atau kondisi lain yang dipakai sistem.
5. Data live dibroadcast ke dashboard dan disimpan ke storage yang relevan.

Output:
- telemetry real-time stabil
- status machine live

### 4. Downtime Detection Flow
1. Engine mendeteksi transisi `RUNNING -> STOPPED`.
2. Backend membuka `downtime session`.
3. Jika ada alarm code, sistem isi `detected_reason`.
4. Jika mesin kembali `RUNNING`, backend menutup session dan menghitung durasi.
5. KPI seperti `UPDT` dan `UPST` diperbarui.

Output:
- downtime session valid
- histori stop terukur otomatis

### 5. Operator Action Flow
1. Operator melihat status mesin real-time.
2. Jika fitur command diaktifkan, operator bisa kirim `run/stop` ke mesin.
3. Jika operator melakukan stop manual, backend wajib meminta reason.
4. Operator dapat membuat report shift atau report kejadian mesin.
5. Data operator disimpan sebagai input bisnis, bukan source of truth status mesin.

Output:
- operator action tercatat
- manual stop punya reason yang jelas

### 6. Supervisor Validation Flow
1. Supervisor membuka daftar downtime pending.
2. Supervisor membandingkan detected reason, operator reason, alarm, dan durasi.
3. Supervisor bisa approve, correct, atau reject.
4. Setiap perubahan masuk ke audit log.
5. Event final dipakai untuk dashboard historis dan integrasi downstream.

Output:
- data downtime tervalidasi
- perubahan bisa diaudit

### 7. KPI and Reporting Flow
1. Backend mengagregasi data per machine, shift, line, dan tanggal.
2. Sistem menghitung `UPDT`, `UPST`, `MTBF`, `MTTR`, top reasons, dan anomaly count.
3. Dashboard membaca data live dan data agregat.
4. Report shift dan report line dihasilkan dari data tervalidasi.

Output:
- dashboard machine performance
- report operasional yang konsisten

### 8. ADOP Integration Flow
1. Data yang sudah dibersihkan dan tervalidasi dipilih untuk sync.
2. Backend mapping payload sesuai kontrak ADOP.
3. Sync dijalankan via API/job.
4. Status sync dicatat: `QUEUED`, `SENT`, `ACK`, `FAILED`.

Output:
- data siap integrasi ke ADOP
- histori sync bisa ditracking

## Role Flow
### Operator
- monitor status mesin
- input reason stop manual
- buat report shift / incident report
- akses data operasional sesuai scope line/shift

### Supervisor
- review downtime
- koreksi reason atau data yang tidak valid
- lihat KPI line
- validasi report operator

### Admin
- akses semua fitur
- lihat dashboard agregat lintas line
- review anomaly dan performa global
- kontrol akses dan kebutuhan monitoring level tinggi

## Core Rules
### Source of Truth Rules
- status mesin harus berasal dari PLC, bukan dari form manual user
- input operator hanya menambah konteks bisnis
- detected reason, operator reason, dan final reason harus dipisah

### Downtime Rules
- setiap stop yang valid harus menjadi `downtime session`
- event bouncing harus diabaikan dengan threshold minimum
- session tidak boleh ditutup tanpa event `RUNNING` atau rule timeout yang jelas
- manual stop wajib punya reason category

### KPI Rules
- `UPDT` dihitung dari total durasi downtime valid
- `UPST` dihitung dari jumlah stop valid
- `MTBF` dihitung dari jarak antar failure yang sudah final
- query KPI harus bisa difilter per machine, shift, line, dan range tanggal

### Validation Rules
- supervisor wajib punya jejak edit
- data final untuk report dan integrasi harus berasal dari data yang sudah tervalidasi
- edit data historis tidak boleh menghapus nilai awal; perubahan harus disimpan di audit log

### Integration Rules
- data ke ADOP tidak boleh raw langsung dari PLC
- data harus melewati cleaning, validation, dan mapping
- sync gagal harus bisa di-retry

## Development Rules
### Phase 1
- selesaikan auth, role, config, database connection, logging
- rapikan model downtime agar tidak lagi sekadar event tunggal

### Phase 2
- bangun engine deteksi stop/run dan pembentukan downtime session
- bangun endpoint role-based untuk operator, supervisor, admin

### Phase 3
- bangun KPI aggregation dan dashboard endpoints
- bangun report endpoints

### Phase 4
- bangun anomaly rules
- bangun ADOP integration

## Git and Branch Rules
- gunakan Conventional Commits: `feat`, `fix`, `chore`, `docs`, `refactor`
- `main` hanya untuk kode stabil
- `dev` untuk integrasi sebelum rilis
- `feature/nama-fitur` untuk pekerjaan per fitur

## Practical Summary
Urutan implementasi backend IIOT Aqua:
1. lock requirement dan KPI
2. desain database dan module
3. sambungkan PLC ke ingestion layer
4. bangun engine downtime dan KPI dasar
5. tambahkan role workflow operator-supervisor-admin
6. bangun dashboard dan report
7. tambahkan anomaly detection
8. integrasikan data final ke ADOP
