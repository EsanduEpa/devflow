# Where backend validation lives

Zod validates incoming request bodies, query strings, and route parameters. For example, it rejects an invalid ObjectId before the repository makes a query and reports validation issues in the API error format. Controllers pass the validated values to the service.

Services own business rules and decide whether an operation is allowed. Mongoose schemas enforce document rules, such as required fields, when the app writes data. MongoDB unique indexes enforce uniqueness even when two requests try to insert the same value at the same time.

Use transactions when related writes must succeed together. The integration test writes two documents in one transaction and then checks that a separate transaction rolls both writes back after a deliberate failure. The tests use `devflow_test`, and the application selects `devflow_db` during startup.
