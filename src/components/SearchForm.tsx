import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, Loader2, Sparkles } from 'lucide-react';

interface SearchOptions {
  maxResults: number;
  searchIntensity: 'low' | 'medium' | 'high';
}

interface SearchFormProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
}

export const SearchForm = ({ onSearch, isLoading, searchOptions, onSearchOptionsChange }: SearchFormProps) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const exampleQueries = [
    "restaurants in New York",
    "coffee shops in San Francisco", 
    "hotels in Paris",
    "gyms in London"
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="elegant-shadow border-0 bg-card/50 backdrop-blur-sm hover-lift">
        <CardHeader className="text-center pb-4">
          <CardTitle className="flex items-center justify-center gap-3 text-2xl md:text-3xl">
            <div className="h-10 w-10 rounded-xl hero-gradient flex items-center justify-center glow-effect">
              <Search className="h-5 w-5 text-white" />
            </div>
            Search Businesses Worldwide
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            Find detailed business information, reviews, and export comprehensive data
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Enter your search query (e.g., restaurants in New York)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
                className="h-14 text-lg pl-12 pr-4 border-2 focus:ring-2 focus:ring-primary/20 bg-background/50 backdrop-blur-sm"
              />
              <Search className="h-5 w-5 text-muted-foreground absolute left-4 top-1/2 transform -translate-y-1/2" />
            </div>
            <Button 
              type="submit" 
              disabled={isLoading || !query.trim()}
              size="lg"
              className="h-14 px-8 bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Searching...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Search Now
                </>
              )}
            </Button>
          </form>
          
          {/* Advanced Search Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-muted/30 rounded-xl border border-border/50">
            <div className="space-y-2">
              <Label htmlFor="maxResults" className="text-sm font-medium">Maximum Results</Label>
              <Select
                value={searchOptions.maxResults.toString()}
                onValueChange={(value) => 
                  onSearchOptionsChange({
                    ...searchOptions,
                    maxResults: parseInt(value)
                  })
                }
                disabled={isLoading}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 (Standard)</SelectItem>
                  <SelectItem value="150">150 (Enhanced)</SelectItem>
                  <SelectItem value="250">250 (Comprehensive)</SelectItem>
                  <SelectItem value="400">400 (Maximum)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {searchOptions.maxResults <= 60 ? 'Standard Google Places search' : 'Enhanced grid search for more results'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="searchIntensity" className="text-sm font-medium">Search Intensity</Label>
              <Select
                value={searchOptions.searchIntensity}
                onValueChange={(value: 'low' | 'medium' | 'high') =>
                  onSearchOptionsChange({
                    ...searchOptions,
                    searchIntensity: value
                  })
                }
                disabled={isLoading || searchOptions.maxResults <= 60}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (2x2 grid)</SelectItem>
                  <SelectItem value="medium">Medium (3x3 grid)</SelectItem>
                  <SelectItem value="high">High (4x4 grid)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {searchOptions.maxResults <= 60 ? 'Only available for enhanced searches' : 
                `Grid size: ${searchOptions.searchIntensity === 'low' ? '2x2' : searchOptions.searchIntensity === 'medium' ? '3x3' : '4x4'} searches`}
              </p>
            </div>
          </div>
          
          {/* Example queries */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-3">Try these example searches:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {exampleQueries.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(example)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-muted hover:bg-muted/80 rounded-full transition-colors hover:text-primary"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};