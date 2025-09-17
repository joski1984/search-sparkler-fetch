import { useState } from 'react';
import { SearchForm } from '@/components/SearchForm';
import { ResultsTable, BusinessResult } from '@/components/ResultsTable';
import { useToast } from '@/components/ui/use-toast';
import { generateCSV, downloadCSV } from '@/utils/csvExport';
import { supabase } from '@/integrations/supabase/client';

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Business Search & Export</h1>
          <p className="text-xl text-muted-foreground">
            Search for businesses and export detailed information including reviews to CSV
          </p>
        </div>

        <SearchForm onSearch={handleSearch} isLoading={isLoading} />
        
        <ResultsTable 
          results={results}
          onDownloadCSV={handleDownloadCSV}
          isDownloading={isDownloading}
        />
      </div>
    </div>
  );
};

export default Index;
