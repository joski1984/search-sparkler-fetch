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
async function performStandardSearch(query: string, googleApiKey: string, initialApiCalls: number, maxResults: number = 200): Promise<PlaceResult[]> {
  let allResults: PlaceResult[] = []
  let nextPageToken: string | undefined = undefined
  let pageCount = 0

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

    // Stop if we've reached maxResults
    if (allResults.length >= maxResults) {
      console.log(`Reached maxResults limit of ${maxResults}, stopping pagination`)
      allResults = allResults.slice(0, maxResults)
      break
    }

  } while (nextPageToken)

  return allResults
}

// Helper function for grid-based search
async function performGridSearch(query: string, googleApiKey: string, maxResults: number, searchIntensity: string): Promise<{results: PlaceResult[], apiCalls: number, meta: any}> {
  let apiCalls = 0
  const uniquePlaceIds = new Set<string>()
  let rawResultsCount = 0

  // Determine grid size based on search intensity  
  const gridSizes = {
    low: 2,    // 2x2 = 4 searches
    medium: 3, // 3x3 = 9 searches  
    high: 4    // 4x4 = 16 searches
  }
  let gridSize = gridSizes[searchIntensity as keyof typeof gridSizes] || 2

  // Try to extract location from query for geocoding
  let baseLocation: string = query
  
  // Try multiple patterns to extract location
  const patterns = [
    /in\s+([^,]+)(?:,\s*([^,]+))?/i,  // "restaurants in New York"
    /([^,]+),\s*([^,]+)/,              // "New York, NY"
  ]
  
  for (const pattern of patterns) {
    const match = query.match(pattern)
    if (match) {
      if (pattern.toString().includes('in\\s+')) {
        baseLocation = match[1] + (match[2] ? `, ${match[2]}` : '')
      } else if (pattern.toString().includes(',')) {
        baseLocation = `${match[1]}, ${match[2]}`
      }
      break
    }
  }
  
  // If no specific location pattern found, use the whole query as location
  if (baseLocation === query) {
    const words = query.split(' ')
    if (words.length > 2) {
      baseLocation = words.slice(-2).join(' ')
    }
  }

  // Derive search term by removing the location part from the query
  let searchTerm = query
    .replace(new RegExp(`\\s+in\\s+${baseLocation.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i'), '')
    .replace(/in\s+[^,]+(?:,\s*[^,]+)?/i, '')
    .trim()
  if (!searchTerm || searchTerm.length < 2) {
    searchTerm = query.split(',')[0].split(' ')[0]
  }

  console.log(`Grid search parsed -> searchTerm: "${searchTerm}", location: "${baseLocation}"`)

  try {
    // STEP 1: GEOCODING - Always get coordinates + bounds
    let geocodeData: any = null
    const geocodingAttempts = [
      baseLocation,
      `${baseLocation}, India`
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
      console.log('❌ All geocoding attempts failed, falling back to standard search')
      const results = await performStandardSearch(query, googleApiKey, apiCalls, maxResults)
      return { 
        results, 
        apiCalls: apiCalls + Math.ceil(results.length / 20),
        meta: { tilesCreated: 0, rawResults: results.length, uniqueResults: results.length, tileLogs: [] }
      }
    }

    const baseCoords = geocodeData.results[0].geometry.location
    const bounds = geocodeData.results[0].geometry.bounds

    // STEP 2: Create proper non-overlapping rectangular bounds
    let southwest: {lat: number, lng: number}
    let northeast: {lat: number, lng: number}
    
    if (bounds) {
      southwest = bounds.southwest
      northeast = bounds.northeast
      console.log(`Using geocoded bounds from API`)
    } else {
      // Create artificial bounding box ±0.25° around baseCoords
      const radiusInDegrees = 0.25
      southwest = { lat: baseCoords.lat - radiusInDegrees, lng: baseCoords.lng - radiusInDegrees }
      northeast = { lat: baseCoords.lat + radiusInDegrees, lng: baseCoords.lng + radiusInDegrees }
      console.log(`Created artificial bounds ±${radiusInDegrees}° around base coordinates`)
    }

    // Auto-scale grid size if area is large
    const latSpan = northeast.lat - southwest.lat
    const lngSpan = northeast.lng - southwest.lng
    const maxSpan = Math.max(latSpan, lngSpan)
    
    if (maxSpan > 0.5) {
      gridSize = Math.min(gridSize + 1, 6)
      console.log(`Large area detected (${maxSpan.toFixed(2)}°), increasing grid size to ${gridSize}x${gridSize}`)
    }

    const cellLat = latSpan / gridSize
    const cellLng = lngSpan / gridSize

    console.log(`Base coordinates: ${baseCoords.lat}, ${baseCoords.lng}`)
    console.log(`Bounds: SW(${southwest.lat.toFixed(4)}, ${southwest.lng.toFixed(4)}) to NE(${northeast.lat.toFixed(4)}, ${northeast.lng.toFixed(4)})`)
    console.log(`Grid: ${gridSize}x${gridSize} = ${gridSize * gridSize} tiles`)
    console.log(`Cell size: ${cellLat.toFixed(4)}° lat x ${cellLng.toFixed(4)}° lng`)

    // STEP 3: Create tile array
    const tiles: Array<{swLat: number, swLng: number, neLat: number, neLng: number, tileIndex: string}> = []
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const swLat = southwest.lat + i * cellLat
        const swLng = southwest.lng + j * cellLng
        const neLat = swLat + cellLat
        const neLng = swLng + cellLng
        tiles.push({
          swLat,
          swLng,
          neLat,
          neLng,
          tileIndex: `${i}-${j}`
        })
      }
    }

    console.log(`Created ${tiles.length} non-overlapping tiles`)

    // STEP 4: Process tiles in batches of 4
    const BATCH_SIZE = 4
    const tileLogs: any[] = []
    const allResults: PlaceResult[] = []
    
    for (let batchStart = 0; batchStart < tiles.length; batchStart += BATCH_SIZE) {
      const batch = tiles.slice(batchStart, batchStart + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(tiles.length / BATCH_SIZE)} (tiles ${batchStart}-${batchStart + batch.length - 1})`)
      
      const batchPromises = batch.map(tile => 
        performGridTileTextSearch(
          searchTerm,
          googleApiKey,
          { lat: tile.swLat, lng: tile.swLng },
          { lat: tile.neLat, lng: tile.neLng },
          tile.tileIndex,
          uniquePlaceIds
        )
      )
      
      const batchResults = await Promise.all(batchPromises)
      
      // Process batch results
      for (const tileResult of batchResults) {
        apiCalls += tileResult.apiCalls
        rawResultsCount += tileResult.tileInfo.rawResults
        tileLogs.push(tileResult.tileInfo)
        
        // Add unique results from this tile
        for (const place of tileResult.results) {
          if (!uniquePlaceIds.has(place.place_id)) {
            uniquePlaceIds.add(place.place_id)
            allResults.push(place)
          }
        }
      }
      
      console.log(`After batch: ${allResults.length} unique results (${rawResultsCount} raw total)`)
      
      // Early stop if we have enough results
      if (allResults.length >= maxResults) {
        console.log(`✓ Reached target of ${maxResults} results, stopping early`)
        break
      }
      
      // Delay between batches (except for the last one)
      if (batchStart + BATCH_SIZE < tiles.length && allResults.length < maxResults) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }

    // Final logging
    const meta = {
      tilesCreated: tiles.length,
      tilesProcessed: tileLogs.length,
      apiCalls,
      rawResults: rawResultsCount,
      uniqueResults: allResults.length,
      tileLogs: tileLogs.map(log => ({
        tileIndex: log.tileIndex,
        sw: `${log.sw.lat.toFixed(4)},${log.sw.lng.toFixed(4)}`,
        ne: `${log.ne.lat.toFixed(4)},${log.ne.lng.toFixed(4)}`,
        pages: log.pages,
        rawResults: log.rawResults,
        uniqueNew: log.uniqueNew
      }))
    }

    console.log(`=== GRID SEARCH COMPLETE ===`)
    console.log(`Tiles: ${meta.tilesCreated} created, ${meta.tilesProcessed} processed`)
    console.log(`Results: ${meta.rawResults} raw, ${meta.uniqueResults} unique`)
    console.log(`API calls: ${meta.apiCalls}`)

    return { 
      results: allResults.slice(0, maxResults), 
      apiCalls,
      meta
    }

  } catch (error) {
    console.error('Grid search failed, falling back to standard search:', error)
    const results = await performStandardSearch(query, googleApiKey, apiCalls, maxResults)
    return { 
      results, 
      apiCalls: apiCalls + Math.ceil(results.length / 20),
      meta: { tilesCreated: 0, rawResults: results.length, uniqueResults: results.length, tileLogs: [], error: String(error) }
    }
  }
}

// Tile search using textsearch with locationbias=rectangle
async function performGridTileTextSearch(
  query: string, 
  googleApiKey: string, 
  southwest: {lat: number, lng: number}, 
  northeast: {lat: number, lng: number}, 
  tileIndex: string,
  existingPlaceIds: Set<string>
): Promise<{results: PlaceResult[], apiCalls: number, tileInfo: any}> {
  const results: PlaceResult[] = []
  let apiCalls = 0
  let rawResultsCount = 0
  let uniqueNewCount = 0

  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))
  
  // Retry helper with exponential backoff
  async function fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url)
        const data = await response.json()
        
        if (data.status === 'INVALID_REQUEST' && attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          console.log(`Tile ${tileIndex} INVALID_REQUEST, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`)
          await wait(delay)
          continue
        }
        
        return data
      } catch (error) {
        if (attempt === retries - 1) throw error
        await wait(1000)
      }
    }
  }

  try {
    let nextPageToken: string | undefined = undefined
    let pageCount = 0
    const MAX_PAGES_PER_TILE = 3

    do {
      // Use textsearch with locationbias=rectangle
      let searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&locationbias=rectangle:${southwest.lat},${southwest.lng}|${northeast.lat},${northeast.lng}&key=${googleApiKey}`
      
      if (nextPageToken) {
        searchUrl += `&pagetoken=${nextPageToken}`
        await wait(2200) // Wait for page token readiness
      }

      const searchData = await fetchWithRetry(searchUrl)
      apiCalls++

      if (searchData.status === 'OK' && searchData.results?.length) {
        rawResultsCount += searchData.results.length
        
        for (const place of searchData.results) {
          results.push(place)
          
          if (!existingPlaceIds.has(place.place_id)) {
            uniqueNewCount++
          }
        }
        
        nextPageToken = searchData.next_page_token
        pageCount++
      } else if (searchData.status === 'ZERO_RESULTS') {
        nextPageToken = undefined
      } else {
        console.log(`Tile ${tileIndex} status: ${searchData.status}`)
        nextPageToken = undefined
      }

    } while (nextPageToken && pageCount < MAX_PAGES_PER_TILE)

  } catch (error) {
    console.error(`Tile ${tileIndex} search failed:`, error)
  }

  const tileInfo = {
    tileIndex,
    sw: southwest,
    ne: northeast,
    pages: apiCalls,
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
    let searchMeta: any = {}

    // Determine if we need grid search based on maxResults
    if (maxResults <= 60) {
      // Standard search for <= 60 results
      allResults = await performStandardSearch(query, googleApiKey, apiCallsCount, maxResults)
      apiCallsCount = allResults.length > 0 ? Math.ceil(allResults.length / 20) : 1
      searchMeta = { tilesCreated: 0, rawResults: allResults.length, uniqueResults: allResults.length, tileLogs: [] }
    } else {
      // Grid search for > 60 results
      const gridResult = await performGridSearch(query, googleApiKey, maxResults, searchIntensity)
      allResults = gridResult.results
      apiCallsCount = gridResult.apiCalls
      searchMeta = gridResult.meta
    }

    if (allResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          results: [],
          apiCallsUsed: apiCallsCount,
          meta: searchMeta
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`Total unique places found: ${allResults.length}`)
    console.log(`Fetching details for ${allResults.length} unique places...`)

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

    const totalApiCalls = apiCallsCount + detailedResults.length
    
    console.log(`Processed ${detailedResults.length} detailed results`)
    console.log(`Total API calls: ${totalApiCalls} (search: ${apiCallsCount}, details: ${detailedResults.length})`)

    return new Response(
      JSON.stringify({ 
        results: detailedResults,
        apiCallsUsed: totalApiCalls,
        meta: {
          ...searchMeta,
          detailsCalls: detailedResults.length,
          totalApiCalls
        }
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