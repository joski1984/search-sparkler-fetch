import { useState } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable, BusinessResult } from '@/components/ResultsTable';
import { useToast } from '@/components/ui/use-toast';
import { generateCSV, downloadCSV } from '@/utils/csvExport';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, TrendingUp, Users, Zap, Star, CheckCircle } from 'lucide-react';

const Index = () => {
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('search-businesses', {
        body: { query }
      });

      if (error) {
        throw error;
      }

      if (data?.results) {
        setResults(data.results);
        toast({
          title: "Search completed",
          description: `Found ${data.results.length} businesses`,
        });
      } else {
        setResults([]);
        toast({
          title: "No results",
          description: "No businesses found for your search query",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Search error:', error);
      toast({
        title: "Search failed", 
        description: error.message || "Failed to search businesses",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCSV = async () => {
    if (results.length === 0) return;

    setIsDownloading(true);
    try {
      const csvContent = generateCSV(results);
      const timestamp = new Date().toISOString().split('T')[0];
      downloadCSV(csvContent, `business_search_${timestamp}.csv`);
      
      toast({
        title: "CSV downloaded",
        description: `Successfully downloaded ${results.length} business records`,
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to generate CSV file",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl hero-gradient flex items-center justify-center">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">BusinessFind</h1>
                <p className="text-xs text-muted-foreground">Professional Business Discovery</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Advanced Search
              </span>
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Real Reviews
              </span>
              <span className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Instant Export
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-gradient text-white py-20 px-6 animate-fade-in">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Discover Businesses
            <span className="block bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Export Everything
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-relaxed">
            Search millions of businesses worldwide. Get detailed information, reviews, and contact details. 
            Export comprehensive data to CSV with one click.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover-lift">
              <Star className="h-8 w-8 mb-4 mx-auto text-yellow-300" />
              <h3 className="font-semibold mb-2">Real Reviews</h3>
              <p className="text-white/80 text-sm">Access authentic customer reviews and ratings for every business</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover-lift">
              <MapPin className="h-8 w-8 mb-4 mx-auto text-blue-300" />
              <h3 className="font-semibold mb-2">Precise Location</h3>
              <p className="text-white/80 text-sm">Get exact addresses and contact information for accurate results</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover-lift">
              <CheckCircle className="h-8 w-8 mb-4 mx-auto text-green-300" />
              <h3 className="font-semibold mb-2">Export Ready</h3>
              <p className="text-white/80 text-sm">Download comprehensive business data in CSV format instantly</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <SearchForm onSearch={handleSearch} isLoading={isLoading} />
          </div>
          
          <div className="mt-12 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <ResultsTable 
              results={results}
              onDownloadCSV={handleDownloadCSV}
              isDownloading={isDownloading}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12 px-6 mt-20">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-lg">BusinessFind</span>
          </div>
          <p className="text-muted-foreground">
            Powered by Google Places API • Professional Business Discovery Platform
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
