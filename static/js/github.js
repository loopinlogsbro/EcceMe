document.addEventListener('DOMContentLoaded', () => {
    const terminalOutput = document.getElementById('github-terminal-output');
    const username = 'loopinlogsbro';
    const limit = 5; // Number of events to show

    if (!terminalOutput) return;

    fetch(`https://api.github.com/users/${username}/events/public`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Terminal offline: GitHub API rate limit reached. Please check back later.');
                }
                throw new Error('Terminal offline: Could not connect to GitHub.');
            }
            return response.json();
        })
        .then(data => {
            // Filter for PushEvents (commits)
            const pushEvents = data.filter(event => event.type === 'PushEvent');
            
            terminalOutput.innerHTML = ''; // Clear loading message

            if (pushEvents.length === 0) {
                terminalOutput.innerHTML = `<div class="terminal-line"><span class="prompt">></span> No recent commits found for ${username}.</div>`;
                return;
            }

            // Take the most recent X events
            const recentEvents = pushEvents.slice(0, limit);

            recentEvents.forEach(event => {
                const repoName = event.repo.name.split('/')[1] || event.repo.name;
                const commit = event.payload.commits[0];
                
                if (!commit) return; // Skip if no commits in payload

                const message = commit.message.split('\n')[0]; // Just the first line of the commit
                const hash = commit.sha.substring(0, 7);
                const date = new Date(event.created_at);
                const timeAgo = getTimeAgo(date);

                const lineHtml = `
                    <div class="terminal-line">
                        <span class="prompt">></span> 
                        <span class="term-date">[${timeAgo}]</span> 
                        <span class="term-repo">${repoName}</span> 
                        <span class="term-hash">(${hash})</span>: 
                        <span class="term-msg">${escapeHtml(message)}</span>
                    </div>
                `;
                terminalOutput.insertAdjacentHTML('beforeend', lineHtml);
            });

            // Add the blinking cursor line
            terminalOutput.insertAdjacentHTML('beforeend', `<div class="terminal-line"><span class="prompt">></span> <span class="cursor">_</span></div>`);
        })
        .catch(error => {
            terminalOutput.innerHTML = `<div class="terminal-line error-text"><span class="prompt">></span> ${error.message}</div>`;
            terminalOutput.insertAdjacentHTML('beforeend', `<div class="terminal-line"><span class="prompt">></span> <span class="cursor">_</span></div>`);
        });

    // Helper: Time ago formatter
    function getTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return Math.floor(seconds) + "s";
    }

    // Helper: Basic HTML escaping to prevent XSS from commit messages
    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});
