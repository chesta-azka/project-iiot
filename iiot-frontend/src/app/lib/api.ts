import axios from 'axios';
// Tambahkan TrendData di sini
import { DashboardSummary, TrendData } from '../types/machine';

const api = axios.create({
        baseURL: 'http://localhost:3006',
});

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
        const response = await api.get<DashboardSummary>('api/machine-analytics/dashboard-summary');
        return response.data;
};

export const getMachineTrend = async (machineId: string, range: string = '-1h'): Promise<TrendData> => {
        const response = await api.get<TrendData>(`api/machine-analytics/trend`, {
                params: { machineId, range }
        });
        return response.data;
};

// Tambahan fungsi untuk History (fitur terakhir BE)
export const getBreakdownHistory = async (page: number = 1, limit: number = 10) => {
        const response = await api.get(`/machine-history`, {
                params: { page, limit }
        });
        return response.data;
};

api.interceptors.request.use((config) => {
        const token = localStorage.getItem('token'); // Asumsi token disimpan di localStorage
        if (token) {
                config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
});