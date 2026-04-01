'use client';

import { useEffect, useState } from 'react';
import { getMachineTrend } from '../lib/api';
import { TrendData } from '../types/machine';
import { LineChart, Activity, Cpu, Timer } from 'lucide-react'; // Icon tambahan
import {
        Chart as ChartJS,
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        Title,
        Tooltip,
        Legend,
        Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function TrendPage() {
        const [trend, setTrend] = useState<TrendData | null>(null);
        const [selectedMachine, setSelectedMachine] = useState('FILLER-01');

        useEffect(() => {
                const loadTrend = async () => {
                        try {
                                const data = await getMachineTrend(selectedMachine);
                                setTrend(data);
                        } catch (error) {
                                console.error("Gagal ambil data trend:", error);
                        }
                };

                loadTrend();
                const interval = setInterval(loadTrend, 500);
                return () => clearInterval(interval);
        }, [selectedMachine]);

        // Menghitung statistik sederhana dari data trend
        const latestValue = trend?.value[trend.value.length - 1] || 0;
        const maxValue = trend ? Math.max(...trend.value) : 0;
        const avgValue = trend ? (trend.value.reduce((a, b) => a + b, 0) / trend.value.length).toFixed(1) : 0;

        const chartData = {
                labels: trend?.time.map(t => new Date(t).toLocaleTimeString([], { hour12: false })) || [],
                datasets: [
                        {
                                label: `Output Speed`,
                                data: trend?.value || [],
                                fill: true,
                                borderColor: 'rgb(37, 99, 235)', // Blue 600
                                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                                borderWidth: 2,
                                pointRadius: 0, // Sembunyikan titik agar garis terlihat smooth
                                pointHoverRadius: 5,
                                tension: 0.4, // Membuat garis melengkung halus
                        },
                ],
        };

        const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                        duration: 400, // Sedikit lebih cepat dari interval update
                },
                scales: {
                        x: {
                                grid: { display: false },
                                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                        },
                        y: {
                                beginAtZero: false,
                                grid: { color: 'rgba(0,0,0,0.05)' }
                        }
                },
                plugins: {
                        legend: { display: false }, // Kita pakai custom header saja
                        tooltip: {
                                backgroundColor: '#1e293b',
                                padding: 12,
                                titleFont: { size: 14 },
                                bodyFont: { size: 14 }
                        }
                }
        };

        return (
                <div className="p-8 bg-slate-50 min-h-screen">
                        {/* HEADER SECTION */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                <div>
                                        <div className="flex items-center gap-2 mb-1">
                                                <LineChart className="text-blue-600" size={24} />
                                                <h1 className="text-2xl font-bold text-slate-900">Real-time Analytics</h1>
                                        </div>
                                        <p className="text-slate-500 text-sm">Monitoring production output per 500ms</p>
                                </div>

                                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                                        <Cpu size={18} className="text-slate-400 ml-2" />
                                        <select
                                                className="bg-transparent font-semibold text-slate-700 outline-none pr-4 cursor-pointer"
                                                value={selectedMachine}
                                                onChange={(e) => setSelectedMachine(e.target.value)}
                                        >
                                                <option value="FILLER-01">Mesin Filler Utama</option>
                                                <option value="LABELLER-01">Mesin Labeller Utama</option>
                                                <option value="CAPPER-01">Mesin Capping</option>
                                                {/* ... tambahkan 15 mesin lainnya di sini */}
                                        </select>
                                </div>
                        </div>

                        {/* STATS CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                <StatCard title="Current Speed" value={`${latestValue} BPM`} icon={<Activity className="text-blue-600" />} />
                                <StatCard title="Peak Output" value={`${maxValue} BPM`} icon={<Activity className="text-emerald-600" />} />
                                <StatCard title="Average Rate" value={`${avgValue} BPM`} icon={<Timer className="text-amber-600" />} />
                        </div>

                        {/* MAIN CHART */}
                        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
                                <div className="flex justify-between items-center mb-6">
                                        <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest">Production Trend (Bottles Per Minute)</h3>
                                        <div className="flex items-center gap-2">
                                                <span className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></span>
                                                <span className="text-xs font-medium text-slate-400 uppercase">Live Feed</span>
                                        </div>
                                </div>

                                <div className="h-[450px] w-full">
                                        {trend ? (
                                                <Line data={chartData} options={chartOptions} />
                                        ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
                                                        <p>Synchronizing with InfluxDB...</p>
                                                </div>
                                        )}
                                </div>
                        </div>
                </div>
        );
}

// Sub-komponen agar kode rapi
function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
        return (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
                        <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
                        <div>
                                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
                                <p className="text-2xl font-bold text-slate-800">{value}</p>
                        </div>
                </div>
        );
}