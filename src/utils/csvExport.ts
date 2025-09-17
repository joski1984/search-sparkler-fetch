import { BusinessResult } from '@/components/ResultsTable';

export const generateCSV = (results: BusinessResult[]): string => {
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