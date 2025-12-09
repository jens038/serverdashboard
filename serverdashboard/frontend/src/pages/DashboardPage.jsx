// src/pages/DashboardPage.jsx
import Header from "../components/Header.jsx";
import StatusSection from "../components/StatusSection.jsx";
import ServerStats from "../components/ServerStats.jsx";
import ContainerGrid from "../components/ContainerGrid.jsx";
import CallToAction from "../components/CallToAction.jsx";

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ✅ hier maken we 'm ~1600px breed */}
      <div className="w-full max-w-[2200px] mx-auto px-2 md:px-4 pt-5 pb-6">
        {/* Headerbalk over de volle breedte van de container */}
        <Header />

        {/* 2-koloms layout: links stats/tiles, rechts Plex/qBittorrent/Overseerr */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] items-start">
          {/* Linker kolom */}
          <div className="space-y-6">
            <ServerStats />
            <ContainerGrid />
          </div>

          {/* Rechter kolom */}
          <div className="space-y-6">
            <StatusSection />
          </div>
        </div>

        {/* Onderste tekst / CTA */}
        <CallToAction />
      </div>
    </div>
  );
}

export default DashboardPage;
