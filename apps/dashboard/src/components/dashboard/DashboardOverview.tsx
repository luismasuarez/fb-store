import StatsCards from "@/components/dashboard/StatsCards"
import QuickScrape from "@/components/quick-scrape/QuickScrape"
import RecentScrapes from "@/components/dashboard/RecentScrapes"

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <StatsCards />
      <QuickScrape />
      <RecentScrapes />
    </div>
  )
}
