<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<h1 align="center">Chesta IIOT Backend API</h1>

<p align="center">
  Sistem Pemantauan Mesin Produksi Real-Time berbasis Industrial IoT (IIoT). <br> 
  Mengintegrasikan data sensor ke PostgreSQL & InfluxDB dengan standar keamanan JWT.
</p>

<p align="center">
<img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
<img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
<img src="https://img.shields.io/badge/InfluxDB-22ADF6?style=for-the-badge&logo=influxdb&logoColor=white" />
<img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

---

## 📝 Description

**Chesta IIOT Backend** adalah aplikasi server-side yang dirancang untuk menangani data performa mesin dari lantai produksi. Project ini dibangun menggunakan [Nest](https://github.com/nestjs/nest) framework TypeScript untuk memastikan efisiensi, skalabilitas, dan keamanan data.

## 🚀 Key Features (Expert Level)

* **🔐 Auth & RBAC**: Autentikasi JWT dengan *Role-Based Access Control* (Admin, Supervisor, Operator).
* **📊 Machine Analytics**: Perhitungan otomatis durasi downtime, event breakdown, dan *Machine Health Index*.
* **⚡ Advanced History**: Pagination siap pakai dengan algoritma *Deduplication* untuk akurasi data sensor.
* **📈 Time-Series Trend**: Integrasi InfluxDB untuk visualisasi tren produksi secara real-time.
* **🛠️ Robust Validation**: Validasi input ketat menggunakan DTO dan `ValidationPipe`.
* **🕒 Performance Monitoring**: Global Interceptor untuk mencatat waktu eksekusi setiap request.

---

## 🛠️ Project Setup

### 1. Installation
```bash
$ npm install



Environment Configuration
Buat file .env baru di root folder dan lengkapi data sesuai kebutuhan sistem:

Cuplikan kode

# Database & Influx
DB_HOST=localhost
DB_PORT=5432
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=your_token_here

# Security
JWT_SECRET=KunciRahasiaPalingAmanChesta2025
PORT=3006

Running the app
Bash

# development mode
$ npm run start

# watch mode (recommended for development)
$ npm run start:dev

# production mode
$ npm run start:prod


📚 API Documentation (Swagger)Aplikasi ini sudah dilengkapi dengan Swagger UI untuk mempermudah tim Frontend melakukan integrasi.Akses dokumentasi lengkap di:👉 http://localhost:3000/api/docs📂

Project StructurePlaintextsrc/
├── auth/              # Logic login, JWT Strategy, & Guards
├── machine-api/       # Controller & Service utama data mesin
│   └── dto/           # Data Transfer Objects untuk validasi
├── database/          # Konfigurasi database SQL & Time-series
│   ├── entities/      # Skema tabel (Breakdown, User, dll)
│   └── influx/        # Service khusus InfluxDB
├── common/            # Interceptor (Logging) & Decorators (Roles)
└── main.ts            # Konfigurasi global aplikasi (Entry Point)

🛡️ Machine Health IndicatorsTim Frontend dapat menggunakan field machine_health_index dari API Summary untuk menampilkan status visual pada Dashboard:StatusConditionDashboard ColorEXCELLENTBreakdown Event <= 5🟢 GreenFAIRBreakdown Event 6 - 10🟡 YellowPOORBreakdown Event > 10🔴 Red🤝 Support & Stay in TouchAuthor: Chesta Tech TeamDocumentation: NestJS Official DocsIndustrial IoT System: Real-time Monitoring Solution<p align="center">Released under the <a href="http://opensource.org/licenses/MIT">MIT License</a>.Copyright © 2025 <b>Chesta Corporation</b></p>