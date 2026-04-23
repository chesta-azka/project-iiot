Functional Specification Document (FSD) - Project Aqua Update
Versi: 1.1
Tanggal: 19 April 2026
Deskripsi: Dokumen ini merincikan pembaruan fitur pada sistem pelaporan mesin produksi Aqua, mencakup interaksi layout, peran pengguna baru, dan logika prediksi kegagalan.
________________________________________1. Modul Frontend: Interaksi Peta Lokasi & Seleksi Lini
Deskripsi Fitur
Pembaruan pada halaman utama yang menampilkan peta tata letak (layout) pabrik. User dapat berinteraksi langsung dengan peta untuk memilih lini produksi tertentu tanpa fitur zoom yang kompleks.

Image 1

 
Image 2
 

Alur Kerja (User Flow)
1.	User membuka halaman Plant Layout.
2.	Sistem menampilkan gambar peta lokasi pabrik (Referensi: Image 1).
3.	Setiap area Lini (Line 1, Line 2, dst.) pada gambar dipetakan sebagai area yang dapat diklik (Clickable hotspots).
4.	Saat user mengklik area Lini tertentu:
○	Sistem tidak melakukan transisi zoom seperti image 2.
○	Sistem memunculkan Line Selector Overlay/Modal atau Context Menu di lokasi klik.
○	User memilih Lini yang ingin dipantau dari pilihan yang muncul.
5.	Setelah dipilih, sistem akan mengarahkan user ke dashboard detail lini tersebut.
Spesifikasi Teknis Frontend
●	Komponen: Image Map atau SVG Container untuk layout pabrik.
●	Event Handling: onClick listener pada ID/Class koordinat lini.
●	State Management: Menyimpan selectedLineID ke dalam global state (Zustand/Redux) untuk filter data dashboard.
________________________________________2. Modul Admin: Peran PPIC & Validasi PDT (Planned Down Time)
Deskripsi Fitur
Penambahan peran pengguna baru (PPIC) dengan hak akses terbatas dan mekanisme penguncian data (Locking Mechanism) pada input manual PDT.
Spesifikasi Role PPIC
Role	Hak Akses (Permissions)	Batasan
 
PPIC	Akses Dashboard, Input PDT,	Hanya dapat mengakses modul Planned Down Time (PDT). 
Mekanisme Penguncian Input (Lock-on-Submit)
1.	PPIC mengisi form input PDT secara manual.
2.	Saat tombol  tombol Enter ditekan:
○	Sistem melakukan validasi data.
○	Data disimpan ke database PostgreSQL melalui Backend (NestJS).
○	Status Lock: Segera setelah data tersimpan, field input untuk record tersebut akan diubah menjadi Read-Only di sisi UI.

________________________________________3. Modul Backend: Fitur Failure Prediction (Non-Machine Learning)
Deskripsi Fitur
Implementasi logika peringatan dini kegagalan mesin berdasarkan perhitungan statistik dan ambang batas (threshold), tanpa menggunakan model Machine Learning.
Logika Algoritma untuk Backend (BE)
Backend akan menjalankan Scheduled Job (Cron Job) untuk menghitung probabilitas kegagalan berdasarkan parameter berikut:
1.	Metode MTBF Threshold:
○	BE menghitung rata-rata MTBF (Mean Time Between Failures) historis untuk tiap mesin dalam 30 hari terakhir.
○	BE menghitung Current_Running_Time (waktu berjalan sejak perbaikan terakhir).
○	Rule: Jika Current_Running_Time >= (90% * Average_MTBF), sistem mengirimkan alert "Potential Failure Imminent".
2.	Metode Frekuensi UPST (UnPlanned Stop):
○	Rule: Jika dalam periode 1 jam terjadi > 3 kali micro-stop (kejadian UPST singkat), sistem memprediksi akan terjadi kegagalan besar (Breakdown) dalam waktu dekat.
3.	Metode Running Hours (Maintenance Schedule):
○	BE melacak total jam kerja komponen tertentu (misal: Gripper Filling Unit).
○	Rule: Jika total jam kerja mendekati limit servis (misal: 2000 jam), status mesin berubah menjadi "At Risk".
Implementation Note for BE:
Gunakan Prisma untuk agregat data MTBF dan Socket.io untuk mengirimkan notifikasi prediksi secara real-time ke frontend tanpa perlu refresh halaman.
