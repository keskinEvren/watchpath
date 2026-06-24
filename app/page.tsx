import NavBar from '@/components/shared/NavBar';
import Hero from '@/components/landing/Hero';
import SearchSection from '@/components/landing/SearchSection';
import HowItWorks from '@/components/landing/HowItWorks';
import PopularRoadmaps from '@/components/landing/PopularRoadmaps';

export default function LandingPage() {
  return (
    <>
      <NavBar />
      <main>
        <Hero />
        <SearchSection />
        <HowItWorks />
        <PopularRoadmaps />
      </main>
    </>
  );
}
