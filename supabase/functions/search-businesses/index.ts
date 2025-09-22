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

interface GeocodeResult {
  geometry: {
    location: { lat: number; lng: number };
    bounds?: {
      northeast: { lat: number; lng: number };
      southwest: { lat: number; lng: number };
    };
  };
}

// Helper function for standard search (original logic)
async function performStandardSearch(query: string, googleApiKey: string, initialApiCalls: number): Promise<PlaceResult[]> {
  let allResults: PlaceResult[] = []
  let nextPageToken: string | undefined = undefined
  let pageCount = 0
  const maxPages = 3

  do {
    let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`
    
    if (nextPageToken) {
      searchUrl += `&pagetoken=${nextPageToken}`
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()

    if (searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
      console.error('Places API Error:', searchData)
      if (pageCount === 0) throw new Error(`Google Places API error: ${searchData.status}`)
      break
    }

    if (searchData.status === 'ZERO_RESULTS' || !searchData.results?.length) {
      break
    }

    allResults = allResults.concat(searchData.results)
    nextPageToken = searchData.next_page_token
    pageCount++
    
    console.log(`Standard search page ${pageCount}: Found ${searchData.results.length} places. Total: ${allResults.length}`)

  } while (nextPageToken && pageCount < maxPages)

  return allResults
}

// Helper function for grid-based search
async function performGridSearch(query: string, googleApiKey: string, maxResults: number, searchIntensity: string): Promise<{results: PlaceResult[], apiCalls: number}> {
  let apiCalls = 0
  let allResults: PlaceResult[] = []
  const uniquePlaceIds = new Set<string>()

  // Determine grid size based on search intensity
  const gridSizes = {
    low: 2,    // 2x2 = 4 searches
    medium: 3, // 3x3 = 9 searches  
    high: 4    // 4x4 = 16 searches
  }
  const gridSize = gridSizes[searchIntensity as keyof typeof gridSizes] || 2

  // Try to extract location from query for geocoding
  const locationMatch = query.match(/in\s+([^,]+)(?:,\s*([^,]+))?/i)
  let baseLocation: string = locationMatch ? locationMatch[1] + (locationMatch[2] ? `, ${locationMatch[2]}` : '') : query

  console.log(`Starting grid search with ${gridSize}x${gridSize} grid for location: ${baseLocation}`)

  try {
    // Get base coordinates using geocoding
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(baseLocation)}&key=${googleApiKey}`
    const geocodeResponse = await fetch(geocodeUrl)
    const geocodeData = await geocodeResponse.json()
    apiCalls++

    if (geocodeData.status !== 'OK' || !geocodeData.results?.length) {
      console.log('Geocoding failed, falling back to standard search')
      const results = await performStandardSearch(query, googleApiKey, apiCalls)
      return { results, apiCalls: apiCalls + Math.ceil(results.length / 20) + results.length }
    }

    const baseCoords = geocodeData.results[0].geometry.location
    const bounds = geocodeData.results[0].geometry.bounds

    // Calculate grid offsets based on bounds or default radius
    let latOffset = 0.01  // Default ~1km
    let lngOffset = 0.01
    
    if (bounds) {
      latOffset = (bounds.northeast.lat - bounds.southwest.lat) / (gridSize * 2)
      lngOffset = (bounds.northeast.lng - bounds.southwest.lng) / (gridSize * 2)
    }

    console.log(`Base coordinates: ${baseCoords.lat}, ${baseCoords.lng}`)
    console.log(`Grid offsets: lat=${latOffset.toFixed(4)}, lng=${lngOffset.toFixed(4)}`)

    // Perform grid searches
    const gridPromises: Promise<PlaceResult[]>[] = []
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const offsetLat = baseCoords.lat + (i - gridSize/2 + 0.5) * latOffset
        const offsetLng = baseCoords.lng + (j - gridSize/2 + 0.5) * lngOffset
        
        const gridPromise = performGridTileSearch(query, googleApiKey, offsetLat, offsetLng, uniquePlaceIds)
        gridPromises.push(gridPromise)
      }
    }

    // Execute all grid searches in parallel
    const gridResults = await Promise.all(gridPromises)
    apiCalls += gridSize * gridSize * 3 // Estimate 3 calls per tile (search + pages)

    // Combine and deduplicate results
    for (const tileResults of gridResults) {
      for (const place of tileResults) {
        if (!uniquePlaceIds.has(place.place_id)) {
          uniquePlaceIds.add(place.place_id)
          allResults.push(place)
          
          if (allResults.length >= maxResults) {
            console.log(`Reached maxResults limit of ${maxResults}`)
            break
          }
        }
      }
      if (allResults.length >= maxResults) break
    }

    console.log(`Grid search completed: ${allResults.length} unique results from ${gridSize}x${gridSize} grid`)
    return { results: allResults, apiCalls }

  } catch (error) {
    console.error('Grid search failed, falling back to standard search:', error)
    const results = await performStandardSearch(query, googleApiKey, apiCalls)
    return { results, apiCalls: apiCalls + Math.ceil(results.length / 20) + results.length }
  }
}

// Helper function for individual grid tile search
async function performGridTileSearch(query: string, googleApiKey: string, lat: number, lng: number, existingPlaceIds: Set<string>): Promise<PlaceResult[]> {
  const results: PlaceResult[] = []
  
  try {
    // Use location bias to focus search on this grid tile
    const locationBias = `point:${lat},${lng}`
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&locationbias=${locationBias}&key=${googleApiKey}`
    
    const searchResponse = await fetch(searchUrl)
    const searchData = await searchResponse.json()

    if (searchData.status === 'OK' && searchData.results?.length) {
      for (const place of searchData.results) {
        if (!existingPlaceIds.has(place.place_id)) {
          results.push(place)
        }
      }
    }
  } catch (error) {
    console.error(`Grid tile search failed for ${lat},${lng}:`, error)
  }

  return results
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query, maxResults = 60, searchIntensity = 'low' } = await req.json()
    
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
    console.log('Max results requested:', maxResults)
    console.log('Search intensity:', searchIntensity)

    let apiCallsCount = 0
    let allResults: PlaceResult[] = []

    // Determine if we need grid search based on maxResults
    if (maxResults <= 60) {
      // Standard search for <= 60 results
      allResults = await performStandardSearch(query, googleApiKey, apiCallsCount)
      apiCallsCount = allResults.length > 0 ? Math.ceil(allResults.length / 20) + allResults.length : 1
    } else {
      // Grid search for > 60 results
      const gridResult = await performGridSearch(query, googleApiKey, maxResults, searchIntensity)
      allResults = gridResult.results
      apiCallsCount = gridResult.apiCalls
    }

    if (allResults.length === 0) {
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
    }

    console.log(`Total unique results found: ${allResults.length}`)

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