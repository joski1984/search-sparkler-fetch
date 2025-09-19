import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, Sparkles } from 'lucide-react';

interface SearchFormProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export const SearchForm = ({ onSearch, isLoading }: SearchFormProps) => {
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