import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Star, Phone, MapPin, Clock, MessageSquare, ExternalLink, Globe, Share2, Mail, MessageCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface BusinessResult {
  id: string;
  name: string;
  address: string;
  phone?: string;
  rating: number;
  totalReviews: number;
  status?: string;
  reviews: {
    author: string;
    rating: number;
    text: string;
    time: string;
  }[];
  website?: string;
  priceLevel?: number;
}

interface ResultsTableProps {
  results: BusinessResult[];
  onDownloadCSV: () => void;
  isDownloading: boolean;
}

export const ResultsTable = ({ results, onDownloadCSV, isDownloading }: ResultsTableProps) => {
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);

  const generateCSVContent = () => {
    const headers = [
      'Business Name',
      'Address', 
      'Phone',
      'Rating',
      'Total Reviews',
      'Status',
      'Website',
      'Price Level',
      'Latest Reviews (Top 10)'
    ];

    const csvRows = [
      headers.join(','),
      ...results.map(business => {
        const reviews = business.reviews
          .slice(0, 10)
          .map(review => `"${review.author} (${review.rating}★): ${review.text.replace(/"/g, '""')}"`)
          .join('; ');

        return [
          `"${business.name.replace(/"/g, '""')}"`,
          `"${business.address.replace(/"/g, '""')}"`,
          `"${business.phone || 'N/A'}"`,
          business.rating.toString(),
          business.totalReviews.toString(),
          `"${business.status || 'Unknown'}"`,
          `"${business.website || 'N/A'}"`,
          `"${business.priceLevel ? '$'.repeat(business.priceLevel) : 'N/A'}"`,
          `"${reviews}"`
        ].join(',');
      })
    ];

    return csvRows.join('\n');
  };

  const handleShareViaEmail = () => {
    const csvContent = generateCSVContent();
    const subject = encodeURIComponent('Business Search Results');
    const body = encodeURIComponent(`Please find the business search results attached below:\n\n${csvContent}`);
    
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoLink, '_blank');
  };

  const handleShareViaWhatsApp = () => {
    const csvContent = generateCSVContent();
    const message = encodeURIComponent(`Business Search Results:\n\n${csvContent}`);
    
    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      window.open(`whatsapp://send?text=${message}`, '_blank');
    } else {
      window.open(`https://web.whatsapp.com/send?text=${message}`, '_blank');
    }
  };

  if (results.length === 0) {
    return null;
  }

  const formatPriceLevel = (level?: number) => {
    if (!level) return 'N/A';
    return '$'.repeat(level);
  };

  const formatRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <Card className="w-full elegant-shadow border-0 bg-card/50 backdrop-blur-sm animate-scale-in">
      <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-t-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-white" />
              </div>
              Search Results
              <Badge variant="secondary" className="ml-2 text-lg px-3 py-1">
                {results.length} found
              </Badge>
            </CardTitle>
            <p className="text-muted-foreground mt-1">
              Comprehensive business data with reviews and contact information
            </p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={onDownloadCSV}
              disabled={isDownloading}
              size="lg"
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
            >
              <Download className="h-5 w-5 mr-2" />
              {isDownloading ? 'Generating...' : 'Export CSV'}
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 bg-background border-border shadow-xl">
                <DropdownMenuItem onClick={handleShareViaEmail} className="cursor-pointer hover:bg-muted">
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareViaWhatsApp} className="cursor-pointer hover:bg-muted">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Share via WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="border-b-2">
                  <TableHead className="font-semibold text-foreground">Business Name</TableHead>
                  <TableHead className="font-semibold text-foreground">Location</TableHead>
                  <TableHead className="font-semibold text-foreground">Contact</TableHead>
                  <TableHead className="font-semibold text-foreground">Rating</TableHead>
                  <TableHead className="font-semibold text-foreground">Reviews</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((business, index) => (
                  <TableRow 
                    key={business.id} 
                    className="hover:bg-muted/30 transition-colors duration-200 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-foreground">{business.name}</div>
                        <div className="flex items-center gap-2">
                          {business.website && (
                            <Badge variant="outline" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              Website
                            </Badge>
                          )}
                          {business.priceLevel && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              {formatPriceLevel(business.priceLevel)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-start gap-2 max-w-xs">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground break-words">
                          {business.address}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {business.phone ? (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{business.phone}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">No phone</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="space-y-1">
                        {formatRating(business.rating)}
                        <div className="text-xs text-muted-foreground">
                          {business.totalReviews > 0 ? `${business.totalReviews} reviews` : 'No reviews'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge 
                        variant="secondary" 
                        className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300"
                      >
                        {business.reviews.length} available
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge 
                        variant={business.status === 'OPERATIONAL' ? 'default' : 'secondary'}
                        className={business.status === 'OPERATIONAL' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300' : ''}
                      >
                        {business.status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedBusiness(business)}
                              className="hover-lift"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Reviews
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-3 text-xl">
                                <div className="h-8 w-8 rounded-lg hero-gradient flex items-center justify-center">
                                  <Star className="h-4 w-4 text-white" />
                                </div>
                                {business.name}
                                <Badge variant="secondary" className="ml-auto">
                                  {business.reviews.length} Reviews
                                </Badge>
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-[500px] pr-4">
                              <div className="space-y-6">
                                {business.reviews.length > 0 ? (
                                  business.reviews.map((review, index) => (
                                    <div key={index} className="bg-muted/30 rounded-xl p-4 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="font-semibold text-foreground">{review.author}</div>
                                        <div className="flex items-center gap-3">
                                          {formatRating(review.rating)}
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {review.time}
                                          </div>
                                        </div>
                                      </div>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {review.text}
                                      </p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-12">
                                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-muted-foreground">No reviews available for this business</p>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        {business.website && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="hover-lift"
                          >
                            <a href={business.website} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Visit
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};