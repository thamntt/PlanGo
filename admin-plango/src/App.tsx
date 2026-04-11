import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Destinations from './pages/Destinations';
import POIs from './pages/POIs';
import Trips from './pages/Trips';
import Reviews from './pages/Reviews';
import Settings from './pages/Settings';
import { DataProvider } from './contexts/DataContext';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <DataProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col h-full">
            <Header />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users" element={<Users />} />
              <Route path="/destinations" element={<Destinations />} />
              <Route path="/poi" element={<POIs />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      </DataProvider>
    </BrowserRouter>
  );
};

export default App;
