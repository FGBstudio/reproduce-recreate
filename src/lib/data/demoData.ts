// Demo data for locked modules showing sample data

// Energy demo data
export const demoEnergyConsumption = [
  { label: 'Gen', actual: 850, expected: 900, average: 780 },
  { label: 'Feb', actual: 720, expected: 850, average: 750 },
  { label: 'Mar', actual: 680, expected: 800, average: 720 },
  { label: 'Apr', actual: 590, expected: 750, average: 680 },
  { label: 'Mag', actual: 480, expected: 600, average: 550 },
  { label: 'Giu', actual: 420, expected: 500, average: 480 },
  { label: 'Lug', actual: 380, expected: 450, average: 420 },
  { label: 'Ago', actual: 410, expected: 480, average: 450 },
  { label: 'Set', actual: 520, expected: 600, average: 550 },
  { label: 'Ott', actual: 650, expected: 750, average: 680 },
  { label: 'Nov', actual: 780, expected: 850, average: 750 },
  { label: 'Dic', actual: 890, expected: 950, average: 820 },
];

export const demoEnergyDistribution = [
  { name: 'HVAC', value: 35, color: 'hsl(188, 100%, 19%)' },
  { name: 'Lighting', value: 28, color: 'hsl(338, 50%, 45%)' },
  { name: 'Plugs & Loads', value: 18, color: 'hsl(338, 50%, 75%)' },
  { name: 'Other', value: 12, color: 'hsl(188, 100%, 35%)' },
];

export const demoDeviceData = [
  { label: 'Gen', hvac: 8500, lighting: 4200, plugs: 2100 },
  { label: 'Feb', hvac: 7800, lighting: 3900, plugs: 2000 },
  { label: 'Mar', hvac: 6500, lighting: 3600, plugs: 1900 },
  { label: 'Apr', hvac: 5200, lighting: 3400, plugs: 1800 },
  { label: 'Mag', hvac: 4800, lighting: 3200, plugs: 1750 },
  { label: 'Giu', hvac: 6200, lighting: 3000, plugs: 1700 },
];

// Air quality demo data
export const demoCO2History = [
  { time: '00:00', co2: 420, limit: 1000 },
  { time: '04:00', co2: 380, limit: 1000 },
  { time: '08:00', co2: 580, limit: 1000 },
  { time: '12:00', co2: 680, limit: 1000 },
  { time: '16:00', co2: 690, limit: 1000 },
  { time: '20:00', co2: 450, limit: 1000 },
];

export const demoTVOCHistory = [
  { time: '00:00', tvoc: 120, limit: 500 },
  { time: '04:00', tvoc: 95, limit: 500 },
  { time: '08:00', tvoc: 280, limit: 500 },
  { time: '12:00', tvoc: 320, limit: 500 },
  { time: '16:00', tvoc: 290, limit: 500 },
  { time: '20:00', tvoc: 150, limit: 500 },
];

export const demoTempHumidity = [
  { time: '00:00', temp: 21.5, humidity: 45 },
  { time: '04:00', temp: 20.5, humidity: 52 },
  { time: '08:00', temp: 22.0, humidity: 42 },
  { time: '12:00', temp: 24.0, humidity: 35 },
  { time: '16:00', temp: 24.0, humidity: 36 },
  { time: '20:00', temp: 22.0, humidity: 44 },
];

export const demoPM25Data = [
  { day: 'Lun', indoor: 12, outdoor: 28, limit: 25 },
  { day: 'Mar', indoor: 15, outdoor: 35, limit: 25 },
  { day: 'Mer', indoor: 10, outdoor: 22, limit: 25 },
  { day: 'Gio', indoor: 18, outdoor: 42, limit: 25 },
  { day: 'Ven', indoor: 14, outdoor: 30, limit: 25 },
];

// Water demo data
export const demoWaterConsumption = [
  { month: 'Gen', consumption: 1250, target: 1100, lastYear: 1400 },
  { month: 'Feb', consumption: 1180, target: 1050, lastYear: 1320 },
  { month: 'Mar', consumption: 1320, target: 1150, lastYear: 1450 },
  { month: 'Apr', consumption: 1420, target: 1200, lastYear: 1580 },
  { month: 'Mag', consumption: 1680, target: 1400, lastYear: 1820 },
  { month: 'Giu', consumption: 1950, target: 1600, lastYear: 2100 },
];

export const demoWaterDistribution = [
  { name: 'Sanitari', value: 35, color: 'hsl(200, 80%, 50%)' },
  { name: 'HVAC', value: 28, color: 'hsl(200, 60%, 40%)' },
  { name: 'Irrigazione', value: 18, color: 'hsl(200, 70%, 60%)' },
  { name: 'Cucina', value: 12, color: 'hsl(200, 50%, 70%)' },
  { name: 'Altro', value: 7, color: 'hsl(200, 40%, 80%)' },
];

export const demoWaterQuality = [
  { time: '00:00', ph: 7.2, turbidity: 0.8, chlorine: 0.5 },
  { time: '08:00', ph: 7.3, turbidity: 1.2, chlorine: 0.52 },
  { time: '16:00', ph: 7.2, turbidity: 1.1, chlorine: 0.51 },
];

export const demoWaterLeaks = [
  { zone: 'Bagni Piano 1', leakRate: 2.3, status: 'warning' as const, detected: '3 giorni fa' },
  { zone: 'Cucina', leakRate: 0.8, status: 'ok' as const, detected: '-' },
  { zone: 'Irrigazione', leakRate: 5.2, status: 'critical' as const, detected: '1 ora fa' },
];
