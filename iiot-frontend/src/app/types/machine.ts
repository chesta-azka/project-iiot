export interface Machine {
        machineId: string;
        machineName: string;
        status: 'RUNNING' | 'STOPPED';
        lastBottleCount: number;
        updtSeconds: string;
        latestAlarmCode?: number;
}

export interface DashboardSummary {
        success: boolean;
        lineStatus: {
                total: number;
                running: number;
                stopped: number;
        };
        machines: Machine[];
        analytics: {
                topBreakdownReasons: any[];
                mostFrequentError: string;
                totalDowntimeMinutes: number;
        };
}

export interface TrendData {
        time: string[];
        value: number[];
        machineId: string;
}