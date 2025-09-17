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

    // Step 1: Search for places using Text Search API
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Places API Error:', searchData)
      return new Response(
        JSON.stringify({ error: `Google Places API error: ${searchData.status}` }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (searchData.status === 'ZERO_RESULTS' || !searchData.results?.length) {
      return new Response(
        JSON.stringify({ results: [] }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Found ${searchData.results.length} places`)

    // Step 2: Get detailed information for each place including reviews
    const detailedResults = await Promise.all(
      searchData.results.slice(0, 20).map(async (place: PlaceResult) => {
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,rating,user_ratings_total,business_status,website,price_level,reviews&key=${googleApiKey}`
          
          const detailsResponse = await fetch(detailsUrl)
          const detailsData = await detailsResponse.json()

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

    return new Response(
      JSON.stringify({ results: detailedResults }),
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