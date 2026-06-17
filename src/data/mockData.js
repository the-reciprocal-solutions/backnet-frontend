export const MOCK_DEVICES = [
  { id: 1001, name: "AHU-01 Controller",  vendor: "Siemens",            model: "PXC4.E16",       status: "Online",  lastSeen: "1 min ago",  points: 48, type: "ahu"     },
  { id: 1002, name: "Chiller-01",         vendor: "Schneider Electric", model: "eXo Chiller Ctrl",status: "Online",  lastSeen: "45 sec ago", points: 36, type: "chiller" },
  { id: 1003, name: "VAV-101",            vendor: "Johnson Controls",   model: "VAV-Compact",    status: "Online",  lastSeen: "50 sec ago", points: 22, type: "vav"     },
  { id: 1004, name: "FCU-201",            vendor: "Siemens",            model: "PXC2",           status: "Online",  lastSeen: "2 min ago",  points: 18, type: "fcu"     },
  { id: 1005, name: "Energy Meter-01",    vendor: "Schneider Electric", model: "PM8000",         status: "Online",  lastSeen: "1 min ago",  points: 34, type: "meter"   },
  { id: 1006, name: "Lighting Panel-01",  vendor: "Helvar",             model: "Router 920",     status: "Online",  lastSeen: "1 min ago",  points: 16, type: "light"   },
  { id: 1007, name: "Boiler-01",          vendor: "Bosch",              model: "BCO300",         status: "Online",  lastSeen: "2 min ago",  points: 28, type: "boiler"  },
  { id: 1008, name: "Pump-01",            vendor: "Grundfos",           model: "iSOLUTIONS",     status: "Online",  lastSeen: "1 min ago",  points: 14, type: "pump"    },
  { id: 1009, name: "CO2 Sensor-01",      vendor: "S+S Regeltechnik",   model: "RCO2-W",         status: "Offline", lastSeen: "45 sec ago", points: 6,  type: "sensor"  },
  { id: 1010, name: "BACnet Router-01",   vendor: "LOYTEC",             model: "L-IP",           status: "Online",  lastSeen: "30 sec ago", points: 8,  type: "router"  },
  { id: 1011, name: "Fire Panel-01",      vendor: "Notifier",           model: "NFS2-640",       status: "Online",  lastSeen: "1 min ago",  points: 12, type: "fire"    },
  { id: 1012, name: "UPS System-01",      vendor: "Eaton",              model: "93E",            status: "Offline", lastSeen: "10 min ago", points: 20, type: "ups"     },
];

export const MOCK_ALARMS = [
  { id: 1, device: "AHU-01",    object: "BI:3",  desc: "Supply Fan Status changed to OFF",        time: "08:44:12 AM", severity: "ALARM", priority: "High"   },
  { id: 2, device: "Chiller-02",object: "AI:8",  desc: "High Discharge Temperature — 62.3°C",     time: "08:43:55 AM", severity: "ALARM", priority: "High"   },
  { id: 3, device: "VAV-15",    object: "AV:8",  desc: "No Communication — device unreachable",   time: "08:39:21 AM", severity: "WARN",  priority: "Medium" },
  { id: 4, device: "Pump-03",   object: "BI:5",  desc: "Runtime Exceeded — maintenance due",       time: "08:35:08 AM", severity: "INFO",  priority: "Low"    },
];

export const MOCK_EVENTS = [
  { time: "08:44:12 AM", type: "ALARM", device: "AHU-01",   object: "BI:3",  desc: "Supply Fan Status changed to OFF"     },
  { time: "08:43:55 AM", type: "VALUE", device: "Room-101", object: "AI:12", desc: "Temperature changed to 24.6°C"         },
  { time: "08:43:21 AM", type: "EVENT", device: "Chiller-02",object: "AV:8", desc: "Discharge Temperature is 62.3°C"       },
  { time: "08:42:08 AM", type: "ACK",   device: "VAV-07",   object: "BI:5",  desc: "Communication restored"               },
];

export function generateTimeSeriesData() {
  const data = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      data.push({
        time,
        temp:     parseFloat((22 + Math.sin(h / 4) * 3     + Math.random() * 0.5).toFixed(1)),
        humidity: parseFloat((55 + Math.cos(h / 5) * 8     + Math.random() * 1  ).toFixed(1)),
        co2:      parseFloat((750 + Math.sin(h / 3) * 150  + Math.random() * 30 ).toFixed(0)),
      });
    }
  }
  return data;
}

export const TIME_SERIES = generateTimeSeriesData();

export const NETWORK_SUMMARY = {
  broadcasts:     12,
  iAmResponses:   124,
  readRequests:   5634,
  failedRequests: 23,
  networkLoad:    42,
};
