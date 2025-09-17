import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Star, Phone, MapPin, Clock, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Search Results ({results.length} found)
          </CardTitle>
          <Button 
            onClick={onDownloadCSV}
            disabled={isDownloading}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            {isDownloading ? 'Generating...' : 'Download CSV'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((business) => (
                <TableRow key={business.id}>
                  <TableCell className="font-medium">{business.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {business.address}
                    </div>
                  </TableCell>
                  <TableCell>
                    {business.phone ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {business.phone}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>{formatRating(business.rating)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {business.totalReviews} reviews
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={business.status === 'OPERATIONAL' ? 'default' : 'secondary'}>
                      {business.status || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedBusiness(business)}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Reviews
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {business.name} - Recent Reviews
                          </DialogTitle>
                        </DialogHeader>
                        <ScrollArea className="h-96">
                          <div className="space-y-4">
                            {business.reviews.length > 0 ? (
                              business.reviews.map((review, index) => (
                                <div key={index} className="border-b pb-4 last:border-b-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{review.author}</div>
                                    <div className="flex items-center gap-2">
                                      {formatRating(review.rating)}
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {review.time}
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{review.text}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-muted-foreground text-center py-8">
                                No reviews available
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};