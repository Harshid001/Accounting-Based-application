const http = require('http');

function fetch(url, depth = 0) {
  if (depth > 10) {
    console.log('Too many redirects!');
    return;
  }
  console.log(`[Depth ${depth}] Fetching: ${url}`);
  http.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile Safari/537.36)'
    }
  }, (res) => {
    console.log(`  Status: ${res.statusCode}`);
    console.log(`  Location: ${res.headers.location}`);
    
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      let nextUrl = res.headers.location;
      if (nextUrl.startsWith('/')) {
        nextUrl = new URL(nextUrl, url).toString();
      }
      fetch(nextUrl, depth + 1);
    } else {
      console.log('Reached end of redirect chain.');
    }
  }).on('error', (e) => {
    console.error(`Error: ${e.message}`);
  });
}

fetch('http://192.168.1.191:3000/dashboard');
