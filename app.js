require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWEETS_FILE = 'tweets.json';
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const PORT = 3000;

// Target Queries
const QUERIES = [
    '(ESG OR sustainability) (software OR platform) (looking OR need)',
    '(BRSR OR GHG reporting) (tool OR solution) (recommend OR suggest)',
    '"ESG software"'
];

// Target intent keywords for filtering
const INTENT_KEYWORDS = ['looking', 'need', 'recommend'];

// Express Server Setup
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// SSE Clients
let sseClients = [];

// Custom Logger to broadcast to SSE
const customLogger = {
    log: (msg) => {
        console.log(msg);
        broadcastLog('info', msg);
    },
    error: (msg) => {
        console.error(msg);
        broadcastLog('error', msg);
    }
};

function broadcastLog(type, message) {
    const logEvent = JSON.stringify({ type, message, timestamp: new Date().toISOString() });
    sseClients.forEach(client => {
        client.write(`data: ${logEvent}\n\n`);
    });
}

// Ensure the local tweets storage exists
if (!fs.existsSync(TWEETS_FILE)) {
    fs.writeFileSync(TWEETS_FILE, JSON.stringify([], null, 2));
}

// Initialize last start time to 10 minutes ago
let lastStartTime = new Date(Date.now() - INTERVAL_MS).toISOString();

/**
 * API Endpoint: SSE Logs
 */
app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE with client

    // Send an initial connected message
    res.write(`data: ${JSON.stringify({ type: 'info', message: 'Connected to backend logs.', timestamp: new Date().toISOString() })}\n\n`);

    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

/**
 * API Endpoint: Get Leads
 */
app.get('/api/leads', (req, res) => {
    try {
        const data = fs.readFileSync(TWEETS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        customLogger.error("Failed to read leads file.");
        res.status(500).json({ error: "Failed to read leads" });
    }
});

/**
 * Fetches tweets from Twitter API v2 using a specific query and start_time
 */
async function fetchTweetsForQuery(query, startTime) {
    let allTweets = [];
    let nextToken = null;

    do {
        try {
            const params = {
                query: query,
                'tweet.fields': 'created_at,author_id',
                max_results: 100, // max allowed for recent search
            };

            if (startTime) params.start_time = startTime;
            if (nextToken) params.next_token = nextToken;

            const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
                headers: {
                    Authorization: `Bearer ${BEARER_TOKEN}`
                },
                params: params
            });

            const data = response.data;
            if (data.data) {
                allTweets = allTweets.concat(data.data);
            }
            
            nextToken = data.meta ? data.meta.next_token : null;
        } catch (error) {
            customLogger.error(`Error fetching tweets for query "${query}": ${error.response ? JSON.stringify(error.response.data) : error.message}`);
            break;
        }
    } while (nextToken);

    return allTweets;
}

/**
 * Filters fetched tweets locally for specific intent keywords
 */
function filterTweets(tweets) {
    return tweets.filter(tweet => {
        const textLower = tweet.text.toLowerCase();
        return INTENT_KEYWORDS.some(keyword => textLower.includes(keyword));
    });
}

/**
 * Core execution pipeline: fetch, filter, deduplicate, store, print
 */
async function run() {
    customLogger.log(`\n--- Starting fetch run at ${new Date().toISOString()} ---`);
    if (!BEARER_TOKEN || BEARER_TOKEN.includes('your_actual_bearer_token_here')) {
        customLogger.error("Error: TWITTER_BEARER_TOKEN is not set correctly in .env file.");
        return;
    }

    const currentRunTime = new Date().toISOString();
    let totalFetched = 0;
    let totalFiltered = [];

    // Step 1: Fetch and Filter for all queries
    for (const query of QUERIES) {
        customLogger.log(`Fetching for query: ${query}`);
        const tweets = await fetchTweetsForQuery(query, lastStartTime);
        totalFetched += tweets.length;
        
        const filtered = filterTweets(tweets);
        totalFiltered = totalFiltered.concat(filtered);
    }

    // Step 2: Load existing tweets for cross-run deduplication
    let existingTweets = [];
    try {
        existingTweets = JSON.parse(fs.readFileSync(TWEETS_FILE, 'utf8'));
    } catch (err) {
        customLogger.error("Error reading tweets.json. Re-initializing file.");
    }

    const existingIds = new Set(existingTweets.map(t => t.id));
    const newLeads = [];
    const currentRunIds = new Set(); // Prevent duplicates within the same run

    // Step 3: Deduplicate
    for (const tweet of totalFiltered) {
        if (!existingIds.has(tweet.id) && !currentRunIds.has(tweet.id)) {
            newLeads.push({
                id: tweet.id,
                text: tweet.text,
                created_at: tweet.created_at,
                author_id: tweet.author_id
            });
            currentRunIds.add(tweet.id);
        }
    }

    // Step 4: Store data
    if (newLeads.length > 0) {
        const updatedTweets = existingTweets.concat(newLeads);
        fs.writeFileSync(TWEETS_FILE, JSON.stringify(updatedTweets, null, 2));
        customLogger.log(`Stored ${newLeads.length} new leads.`);
    }

    // Step 5: Display output
    customLogger.log(`Total fetched: ${totalFetched}`);
    customLogger.log(`Filtered count: ${totalFiltered.length}`);
    customLogger.log(`New leads count: ${newLeads.length}`);

    // Print top 5 new leads
    if (newLeads.length > 0) {
        customLogger.log("\nTop 5 new leads:");
        const top5 = newLeads.slice(0, 5);
        top5.forEach((lead, index) => {
            customLogger.log(`[${index + 1}] ID: ${lead.id} | Time: ${lead.created_at}`);
            customLogger.log(`Text: ${lead.text.replace(/\n/g, ' ')}`);
        });
    }

    // Step 6: Update time boundary for next interval
    lastStartTime = currentRunTime;
    customLogger.log(`--- Run complete. Next run in 10 minutes. ---`);
    
    // Broadcast a special event to tell the frontend to refresh leads
    broadcastLog('refresh_leads', 'Leads updated');
}

// Start Server
app.listen(PORT, () => {
    console.log(`Web server running on http://localhost:${PORT}`);
    
    // Initial execution after 2 seconds to let clients connect
    setTimeout(run, 2000);
    
    // Schedule continuous execution
    setInterval(run, INTERVAL_MS);
});
