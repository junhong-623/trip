import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TripProvider } from "./contexts/TripContext";
import { LangProvider } from "./contexts/LangContext";
import LoginPage from "./components/LoginPage";
import MainLayout from "./components/MainLayout";
import "./App.css";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">✈</div>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <TripProvider>
      <MainLayout />
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
