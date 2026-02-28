import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTrip } from "../contexts/TripContext";
import { useToast, ToastContainer } from "../hooks/useToast";
import TripsPage from "./trips/TripsPage";
import ReceiptsPage from "./receipts/ReceiptsPage";
import GalleryPage from "./gallery/GalleryPage";
import PeoplePage from "./people/PeoplePage";
import SummaryPage from "./summary/SummaryPage";
import SettingsPage from "./settings/SettingsPage";
import "./MainLayout.css";

const NAV = [
  { id: "trips",    icon: "🗺", label: "Trips" },
  { id: "receipts", icon: "🧾", label: "Receipts" },
  { id: "gallery",  icon: "📷", label: "Gallery" },
  { id: "people",   icon: "👥", label: "People" },
  { id: "summary",  icon: "💰", label: "Summary" },
];

export default function MainLayout() {
  const [tab, setTab] = useState("trips");
  const { user, logout } = useAuth();
  const { activeTrip } = useTrip();
  const toast = useToast();

  const renderPage = () => {
    const props = { toast, tripId: activeTrip?.id };
    switch (tab) {
      case "trips":    return <TripsPage {...props} onNavigate={setTab} />;
      case "receipts": return <ReceiptsPage {...props} />;
      case "gallery":  return <GalleryPage {...props} />;
      case "people":   return <PeoplePage {...props} />;
      case "summary":  return <SummaryPage {...props} />;
      default:         return <TripsPage {...props} onNavigate={setTab} />;
    }
  };

  return (
    <div className="app-layout">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <span className="app-brand-icon">✈</span>
            <span className="app-brand-name">Wandersplit</span>
          </div>
          {activeTrip && (
            <div className="app-trip-pill">
              <span className="app-trip-name">{activeTrip.name}</span>
              <span className="app-trip-currency">{activeTrip.baseCurrency}</span>
            </div>
          )}
          <div className="app-header-actions">
            <button
              className="btn btn-icon"
              title="Settings"
              onClick={() => setTab("settings")}
            >⚙</button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={logout}
              title="Sign out"
            >
              <span className="user-initials">
                {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="app-main">
        {renderPage()}
      </main>

      {/* Bottom Nav */}
      <nav className="app-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-item ${tab === n.id ? "active" : ""}`}
            onClick={() => setTab(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>

      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}
