Product Requirements Document (PRD): Aqua Production Report System
Versi: 1.0
Status: Draft
Tanggal: 19 April 2026
1. Tujuan Produk
Membangun sistem pelaporan otomatis yang terintegrasi untuk memantau performa mesin produksi Aqua secara real-time. Sistem ini bertujuan untuk menghilangkan proses pelaporan manual, meningkatkan akurasi data, dan menyediakan wawasan cepat bagi manajemen untuk pengambilan keputusan operasional.
2. Latar Belakang Project
Pabrik Aqua memiliki volume produksi yang sangat besar dengan berbagai mesin yang beroperasi 24/7. Selama ini, data produksi seringkali dicatat secara manual atau diambil secara parsial dari PLC, yang mengakibatkan adanya celah informasi dan potensi kesalahan manusia. Diperlukan sistem terpusat yang menghubungkan lantai produksi langsung ke manajemen.
3. Problem yang Ingin Diselesaikan
●	Data Lag: Manajemen sering menerima laporan produksi sehari setelah kejadian (h-1).
●	Inakurasi: Kesalahan pencatatan manual oleh operator di lapangan.
●	Downtime Tidak Terlacak: Sulit untuk menganalisis penyebab utama (root cause) dari berhentinya mesin secara mendadak.
●	Fragmentasi Data: Data mesin tersebar di berbagai PLC merk berbeda tanpa integrasi.
4. Target User / Segmentasi Pengguna
User Persona	Kebutuhan Utama
 
Supervisor Produksi	Monitoring target harian dan efisiensi lini produksi.
Tim Maintenance	Menerima notifikasi error mesin secara instan (real-time alert).
Manajer Pabrik	Analisis tren jangka panjang (OEE, produktivitas mingguan/bulanan).
Operator Mesin	Melihat status real-time mesin yang sedang dioperasikan.
5. Value Proposition Produk Aqua
Memberikan solusi End-to-End Visibility dari sensor fisik di mesin hingga ke dasbor eksekutif, memastikan setiap botol yang diproduksi tercatat dengan presisi tinggi guna menjaga standar kualitas Aqua.
6. Scope Fitur Utama
●	Real-time Dashboard: Visualisasi status mesin (Running, Idle, Error, Maintenance).
●	PLC Data Logger: Penarikan data otomatis dari PLC setiap 5-10 detik.
●	Automated Reporting: Pembuatan laporan harian otomatis dalam format PDF dan Excel.
●	Alert & Notification: Notifikasi melalui sistem atau email saat parameter mesin di luar batas normal.
●	History Logs: Penyimpanan data historis produksi hingga 2 tahun.
7. Scope Fitur Tambahan (Future Development)
●	Predictive Maintenance: Menggunakan AI untuk memprediksi kerusakan mesin sebelum terjadi.
●	Energy Monitoring: Integrasi konsumsi listrik mesin untuk efisiensi energi.
●	Mobile App: Aplikasi mobile khusus untuk monitoring jarak jauh oleh manajer.
●	OT Security: Keamanan Operasional
8. User Flow Aplikasi / Sistem
1.	Data Acquisition: Sensor mesin mengirim sinyal ke PLC -> IoT Gateway membaca register PLC.
2.	Data Processing: IoT Gateway mengirim data ke Cloud/Server via MQTT/HTTPS.
3.	Data Storage: Data disimpan ke dalam database time-series.
4.	Visualization: User login ke dashboard -> Memilih lini produksi -> Melihat grafik dan angka real-time.
5.	Reporting: User memilih rentang waktu -> Klik "Generate Report" -> Sistem mengirim file ke email/unduhan langsung.
9. Kebutuhan Fungsional (Functional Requirements)
●	Sistem harus mampu melakukan polling data dari minimal 1 line secara simultan.
●	Sistem harus menyediakan fitur manajemen user (Operator,Supervisor,Manager,PPIC).
●	Sistem harus bisa mengonversi kode error PLC menjadi deskripsi yang mudah dipahami manusia.
10. Kebutuhan Non-Fungsional
●	Performance: Latensi pengiriman data dari PLC ke Dashboard tidak boleh lebih dari 2 detik.
●	Reliability: Sistem harus memiliki uptime 99.9% mengingat pabrik beroperasi 24 jam.
●	Security: Enkripsi data dari gateway ke server menggunakan TLS/SSL.
●	Scalability: Mudah menambah modul mesin baru tanpa merombak arsitektur utama.
11. Data yang Digunakan (Input/Output Sistem)
●	Input: Counter produk, Status mesin (bit), Kecepatan motor (analog), Suhu, Tekanan angin, Error code PLC.
●	Output: Grafik OEE, Tabel downtime, PDF Daily Report, CSV Export, Notifikasi Alert.
12. Integrasi Sistem
●	PLC: Integrasi via protokol Modbus TCP/IP atau OPC-UA.
●	IoT Gateway: Perangkat keras (misal: Raspberry Pi Industrial atau Advantech) sebagai jembatan.
●	API: REST API untuk integrasi ke sistem ERP perusahaan di masa depan.
13. Arsitektur Sistem (High Level)
[Mesin Produksi] --(I/O)-- [PLC] 
                             |
                      (Modbus/OPC-UA)
                             |
                      [IoT Gateway] --(MQTT/HTTPS)-- [Cloud/Local Server]
                                                            |
                                                   [Database & Backend]
                                                            |
                                                   [Web Dashboard UI]

14. Teknologi yang Digunakan
●	Backend: Node.js atau Python (FastAPI).
●	Frontend: React.js dengan Tailwind CSS.
●	Database: InfluxDB (Data Time-series) & PostgreSQL (Metadata).
●	Broker: Mosquitto (MQTT).
●	Infra: Docker & Kubernetes (On-premise atau Cloud).
15. Timeline Pengembangan
Fase	Durasi	Output
Discovery & PLC Mapping	2 Minggu	Daftar Register Tag PLC
Development (Backend & IoT)	6 Minggu	Sistem penarikan data stabil
Frontend & Dashboard	4 Minggu	UI Dashboard interaktif
Testing & UAT	2 Minggu	Berita Acara Serah Terima
16. Resource yang Dibutuhkan
●	Tim: 1 Project Manager, 1 PLC/Automation Engineer, 1 IoT Engineer, 1 Backend Dev, 1 Frontend Dev.
●	Tools: PLC Software (TIA Portal/GX Works), Visual Studio Code, Docker, GitHub.
●	Hardware: Industrial IoT Gateways, Kabel LAN/Industrial Wi-Fi.
●	Tech Stack (Front-end) :
1.	Vite
2.	React
3.	React-Router-DOM
4.	Socket.io
5.	Axios
6.	Tailwindcss
7.	ReChart
8.	CLSX


●	Tech Stack (Back-end)
1.	NestJS 
2.	TypeScript 
3.	Prisma
4.	PostgreSQL
5.	Socket.IO
6.	Jest
7.	Passport
8.	Bcrypt
9.	jsmodbus
10.	InfluxDB

17. Risk & Mitigation
●	Risk: Putusnya koneksi internet/lokal di pabrik. Mitigation: Implementasi "Store and Forward" pada IoT Gateway (data disimpan lokal saat offline).
●	Risk: Kompatibilitas PLC lama. Mitigation: Penggunaan converter RS485 ke Ethernet.
18. Key Metrics / KPI Keberhasilan
●	OEE Accuracy: 100% kecocokan antara data sistem dengan sampling manual.
●	System Availability: > 99.5% per bulan.
●	User Adoption: Digunakan secara aktif oleh semua shift produksi.
19. Definisi Success Criteria
Project dianggap sukses jika sistem dapat menghasilkan laporan harian otomatis tanpa intervensi manual selama 30 hari berturut-turut dan memberikan data downtime yang akurat untuk minimal 3 lini produksi utama.
20. Constraint / Batasan Project
●	Tidak melakukan modifikasi program pada PLC yang sedang berjalan (hanya Read-only).
●	Sistem harus beroperasi di jaringan intranet pabrik terlebih dahulu sebelum dibuka ke publik.
21. Asumsi yang Digunakan
●	PLC sudah memiliki port komunikasi yang tersedia (Ethernet/Serial).
●	Pihak IT Pabrik memberikan akses firewall untuk pengiriman data IoT.
22. Dokumentasi dan Reporting
●	Technical Docs: API Documentation, Database Schema, Wiring Diagram IoT.
●	User Manual: Panduan pengoperasian dashboard untuk supervisor.
●	Project Report: Laporan mingguan progress pengembangan selama masa project.
