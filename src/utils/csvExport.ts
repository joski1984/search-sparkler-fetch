import { BusinessResult } from '@/components/ResultsTable';

export const generateCSV = (results: BusinessResult[]): string => {
  const headers = [
    'Business Name',
    'Address', 
    'Phone',
    'Rating',
    'Reviews',
    'Status',
    'Website',
    'Price',
    'Top Review'
  ];

  // Helper function to truncate text and ensure proper formatting
  const truncateText = (text: string, maxLength: number): string => {
    if (!text) return 'N/A';
    const cleanText = text.replace(/"/g, '""').replace(/\r?\n/g, ' ').trim();
    return cleanText.length > maxLength ? cleanText.substring(0, maxLength) + '...' : cleanText;
  };

  const csvRows = [
    headers.join(','),
    ...results.map(business => {
      // Get the best review (highest rating, then most recent)
      const bestReview = business.reviews.length > 0 
        ? business.reviews.reduce((best, current) => 
            current.rating > best.rating ? current : best
          )
        : null;

      const reviewText = bestReview 
        ? `${bestReview.author} (${bestReview.rating}★): ${truncateText(bestReview.text, 100)}`
        : 'No reviews';

      return [
        `"${truncateText(business.name, 50)}"`,
        `"${truncateText(business.address, 80)}"`,
        `"${business.phone || 'N/A'}"`,
        business.rating.toString(),
        business.totalReviews.toString(),
        `"${business.status || 'Unknown'}"`,
        `"${truncateText(business.website || 'N/A', 50)}"`,
        `"${business.priceLevel ? '$'.repeat(business.priceLevel) : 'N/A'}"`,
        `"${reviewText}"`
      ].join(',');
    })
  ];

  return csvRows.join('\n');
};

export const downloadCSV = (csvContent: string, filename: string = 'business_search_results.csv') => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};