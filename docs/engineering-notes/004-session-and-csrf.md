# Sessions and CSRF in DevFlow

Registration hashes the password with Argon2id and stores a normalized email under a unique index. Only login queries select the hash. The service verifies an Argon2id hash for both known and unknown accounts and returns the same failure response for either case.

The browser receives a random session token in an HttpOnly cookie. MongoDB stores its SHA-256 digest and expiration. The backend checks expiration while authenticating each request. The TTL index cleans up expired records asynchronously. Logout deletes the session, and logging in again replaces the existing browser session in a transaction.

The CSRF endpoint issues a signed token in a host-only cookie and returns the same token to React. For writes, the backend checks the request origin, the token signature and expiration, and equality with the header. The signature incorporates the current session token when available. React fetches a token immediately before a write and holds it in memory. Production cookies use `Secure` with the `__Host-` prefix.

Login allows ten requests per IP in fifteen minutes, and registration allows five. The limits live in the Express process for this milestone and reset when it restarts.
