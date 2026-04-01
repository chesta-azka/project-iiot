'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDashboardSummary } from './lib/api';
import { DashboardSummary } from './types/machine';
import {
  Activity, CheckCircle2, AlertCircle,
  Settings, Clock, Volume2, VolumeX, BellRing
} from 'lucide-react';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Default muted karena aturan browser
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Audio Ref untuk simpan instance suara
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 1. Setup Audio Alarm
  useEffect(() => {
    // Ganti URL ini dengan file .mp3 alarm pilihanmu di folder public
    const alarm = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3');
    alarm.loop = true;
    audioRef.current = alarm;

    return () => {
      alarm.pause();
      audioRef.current = null;
    };
  }, []);

  const loadData = async () => {
    try {
      const data = await getDashboardSummary();
      setSummary(data);
      setLastUpdate(new Date().toLocaleTimeString());

      // 2. LOGIC ALARM OTOMATIS
      const hasStopped = data.machines.some(m => m.status !== 'RUNNING');

      if (hasStopped && !isMuted) {
        audioRef.current?.play().catch(() => {
          console.warn("Autoplay diblokir browser. Klik 'Unmute' dulu!");
        });
      } else {
        audioRef.current?.pause();
      }
    } catch (error) {
      console.error("Gagal tarik data:", error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [isMuted]); // Re-run logic kalau status mute berubah

  if (!summary) return (
    <div className="flex h-screen items-center justify-center bg-slate-50 font-mono text-slate-400">
      <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
        CONNECTING TO IIOT SERVER...
      </motion.div>
    </div>
  );

  const hasAlert = summary.lineStatus.stopped > 0;

  return (
    <div className={`min-h-screen transition-colors duration-500 ${hasAlert && !isMuted ? 'bg-red-50/30' : 'bg-[#F8FAFC]'}`}>

      {/* ALARM BANNER (Hanya muncul kalau ada yang STOPPED) */}
      <AnimatePresence>
        {hasAlert && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="bg-red-600 text-white overflow-hidden"
          >
            <div className="p-2 flex justify-center items-center gap-4 text-sm font-black uppercase tracking-[0.2em]">
              <BellRing size={16} className="animate-bounce" />
              CRITICAL: {summary.lineStatus.stopped} MACHINE(S) OFFLINE
              <BellRing size={16} className="animate-bounce" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-8 max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
              AQUA <span className="text-blue-600">PRO</span> MONITOR
            </h1>
            <p className="text-slate-500 font-medium">Last Sync: {lastUpdate} • Cycle: 2s</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${isMuted
                  ? 'bg-slate-100 text-slate-400'
                  : 'bg-red-600 text-white shadow-lg shadow-red-200 animate-pulse'
                }`}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              {isMuted ? 'ALARM MUTED' : 'ALARM ACTIVE'}
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <StatCard label="ASSETS" value={summary.lineStatus.total} color="blue" />
          <StatCard label="RUNNING" value={summary.lineStatus.running} color="emerald" />
          <StatCard
            label="STOPPED"
            value={summary.lineStatus.stopped}
            color="rose"
            isAlert={summary.lineStatus.stopped > 0}
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Machine Unit</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Operation</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Production</th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Up-Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.machines.map((machine) => (
                <tr key={machine.machineId} className={`group transition-colors ${machine.status !== 'RUNNING' ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                  <td className="p-6 font-bold text-slate-800">{machine.machineName}</td>
                  <td className="p-6">
                    <div className="flex justify-center">
                      <span className={`px-4 py-1 rounded-lg text-[10px] font-black tracking-widest border-2 ${machine.status === 'RUNNING'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                          : 'bg-red-600 border-red-600 text-white animate-pulse'
                        }`}>
                        {machine.status}
                      </span>
                    </div>
                  </td>
                  <td className="p-6 text-right font-mono text-lg font-black text-blue-600">
                    {machine.lastBottleCount.toLocaleString()}
                  </td>
                  <td className="p-6 text-right text-slate-500 font-bold italic">
                    {machine.updtSeconds}s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Sub-component stat card biar rapi
function StatCard({ label, value, color, isAlert }: any) {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100'
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`p-8 rounded-3xl border-2 transition-all ${isAlert ? 'bg-red-600 border-red-600' : 'bg-white border-slate-100 shadow-sm'}`}
    >
      <p className={`text-xs font-black tracking-[0.2em] ${isAlert ? 'text-white/70' : 'text-slate-400'}`}>{label}</p>
      <p className={`text-6xl font-black mt-2 ${isAlert ? 'text-white' : 'text-slate-900'}`}>{value}</p>
    </motion.div>
  );
}