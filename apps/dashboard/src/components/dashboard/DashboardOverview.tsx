import StatsCards from "@/components/dashboard/StatsCards"
import QuickScrape from "@/components/quick-scrape/QuickScrape"
import RecentScrapes from "@/components/dashboard/RecentScrapes"
import AiProcessCard from "@/components/dashboard/AiProcessCard"

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <StatsCards />
      <QuickScrape />
      <AiProcessCard />
      <RecentScrapes />
    </div>
  )
}
