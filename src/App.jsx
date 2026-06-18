import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import LoginPage       from './pages/LoginPage';
import DashboardPage   from './pages/DashboardPage';
import DevicesPage     from './pages/DevicesPage';
import AlarmsPage      from './pages/AlarmsPage';
import TrendsPage      from './pages/TrendsPage';
import EventLogPage    from './pages/EventLogPage';
import ScenariosPage   from './pages/ScenariosPage';
import LivePointsPage  from './pages/LivePointsPage';
import ObjectExplorerPage from './pages/ObjectExplorerPage';
import NetworkPage     from './pages/NetworkPage';
import SettingsPage    from './pages/SettingsPage';
import PerformancePage from './pages/PerformancePage';
import ReportsPage     from './pages/ReportsPage';
import EnergyPage      from './pages/EnergyPage';
import UsersPage       from './pages/UsersPage';
import PlaceholderPage from './pages/PlaceholderPage';
import Sidebar         from './components/Sidebar';
import LLMChat         from './components/LLMChat';
import { isAuthed, clearAuth } from './services/auth';
import ConnectionStatus from './components/ConnectionStatus';
import { connect, close } from './services/ws';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isAuthed());

  // Backend rejected the session (401) → drop to login.
  useEffect(() => {
    const onExpired = () => setLoggedIn(false);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  function handleLogout() {
    clearAuth();
    setLoggedIn(false);
  }

  // Connect WebSocket automatically when logged in, close it when logged out
  useEffect(() => {
    if (loggedIn) {
      connect();
    } else {
      close();
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', background: '#f8faf9', minHeight: '100vh' }}>
        <Sidebar onLogout={handleLogout} />
        <main style={{
          marginLeft: 220,
          flex: 1,
          padding: '28px 32px',
          minHeight: '100vh',
          maxWidth: 'calc(100vw - 220px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <ConnectionStatus />
          </div>
          <Routes>
            <Route path="/"            element={<DashboardPage />}  />
            <Route path="/devices"     element={<DevicesPage />}    />
            <Route path="/alarms"      element={<AlarmsPage />}     />
            <Route path="/trends"      element={<TrendsPage />}     />
            <Route path="/events"      element={<EventLogPage />}   />
            <Route path="/schedules"   element={<ScenariosPage />}  />
            <Route path="/objects"     element={<ObjectExplorerPage />}                     />
            <Route path="/livepoints"  element={<LivePointsPage />}                         />
            <Route path="/energy"      element={<EnergyPage />}                             />
            <Route path="/performance" element={<PerformancePage />}                        />
            <Route path="/reports"     element={<ReportsPage />}                            />
            <Route path="/network"     element={<NetworkPage />}                            />
            <Route path="/users"       element={<UsersPage />}                              />
            <Route path="/settings"    element={<SettingsPage />}                           />
          </Routes>
        </main>

        {/* AI chat floats over every page, outside <main> so z-index is clean */}
        <LLMChat />
      </div>
    </BrowserRouter>
  );
}
