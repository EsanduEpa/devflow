# Local API requests through Vite

The React app calls `/api/health` using a relative URL. The browser sends the request to the Vite server that served the page. Vite forwards the request to the Express server and returns the response to the browser.

The Vite config reads `API_PROXY_TARGET` from the frontend's local environment. If Express changes ports, the proxy target can change without editing the React component. Both servers still run independently, which lets us test Express directly and check that React handles a backend outage.
