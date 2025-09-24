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
  let baseLocation: string = query
  
  // Try multiple patterns to extract location
  const patterns = [
    /in\s+([^,]+)(?:,\s*([^,]+))?/i,  // "restaurants in New York"
    /([^,]+),\s*([^,]+)/,              // "New York, NY"
    /([a-zA-Z\s]+(?:city|town|village|area|district|state|country))/i, // Contains location words
  ]
  
  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      if (pattern.toString().includes('in\\s+')) {
        baseLocation = match[1] + (match[2] ? `, ${match[2]}` : '')
      } else if (pattern.toString().includes(',')) {
        baseLocation = `${match[1]}, ${match[2]}`
      } else {
        baseLocation = match[1]
      }
      break
    }
  }
  
  // If no specific location pattern found, use the whole query as location
  if (baseLocation === query) {
    const words = query.split(' ')
    // Try to identify the location part (usually the last part after business type)
    if (words.length > 2) {
      baseLocation = words.slice(-2).join(' ') // Take last 2 words as potential location
    }
  }

  // Derive search term by removing the location part from the query (e.g., "restaurants" from "restaurants in New York")
  let searchTerm = query
    .replace(new RegExp(`\\s+in\\s+${baseLocation.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'), '')
    .replace(/in\s+[^,]+(?:,\s*[^,]+)?/i, '')
    .trim()
  if (!searchTerm || searchTerm.length < 2) {
    // Fallback: take first word which is often the category
    searchTerm = query.split(',')[0].split(' ')[0]
  }

  console.log(`Grid search parsed -> searchTerm: "${searchTerm}", location: "${baseLocation}"`)

  console.log(`Starting grid search with ${gridSize}x${gridSize} grid for location: ${baseLocation}`)

  try {
    // Enhanced geocoding with multiple fallback strategies
    let geocodeData: any = null
    const geocodingAttempts = [
      baseLocation,                           // Original: "bangalore"
      `${baseLocation}, India`,              // Country fallback: "bangalore, India" 
      baseLocation.split(' ')[0],            // First word: "bangalore"
      `${baseLocation.split(' ')[0]}, India` // First word + country: "bangalore, India"
    ]

    console.log(`Starting geocoding attempts for: "${baseLocation}"`)
    
    for (let i = 0; i < geocodingAttempts.length; i++) {
      const attempt = geocodingAttempts[i]
      console.log(`Geocoding attempt ${i + 1}: "${attempt}"`)
      
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(attempt)}&key=${googleApiKey}`
      const geocodeResponse = await fetch(geocodeUrl)
      const attemptData = await geocodeResponse.json()
      apiCalls++

      if (attemptData.status === 'OK' && attemptData.results?.length > 0) {
        geocodeData = attemptData
        console.log(`✓ Geocoding successful on attempt ${i + 1}: ${attempt}`)
        break
      } else {
        console.log(`✗ Geocoding failed for attempt ${i + 1}: ${attempt} (status: ${attemptData.status})`)
      }
    }

    // If all geocoding attempts failed, fall back to standard search
    if (!geocodeData) {
      console.log('All geocoding attempts failed, falling back to standard search')
      const results = await performStandardSearch(query, googleApiKey, apiCalls)
      return { results, apiCalls: apiCalls + 3 + results.length }
    }

    const baseCoords = geocodeData.results[0].geometry.location
    const bounds = geocodeData.results[0].geometry.bounds

    // PHASE 1 FIX: Compute proper non-overlapping rectangular bounds
    let southwest: {lat: number, lng: number}
    let northeast: {lat: number, lng: number}
    
    if (bounds) {
      southwest = bounds.southwest
      northeast = bounds.northeast
      console.log(`Using geocoded bounds from API`)
    } else {
      // Create artificial bounding box ±0.25° around baseCoords (~25km radius)
      const radiusInDegrees = 0.25
      southwest = { lat: baseCoords.lat - radiusInDegrees, lng: baseCoords.lng - radiusInDegrees }
      northeast = { lat: baseCoords.lat + radiusInDegrees, lng: baseCoords.lng + radiusInDegrees }
      console.log(`Created artificial bounds ±${radiusInDegrees}° around base coordinates`)
    }

    // Calculate non-overlapping tile dimensions
    const latSpan = northeast.lat - southwest.lat
    const lngSpan = northeast.lng - southwest.lng
    const cellLat = latSpan / gridSize
    const cellLng = lngSpan / gridSize

    console.log(`Base coordinates: ${baseCoords.lat}, ${baseCoords.lng}`)
    console.log(`Bounds: SW(${southwest.lat.toFixed(4)}, ${southwest.lng.toFixed(4)}) to NE(${northeast.lat.toFixed(4)}, ${northeast.lng.toFixed(4)})`)
    console.log(`Grid cell size: ${cellLat.toFixed(4)} lat x ${cellLng.toFixed(4)} lng`)

    // PHASE 1 FIX: Create non-overlapping rectangular tiles and use textsearch with locationbias=rectangle
    const tilePromises: Promise<{results: PlaceResult[], apiCalls: number, tileInfo: any}>[] = []
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Calculate exact tile boundaries (non-overlapping)
        const tileSW = {
          lat: southwest.lat + i * cellLat,
          lng: southwest.lng + j * cellLng
        }
        const tileNE = {
          lat: tileSW.lat + cellLat,
          lng: tileSW.lng + cellLng
        }
        
        const tileIndex = i * gridSize + j
        const tilePromise = performGridTileTextSearch(
          searchTerm, 
          googleApiKey, 
          tileSW, 
          tileNE, 
          tileIndex, 
          uniquePlaceIds
        )
        tilePromises.push(tilePromise)
      }
    }

    // Execute all tile searches in parallel
    console.log(`Executing ${tilePromises.length} tile searches in parallel...`)
    const tileResults = await Promise.all(tilePromises)
    
    // Calculate total API calls and combine results
    let totalTileApiCalls = 0
    const tileLogs: any[] = []
    
    for (const tileResult of tileResults) {
      totalTileApiCalls += tileResult.apiCalls
      tileLogs.push(tileResult.tileInfo)
      
      // Add unique results from this tile
      for (const place of tileResult.results) {
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
    
    apiCalls += totalTileApiCalls

    // Log comprehensive results
    console.log(`=== GRID SEARCH RESULTS ===`)
    console.log(`Tiles created: ${gridSize}x${gridSize} = ${tilePromises.length}`)
    console.log(`Total API calls: ${apiCalls} (geocoding: 1, tile searches: ${totalTileApiCalls})`)
    console.log(`Unique results found: ${allResults.length}`)
    console.log(`Tile details:`)
    tileLogs.forEach((log, index) => {
      console.log(`  Tile ${log.tileIndex}: SW(${log.sw.lat.toFixed(4)}, ${log.sw.lng.toFixed(4)}) NE(${log.ne.lat.toFixed(4)}, ${log.ne.lng.toFixed(4)}) -> ${log.rawResults} raw, ${log.uniqueNew} new unique`)
    })

    return { results: allResults, apiCalls }

  } catch (error) {
    console.error('Grid search failed, falling back to standard search:', error)
    const results = await performStandardSearch(query, googleApiKey, apiCalls)
    return { results, apiCalls: apiCalls + 3 + results.length } // Estimate: 3 search calls + details calls
  }
}

// PHASE 1 FIX: New tile search using textsearch with locationbias=rectangle
async function performGridTileTextSearch(
  query: string, 
  googleApiKey: string, 
  southwest: {lat: number, lng: number}, 
  northeast: {lat: number, lng: number}, 
  tileIndex: number,
  existingPlaceIds: Set<string>
): Promise<{results: PlaceResult[], apiCalls: number, tileInfo: any}> {
  const results: PlaceResult[] = []
  let apiCalls = 0
  let rawResultsCount = 0
  let uniqueNewCount = 0

  // Helper to delay for next_page_token readiness
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

  try {
    let nextPageToken: string | undefined = undefined
    let pageCount = 0
    const maxPages = 3

    do {
      // PHASE 1 KEY CHANGE: Use textsearch with locationbias=rectangle instead of nearbysearch
      let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&locationbias=rectangle:${southwest.lat},${southwest.lng}|${northeast.lat},${northeast.lng}&key=${googleApiKey}`
      
      if (nextPageToken) {
        searchUrl += `&pagetoken=${nextPageToken}`
        await wait(2200) // Wait slightly longer for page token
      }

      const searchResponse = await fetch(searchUrl)
      const searchData = await searchResponse.json()
      apiCalls++

      if (searchData.status === 'OK' && searchData.results?.length) {
        rawResultsCount += searchData.results.length
        
        for (const place of searchData.results) {
          // Add to tile results regardless of global uniqueness for accurate counting
          results.push(place)
          
          // Count as unique new if not seen globally
          if (!existingPlaceIds.has(place.place_id)) {
            uniqueNewCount++
          }
        }
        nextPageToken = searchData.next_page_token
      } else if (searchData.status === 'ZERO_RESULTS') {
        nextPageToken = undefined
      } else {
        // Log other statuses and break to avoid wasting calls
        console.log(`Tile ${tileIndex} textsearch status: ${searchData.status}`)
        nextPageToken = undefined
      }

      pageCount++
    } while (nextPageToken && pageCount < maxPages)

  } catch (error) {
    console.error(`Grid tile textsearch failed for tile ${tileIndex}:`, error)
  }

  const tileInfo = {
    tileIndex,
    sw: southwest,
    ne: northeast,
    rawResults: rawResultsCount,
    uniqueNew: uniqueNewCount,
    apiCalls
  }

  return { results, apiCalls, tileInfo }
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
      apiCallsCount = allResults.length > 0 ? Math.ceil(allResults.length / 20) : 1 // Only count search API calls, not details
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