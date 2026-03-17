import { useState, useEffect } from "react";
import { useViewport } from "./hooks/useViewport";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TripProvider } from "./contexts/TripContext";
import { LangProvider } from "./contexts/LangContext";
import LoginPage from "./components/LoginPage";
import MainLayout from "./components/MainLayout";
import { AppConfigProvider } from "./hooks/useAppConfig";
import "./App.css";

function AppContent() {
  const { user, loading } = useAuth();
  useViewport();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="splash-logo-wrap">
          <img src="/trip/icons/icon-192.png" alt="MateTrip" className="splash-logo" />
        </div>
        <div className="splash-name">
          <span className="splash-name-en">MateTrip</span>
          <span className="splash-name-zh">伴旅</span>
        </div>
        <div className="splash-slogan">不是分账工具，是一起旅行的记忆。</div>
        <div className="loading-spinner" style={{marginTop:24}} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
  <TripProvider>
    <AppConfigProvider>
      <MainLayout />
    </AppConfigProvider>
  </TripProvider>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LangProvider>
  );
}
