import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
}

interface PlaceGeometry {
  location: {
    lat: number;
    lng: number;
  };
}

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  website?: string;
  price_level?: number;
  photos?: PlacePhoto[];
  geometry: PlaceGeometry;
}

interface PlaceDetailsResult extends PlaceResult {
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    time: number;
    relative_time_description: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    
    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get Google Places API key from Supabase secrets
    const googleApiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    
    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Google Places API key not configured. Please add GOOGLE_PLACES_API_KEY to Supabase secrets.' 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Searching for:', query)

    // Step 1: Search for places using Text Search API with pagination
    let allResults: PlaceResult[] = []
    let nextPageToken: string | undefined = undefined
    let pageCount = 0
    const maxPages = 3 // Limit to 3 pages (up to 60 results) to prevent excessive API calls
    let apiCallsCount = 0 // Track API calls for token consumption

    do {
      let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`
      
      if (nextPageToken) {
        searchUrl += `&pagetoken=${nextPageToken}`
        // Google requires a short delay before using next_page_token
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()
      apiCallsCount++ // Count this search API call

      if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
        console.error('Places API Error:', searchData)
        if (pageCount === 0) {
          // If first page fails, return error
          return new Response(
            JSON.stringify({ error: `Google Places API error: ${searchData.status}` }),
            { 
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        } else {
          // If subsequent page fails, break and use what we have
          console.log('Breaking due to API error on page', pageCount + 1)
          break
        }
      }

      if (searchData.status === 'ZERO_RESULTS' || !searchData.results?.length) {
        if (pageCount === 0) {
          // No results on first page
          return new Response(
            JSON.stringify({ 
              results: [],
              apiCallsUsed: apiCallsCount
            }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        } else {
          // No more results on subsequent pages
          break
        }
      }

      // Add results from this page
      allResults = allResults.concat(searchData.results)
      nextPageToken = searchData.next_page_token
      pageCount++
      
      console.log(`Page ${pageCount}: Found ${searchData.results.length} places. Total so far: ${allResults.length}`)

    } while (nextPageToken && pageCount < maxPages)

    console.log(`Completed search across ${pageCount} pages. Total results: ${allResults.length}`)

    // Step 2: Get detailed information for each place including reviews
    const detailedResults = await Promise.all(
      allResults.map(async (place: PlaceResult) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,rating,user_ratings_total,business_status,website,price_level,reviews&key=${googleApiKey}`
          
          const detailsResponse = await fetch(detailsUrl)
          const detailsData = await detailsResponse.json()
          apiCallsCount++ // Count this details API call

          if (detailsData.status === 'OK' && detailsData.result) {
            const details: PlaceDetailsResult = detailsData.result

            return {
              id: place.place_id,
              name: details.name || place.name,
              address: details.formatted_address || place.formatted_address,
              phone: details.formatted_phone_number,
              rating: details.rating || 0,
              totalReviews: details.user_ratings_total || 0,
              status: details.business_status,
              website: details.website,
              priceLevel: details.price_level,
              reviews: (details.reviews || []).slice(0, 10).map(review => ({
                author: review.author_name,
                rating: review.rating,
                text: review.text,
                time: review.relative_time_description
              }))
            }
          } else {
            // Fallback to basic info if details fail
            return {
              id: place.place_id,
              name: place.name,
              address: place.formatted_address,
              phone: place.formatted_phone_number,
              rating: place.rating || 0,
              totalReviews: place.user_ratings_total || 0,
              status: place.business_status,
              website: place.website,
              priceLevel: place.price_level,
              reviews: []
            }
          }
        } catch (error) {
          console.error(`Error getting details for ${place.place_id}:`, error)
          // Return basic info on error
          return {
            id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            phone: place.formatted_phone_number,
            rating: place.rating || 0,
            totalReviews: place.user_ratings_total || 0,
            status: place.business_status,
            reviews: []
          }
        }
      })
    )

    console.log(`Processed ${detailedResults.length} detailed results`)
    console.log(`Total API calls made: ${apiCallsCount}`)

    return new Response(
      JSON.stringify({ 
        results: detailedResults,
        apiCallsUsed: apiCallsCount
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})