document.addEventListener('DOMContentLoaded', () => {
    const terminal = document.getElementById('terminal');
    const leadsGrid = document.getElementById('leads-grid');
    const leadsCount = document.getElementById('leads-count');
    const refreshBtn = document.getElementById('refresh-btn');
    const connectionStatus = document.getElementById('connection-status');
    const pulse = document.querySelector('.pulse');

    // Intent keywords to highlight in text
    const KEYWORDS = ['looking', 'need', 'recommend'];

    // Add a log entry to the terminal
    function appendLog(type, message, timestamp) {
        const timeStr = new Date(timestamp).toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = `[${timeStr}]`;
        
        const msgSpan = document.createElement('span');
        msgSpan.textContent = message;
        
        entry.appendChild(timeSpan);
        entry.appendChild(msgSpan);
        
        terminal.appendChild(entry);
        
        // Auto-scroll to bottom
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Connect to Server-Sent Events for live logs
    function connectSSE() {
        const evtSource = new EventSource('/api/logs');

        evtSource.onopen = () => {
            connectionStatus.textContent = 'Connected & Monitoring';
            pulse.classList.remove('error');
            pulse.classList.add('connected');
        };

        evtSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'refresh_leads') {
                    fetchLeads();
                } else {
                    appendLog(data.type, data.message, data.timestamp);
                }
            } catch (err) {
                console.error("Failed to parse SSE data", err);
            }
        };

        evtSource.onerror = (err) => {
            connectionStatus.textContent = 'Disconnected. Reconnecting...';
            pulse.classList.remove('connected');
            pulse.classList.add('error');
            evtSource.close();
            // Try to reconnect after 3 seconds
            setTimeout(connectSSE, 3000);
        };
    }

    // Highlight keywords in tweet text
    function highlightKeywords(text) {
        let highlighted = text;
        KEYWORDS.forEach(kw => {
            const regex = new RegExp(`(${kw})`, 'gi');
            highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
        });
        return highlighted;
    }

    // Render leads in the grid
    function renderLeads(leads) {
        leadsCount.textContent = leads.length;
        leadsGrid.innerHTML = '';

        if (leads.length === 0) {
            leadsGrid.innerHTML = `
                <div class="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
                    <p>No leads found yet. Waiting for the first fetch run...</p>
                </div>
            `;
            return;
        }

        // Sort leads by newest first
        const sortedLeads = [...leads].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        sortedLeads.forEach(lead => {
            const card = document.createElement('div');
            card.className = 'lead-card';
            
            const formattedDate = new Date(lead.created_at).toLocaleString();
            
            card.innerHTML = `
                <div class="lead-header">
                    <span class="lead-id">ID: ${lead.id}</span>
                    <span class="lead-time">${formattedDate}</span>
                </div>
                <div class="lead-text">
                    ${highlightKeywords(lead.text)}
                </div>
                <div class="lead-header" style="margin-top: auto; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <span>Author: ${lead.author_id}</span>
                    <a href="https://twitter.com/i/web/status/${lead.id}" target="_blank" style="color: var(--accent); text-decoration: none;">View Tweet ↗</a>
                </div>
            `;
            
            leadsGrid.appendChild(card);
        });
    }

    // Fetch leads from backend
    async function fetchLeads() {
        try {
            refreshBtn.textContent = 'Refreshing...';
            refreshBtn.disabled = true;
            
            const response = await fetch('/api/leads');
            if (!response.ok) throw new Error('Failed to fetch');
            
            const data = await response.json();
            renderLeads(data);
        } catch (err) {
            console.error(err);
            appendLog('error', 'Failed to refresh leads from backend.', new Date().toISOString());
        } finally {
            refreshBtn.textContent = 'Refresh';
            refreshBtn.disabled = false;
        }
    }

    // Initialize
    refreshBtn.addEventListener('click', fetchLeads);
    connectSSE();
    fetchLeads();
});
