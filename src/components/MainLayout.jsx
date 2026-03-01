import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTrip } from "../contexts/TripContext";
import { useLang, LANGUAGES } from "../contexts/LangContext";
import { useToast, ToastContainer } from "../hooks/useToast";
import TripsPage from "./trips/TripsPage";
import ReceiptsPage from "./receipts/ReceiptsPage";
import GalleryPage from "./gallery/GalleryPage";
import PeoplePage from "./people/PeoplePage";
import SummaryPage from "./summary/SummaryPage";
import SettingsPage from "./settings/SettingsPage";
import "./MainLayout.css";

export default function MainLayout() {
  const [tab, setTab] = useState("trips");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const { activeTrip } = useTrip();
  const { tr, lang, changeLang } = useLang();
  const toast = useToast();

  const NAV = [
    { id: "trips",    icon: "🗺", label: tr.trips },
    { id: "receipts", icon: "🧾", label: tr.receipts },
    { id: "gallery",  icon: "📷", label: tr.gallery },
    { id: "people",   icon: "👥", label: tr.people },
    { id: "summary",  icon: "💰", label: tr.summary },
  ];

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  const renderPage = () => {
    const props = { toast, tripId: activeTrip?.id };
    switch (tab) {
      case "trips":    return <TripsPage {...props} onNavigate={setTab} />;
      case "receipts": return <ReceiptsPage {...props} />;
      case "gallery":  return <GalleryPage {...props} />;
      case "people":   return <PeoplePage {...props} />;
      case "summary":  return <SummaryPage {...props} />;
      case "settings": return <SettingsPage {...props} />;
      default:         return <TripsPage {...props} onNavigate={setTab} />;
    }
  };

  const initials = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header-inner">

          {/* Logo — click to go to trips */}
          <button
            className="app-brand"
            onClick={() => setTab("trips")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span className="app-brand-icon">✈</span>
            <span className="app-brand-name">Wandersplit</span>
          </button>

          {/* Active trip pill — click to go to trips */}
          {activeTrip && (
            <button
              className="app-trip-pill"
              onClick={() => setTab("trips")}
              style={{ cursor: "pointer", border: "none" }}
            >
              <span className="app-trip-name">{activeTrip.name}</span>
              <span className="app-trip-currency">{activeTrip.baseCurrency}</span>
            </button>
          )}

          <div className="app-header-actions">
            <button className="btn btn-icon" title={tr.settings}
              onClick={() => setTab("settings")}>⚙</button>

            <div className="user-menu-wrap">
              <button className="user-avatar-btn" onClick={() => setShowUserMenu(v => !v)}>
                <span className="user-initials">{initials}</span>
              </button>

              {showUserMenu && (
                <>
                  <div className="user-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                  <div className="user-menu">
                    <div className="user-menu-info">
                      <div className="user-menu-avatar">{initials}</div>
                      <div>
                        <div className="user-menu-name">{user?.displayName || "User"}</div>
                        <div className="user-menu-email">{user?.email}</div>
                      </div>
                    </div>
                    <div className="user-menu-divider" />
                    <div className="user-menu-section-label">{tr.language}</div>
                    <div className="user-menu-langs">
                      {LANGUAGES.map(l => (
                        <button key={l.code}
                          className={`user-menu-lang-btn ${lang === l.code ? "active" : ""}`}
                          onClick={() => changeLang(l.code)}>
                          {l.flag} {l.label}
                        </button>
                      ))}
                    </div>
                    <div className="user-menu-divider" />
                    <button className="user-menu-logout" onClick={handleLogout}>
                      🚪 {tr.signOut}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">{renderPage()}</main>

      <nav className="app-nav">
        {NAV.map(n => (
          <button key={n.id}
            className={`nav-item ${tab === n.id ? "active" : ""}`}
            onClick={() => setTab(n.id)}>
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>

      <ToastContainer toasts={toast.toasts} />
    </div>
  );
}
