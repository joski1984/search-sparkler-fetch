import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Star, Phone, MapPin, Clock, MessageSquare, ExternalLink, Globe, Share2, Mail, MessageCircle, FileText, FileSpreadsheet, File } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [shareStep, setShareStep] = useState<'format' | 'method' | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null);

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

  const generateExcelFile = () => {
    const worksheetData = [
      ['Business Name', 'Address', 'Phone', 'Rating', 'Total Reviews', 'Status', 'Website', 'Price Level', 'Top Review'],
      ...results.map(business => {
        const bestReview = business.reviews.length > 0 
          ? business.reviews.reduce((best, current) => 
              current.rating > best.rating ? current : best
            )
          : null;

        const reviewText = bestReview 
          ? `${bestReview.author} (${bestReview.rating}★): ${bestReview.text.substring(0, 100)}${bestReview.text.length > 100 ? '...' : ''}`
          : 'No reviews';

        return [
          business.name.substring(0, 50),
          business.address.substring(0, 80),
          business.phone || 'N/A',
          business.rating,
          business.totalReviews,
          business.status || 'Unknown',
          business.website?.substring(0, 50) || 'N/A',
          business.priceLevel ? '$'.repeat(business.priceLevel) : 'N/A',
          reviewText
        ];
      })
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Business Results');
    
    return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  };

  const generatePDFFile = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Business Search Results', 20, 30);
    doc.setFontSize(12);
    doc.text(`Found ${results.length} businesses`, 20, 45);

    const tableData = results.map(business => {
      const bestReview = business.reviews.length > 0 
        ? business.reviews.reduce((best, current) => 
            current.rating > best.rating ? current : best
          )
        : null;

      return [
        business.name.substring(0, 30),
        business.address.substring(0, 40),
        business.phone?.substring(0, 15) || 'N/A',
        business.rating.toString(),
        business.totalReviews.toString(),
        business.status?.substring(0, 15) || 'Unknown'
      ];
    });

    autoTable(doc, {
      head: [['Name', 'Address', 'Phone', 'Rating', 'Reviews', 'Status']],
      body: tableData,
      startY: 55,
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 }
      }
    });

    return doc.output('arraybuffer');
  };

  const createFileFromFormat = (format: string) => {
    let content: string | Uint8Array | ArrayBuffer;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
        content = generateCSVContent();
        filename = 'business_search_results.csv';
        mimeType = 'text/csv';
        break;
      case 'excel':
        content = generateExcelFile();
        filename = 'business_search_results.xlsx';
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'pdf':
        content = generatePDFFile();
        filename = 'business_search_results.pdf';
        mimeType = 'application/pdf';
        break;
      default:
        throw new Error('Invalid format');
    }

    const blob = new Blob([content], { type: mimeType });
    return { blob, filename };
  };

  const handleShareViaEmail = () => {
    if (!selectedFormat) return;
    
    const { blob, filename } = createFileFromFormat(selectedFormat);
    
    // Create downloadable file
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    
    // Try native share API first (mobile/modern browsers)
    if (navigator.share && navigator.canShare) {
      try {
        const file = Object.assign(blob, { 
          name: filename,
          lastModified: Date.now(),
          webkitRelativePath: ''
        }) as File;
        if (navigator.canShare({ files: [file] })) {
          navigator.share({
            title: 'Business Search Results',
            text: 'Here are the business search results from your query.',
            files: [file]
          }).catch(() => {
            fallbackEmailShare(link, url, filename);
          });
          return;
        }
      } catch (error) {
        // Fallback if File constructor fails
      }
    }
    
    // Fallback for browsers without native share
    fallbackEmailShare(link, url, filename);
    setShareStep(null);
    setSelectedFormat(null);
  };

  const fallbackEmailShare = (link: HTMLAnchorElement, url: string, filename: string) => {
    // Download the file first
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Then open email client with instructions
    const subject = encodeURIComponent('Business Search Results');
    const body = encodeURIComponent(`Hi,

Please find the business search results attached. The ${filename} file should have been downloaded to your device.

The file contains comprehensive business data including:
- Business names and addresses
- Contact information
- Ratings and reviews
- Website links
- Status information

Best regards`);
    
    const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoLink;
  };

  const handleShareViaWhatsApp = () => {
    if (!selectedFormat) return;
    
    const { blob, filename } = createFileFromFormat(selectedFormat);
    
    // Try native share API first (can share files to WhatsApp on mobile)
    if (navigator.share && navigator.canShare) {
      try {
        const file = Object.assign(blob, { 
          name: filename,
          lastModified: Date.now(),
          webkitRelativePath: ''
        }) as File;
        
        if (navigator.canShare({ files: [file] })) {
          navigator.share({
            title: 'Business Search Results',
            text: `📊 Found ${results.length} businesses from your search`,
            files: [file]
          }).catch(() => {
            fallbackWhatsAppShare();
          });
          setShareStep(null);
          setSelectedFormat(null);
          return;
        }
      } catch (error) {
        // Fallback if File constructor fails
      }
    }
    
    // Fallback to text summary
    fallbackWhatsAppShare();
    setShareStep(null);
    setSelectedFormat(null);
  };

  const fallbackWhatsAppShare = () => {
    // Create a more concise summary for WhatsApp
    const summary = `📊 Business Search Results (${results.length} businesses found)\n\n` +
      results.slice(0, 5).map((business, index) => 
        `${index + 1}. ${business.name}\n⭐ ${business.rating}/5 (${business.totalReviews} reviews)\n📍 ${business.address}\n${business.phone ? `📞 ${business.phone}` : 'No phone'}\n`
      ).join('\n') + 
      (results.length > 5 ? `\n...and ${results.length - 5} more businesses` : '');
    
    const message = encodeURIComponent(summary);
    
    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      if (isMobile) {
        // For mobile, try WhatsApp app first
        window.location.href = `whatsapp://send?text=${message}`;
      } else {
        // For desktop, use WhatsApp web
        const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;
        const newWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        
        if (!newWindow) {
          // If popup blocked, copy to clipboard
          navigator.clipboard.writeText(decodeURIComponent(message)).then(() => {
            alert('WhatsApp link was blocked. The message has been copied to your clipboard. You can paste it in WhatsApp manually.');
          }).catch(() => {
            alert('Could not open WhatsApp or copy to clipboard. Please check your browser settings.');
          });
        }
      }
    } catch (error) {
      // Ultimate fallback - copy to clipboard
      navigator.clipboard.writeText(decodeURIComponent(message)).then(() => {
        alert('Could not open WhatsApp. The message has been copied to your clipboard.');
      }).catch(() => {
        alert('Could not open WhatsApp or copy to clipboard. Please check your browser settings.');
      });
    }
  };

  const handleFormatSelect = (format: 'csv' | 'excel' | 'pdf') => {
    setSelectedFormat(format);
    setShareStep('method');
  };

  const handleBackToFormatSelect = () => {
    setShareStep('format');
    setSelectedFormat(null);
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
            
            <DropdownMenu 
              open={shareStep !== null} 
              onOpenChange={(open) => {
                if (!open) {
                  setShareStep(null);
                  setSelectedFormat(null);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button 
                  size="lg"
                  onClick={() => setShareStep('format')}
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Share2 className="h-5 w-5 mr-2" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-background border-border shadow-xl">
                {shareStep === 'format' && (
                  <>
                    <div className="px-3 py-2 text-sm font-semibold text-foreground border-b border-border">
                      Choose Format
                    </div>
                    <DropdownMenuItem 
                      onClick={() => handleFormatSelect('csv')} 
                      className="cursor-pointer hover:bg-muted"
                    >
                      <FileText className="h-4 w-4 mr-3" />
                      <div>
                        <div className="font-medium">CSV File</div>
                        <div className="text-xs text-muted-foreground">Comma-separated values</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleFormatSelect('excel')} 
                      className="cursor-pointer hover:bg-muted"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-3" />
                      <div>
                        <div className="font-medium">Excel File</div>
                        <div className="text-xs text-muted-foreground">Excel spreadsheet</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleFormatSelect('pdf')} 
                      className="cursor-pointer hover:bg-muted"
                    >
                      <File className="h-4 w-4 mr-3" />
                      <div>
                        <div className="font-medium">PDF File</div>
                        <div className="text-xs text-muted-foreground">Portable document</div>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
                
                {shareStep === 'method' && (
                  <>
                    <div className="px-3 py-2 text-sm border-b border-border">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">Share via</span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleBackToFormatSelect}
                          className="h-6 px-2 text-xs"
                        >
                          ← Back
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Format: {selectedFormat?.toUpperCase()}
                      </div>
                    </div>
                    <DropdownMenuItem 
                      onClick={handleShareViaEmail} 
                      className="cursor-pointer hover:bg-muted"
                    >
                      <Mail className="h-4 w-4 mr-3" />
                      <div>
                        <div className="font-medium">Email</div>
                        <div className="text-xs text-muted-foreground">Send via email client</div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleShareViaWhatsApp} 
                      className="cursor-pointer hover:bg-muted"
                    >
                      <MessageCircle className="h-4 w-4 mr-3" />
                      <div>
                        <div className="font-medium">WhatsApp</div>
                        <div className="text-xs text-muted-foreground">Send via WhatsApp</div>
                      </div>
                    </DropdownMenuItem>
                  </>
                )}
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